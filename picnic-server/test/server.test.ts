import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Authenticator } from '../src/auth.js'
import { AuthError } from '../src/errors.js'
import { createApp } from '../src/server.js'
import { Store } from '../src/store.js'
import { createFakePicnic } from './fakePicnic.js'

const KEY = Buffer.alloc(32, 9)
const ORIGIN = 'https://app.example'

const IDENTITIES: Record<string, { userId: string; householdId: string }> = {
  'token-a': { userId: 'user-a', householdId: 'household-a' },
  'token-b': { userId: 'user-b', householdId: 'household-b' },
}

const fakeAuth: Authenticator = {
  async authenticate(header) {
    const token = /^Bearer (.+)$/.exec(header ?? '')?.[1]
    if (!token) throw new AuthError(401, 'missing_token', 'Log eerst in.')
    const identity = IDENTITIES[token]
    if (!identity) throw new AuthError(401, 'invalid_token', 'Ongeldig.')
    return identity
  },
}

let dir: string
let clock: number

function setup() {
  const fake = createFakePicnic()
  fake.state.accounts.set('piet@example.nl', { password: 'geheim', twoFactor: false })
  fake.state.accounts.set('klaas@example.nl', { password: 'geheim', twoFactor: true })
  const store = new Store(join(dir, 'picnic.db'), KEY)
  const app = createApp({
    config: { allowedOrigins: [ORIGIN] },
    auth: fakeAuth,
    store,
    picnic: fake.factory,
    now: () => clock,
    pendingLoginMs: 10 * 60_000,
  })
  const call = (method: string, path: string, token: string | null, body?: unknown, headers: Record<string, string> = {}) =>
    app.request(path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  return { fake, store, app, call }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'picnic-server-'))
  clock = 1_000_000
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('toegang', () => {
  it('laat /health open', async () => {
    const { call } = setup()
    expect((await call('GET', '/health', null)).status).toBe(200)
  })

  it.each([
    ['GET', '/picnic/status'],
    ['POST', '/picnic/login'],
    ['GET', '/picnic/search?q=melk'],
    ['GET', '/picnic/cart'],
    ['POST', '/picnic/cart/add'],
  ])('weigert %s %s zonder sessie', async (method, path) => {
    const { call } = setup()
    expect((await call(method, path, null, method === 'POST' ? {} : undefined)).status).toBe(401)
  })

  it('weigert een onbekende sessie', async () => {
    const { call } = setup()
    expect((await call('GET', '/picnic/status', 'token-x')).status).toBe(401)
  })

  it('staat alleen toegestane origins toe (CORS)', async () => {
    const { call } = setup()
    const ok = await call('GET', '/health', null, undefined, { Origin: ORIGIN })
    expect(ok.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    const bad = await call('GET', '/health', null, undefined, { Origin: 'https://evil.example' })
    expect(bad.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('inloggen bij Picnic', () => {
  it('koppelt zonder 2FA en bewaart alleen een versleutelde sleutel, nooit het wachtwoord', async () => {
    const { call, store } = setup()
    const res = await call('POST', '/picnic/login', 'token-a', { email: 'piet@example.nl', password: 'geheim' })
    expect(await res.json()).toEqual({ status: 'connected' })
    expect(await (await call('GET', '/picnic/status', 'token-a')).json()).toEqual({ connected: true, secondFactorPending: false })

    store.close()
    const raw = readdirSync(dir)
      .map((f) => readFileSync(join(dir, f)).toString('latin1'))
      .join('')
    expect(raw).not.toContain('geheim') // wachtwoord
    expect(raw).not.toContain('key-1') // sleutel zelf staat niet leesbaar in het bestand
    expect(raw).toContain('v1.') // wel versleuteld
  })

  it('meldt een fout wachtwoord als 422', async () => {
    const { call } = setup()
    const res = await call('POST', '/picnic/login', 'token-a', { email: 'piet@example.nl', password: 'fout' })
    expect(res.status).toBe(422)
    expect(((await res.json()) as { error: string }).error).toBe('picnic_invalid_credentials')
  })

  it('vraagt bij 2FA om de code en rondt daarna af', async () => {
    const { call } = setup()
    const login = await call('POST', '/picnic/login', 'token-a', { email: 'klaas@example.nl', password: 'geheim' })
    expect(await login.json()).toEqual({ status: 'second_factor_required' })
    expect(await (await call('GET', '/picnic/status', 'token-a')).json()).toEqual({ connected: false, secondFactorPending: true })

    const wrong = await call('POST', '/picnic/verify', 'token-a', { code: '000000' })
    expect(wrong.status).toBe(422)

    const right = await call('POST', '/picnic/verify', 'token-a', { code: '123456' })
    expect(await right.json()).toEqual({ status: 'connected' })
    expect(((await (await call('GET', '/picnic/status', 'token-a')).json()) as { connected: boolean }).connected).toBe(true)
  })

  it('weigert een code zonder lopende login, en na het verlopen van de wachttijd', async () => {
    const { call } = setup()
    expect((await call('POST', '/picnic/verify', 'token-a', { code: '123456' })).status).toBe(409)

    await call('POST', '/picnic/login', 'token-a', { email: 'klaas@example.nl', password: 'geheim' })
    clock += 11 * 60_000
    const late = await call('POST', '/picnic/verify', 'token-a', { code: '123456' })
    expect(late.status).toBe(409)
    expect(((await late.json()) as { error: string }).error).toBe('no_pending_login')
  })

  it('keurt ongeldige invoer af', async () => {
    const { call } = setup()
    expect((await call('POST', '/picnic/login', 'token-a', { email: '', password: 'x' })).status).toBe(400)
    const broken = await call('POST', '/picnic/login', 'token-a', undefined, { 'Content-Type': 'application/json' })
    expect(broken.status).toBe(400)
  })

  it('logt uit en vergeet de sleutel', async () => {
    const { call, fake } = setup()
    await call('POST', '/picnic/login', 'token-a', { email: 'piet@example.nl', password: 'geheim' })
    expect((await call('POST', '/picnic/logout', 'token-a')).status).toBe(200)
    expect(((await (await call('GET', '/picnic/status', 'token-a')).json()) as { connected: boolean }).connected).toBe(false)
    expect(fake.state.keys.size).toBe(0)
  })
})

describe('huishoudens zijn gescheiden', () => {
  it('geeft een ander huishouden geen toegang tot de Picnic-koppeling', async () => {
    const { call } = setup()
    await call('POST', '/picnic/login', 'token-a', { email: 'piet@example.nl', password: 'geheim' })

    const status = await call('GET', '/picnic/status', 'token-b')
    expect((await status.json()) as { connected: boolean }).toMatchObject({ connected: false })
    const search = await call('GET', '/picnic/search?q=melk', 'token-b')
    expect(search.status).toBe(409)
    expect(((await search.json()) as { error: string }).error).toBe('picnic_not_connected')
  })

  it('negeert een household-id in het verzoek; het huishouden komt uit de sessie', async () => {
    const { call } = setup()
    await call('POST', '/picnic/login', 'token-a', { email: 'piet@example.nl', password: 'geheim' })
    const res = await call('GET', '/picnic/status?household=household-a', 'token-b', undefined, { 'X-Household-Id': 'household-a' })
    expect(((await res.json()) as { connected: boolean }).connected).toBe(false)
  })
})

describe('zoeken en mandje', () => {
  async function connected() {
    const t = setup()
    await t.call('POST', '/picnic/login', 'token-a', { email: 'piet@example.nl', password: 'geheim' })
    return t
  }

  it('zoekt producten', async () => {
    const { call } = await connected()
    const res = await call('GET', '/picnic/search?q=uien', 'token-a')
    const body = (await res.json()) as { products: Array<{ id: string; name: string }> }
    expect(body.products.map((p) => p.id)).toEqual(['s1001'])
    expect((await call('GET', '/picnic/search', 'token-a')).status).toBe(400)
  })

  it('voegt toe aan het mandje, en een herhaald verzoek voegt niets dubbel toe', async () => {
    const { call, fake } = await connected()
    const body = { requestId: 'req-http-0001', items: [{ productId: 's1001', count: 4 }] }

    const first = await call('POST', '/picnic/cart/add', 'token-a', body)
    expect(first.status).toBe(200)
    expect(((await first.json()) as { replayed: boolean }).replayed).toBe(false)

    const again = await call('POST', '/picnic/cart/add', 'token-a', body)
    expect(((await again.json()) as { replayed: boolean }).replayed).toBe(true)
    expect(fake.state.carts.get('piet@example.nl')?.get('s1001')).toBe(4)

    const cart = (await (await call('GET', '/picnic/cart', 'token-a')).json()) as { cart: { totalCount: number } }
    expect(cart.cart.totalCount).toBe(4)
  })

  it('herstelt na een verloren antwoord zonder dubbel toe te voegen', async () => {
    const { call, fake } = await connected()
    const body = { requestId: 'req-http-0002', items: [{ productId: 's1002', count: 2 }] }
    fake.state.loseResponseOnAdd = 1

    expect((await call('POST', '/picnic/cart/add', 'token-a', body)).status).toBe(502)
    expect((await call('POST', '/picnic/cart/add', 'token-a', body)).status).toBe(200)
    expect(fake.state.carts.get('piet@example.nl')?.get('s1002')).toBe(2)
  })

  it('eist een requestId en geldige aantallen', async () => {
    const { call } = await connected()
    expect((await call('POST', '/picnic/cart/add', 'token-a', { items: [{ productId: 's1001', count: 1 }] })).status).toBe(400)
    expect(
      (await call('POST', '/picnic/cart/add', 'token-a', { requestId: 'req-http-0003', items: [{ productId: 's1001', count: 0 }] })).status,
    ).toBe(400)
  })

  it('vergeet de koppeling als Picnic de sleutel afwijst, en vraagt dan opnieuw inloggen', async () => {
    const { call, fake } = await connected()
    fake.state.keys.clear() // Picnic trekt de sleutel in

    const res = await call('GET', '/picnic/cart', 'token-a')
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toBe('picnic_auth_expired')
    expect(((await (await call('GET', '/picnic/status', 'token-a')).json()) as { connected: boolean }).connected).toBe(false)
  })

  it('verwerkt twee gelijktijdige verzoeken van één huishouden na elkaar', async () => {
    const { call, fake } = await connected()
    const same = { productId: 's1003', count: 1 }
    const [a, b] = await Promise.all([
      call('POST', '/picnic/cart/add', 'token-a', { requestId: 'req-par-000001', items: [same] }),
      call('POST', '/picnic/cart/add', 'token-a', { requestId: 'req-par-000002', items: [same] }),
    ])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(fake.state.carts.get('piet@example.nl')?.get('s1003')).toBe(2)
  })
})
