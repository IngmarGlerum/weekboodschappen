import { SignJWT } from 'jose'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseAuthenticator } from '../src/auth.js'

const URL_ = 'https://proj.supabase.co'
const SECRET = 'een-geheim-van-minstens-32-tekens-lang!!'
const key = new TextEncoder().encode(SECRET)

const token = (claims: { sub?: string; aud?: string; iss?: string; exp?: string | number; secret?: Uint8Array } = {}) =>
  new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub ?? 'user-1')
    .setAudience(claims.aud ?? 'authenticated')
    .setIssuer(claims.iss ?? `${URL_}/auth/v1`)
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? '1h')
    .sign(claims.secret ?? key)

const rows = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }))

function authenticator(fetchImpl: ReturnType<typeof rows>, secret: string | null = SECRET, now = () => Date.now()) {
  return createSupabaseAuthenticator(
    { supabaseUrl: URL_, supabaseAnonKey: 'anon', supabaseJwtSecret: secret ?? undefined },
    fetchImpl,
    now,
  )
}

describe('Supabase-authenticatie', () => {
  it('geeft gebruiker en huishouden terug bij een geldige sessie van een lid', async () => {
    const fetchImpl = rows([{ household_id: 'h-1' }])
    const t = await token()
    const identity = await authenticator(fetchImpl).authenticate(`Bearer ${t}`)
    expect(identity).toEqual({ userId: 'user-1', householdId: 'h-1' })
    // Het huishouden wordt met de JWT van de gebruiker opgevraagd, zodat Supabase (RLS) beslist.
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${t}`)
  })

  it('weigert een verzoek zonder token', async () => {
    await expect(authenticator(rows([])).authenticate(undefined)).rejects.toMatchObject({ status: 401, code: 'missing_token' })
  })

  it.each([
    ['verkeerde handtekening', () => token({ secret: new TextEncoder().encode('een-heel-ander-geheim-van-32-tekens!!') })],
    ['verkeerde audience', () => token({ aud: 'anon' })],
    ['verkeerde uitgever', () => token({ iss: 'https://evil.example/auth/v1' })],
    ['verlopen token', () => token({ exp: Math.floor(Date.now() / 1000) - 60 })],
  ])('weigert %s', async (_name, make) => {
    const fetchImpl = rows([{ household_id: 'h-1' }])
    await expect(authenticator(fetchImpl).authenticate(`Bearer ${await make()}`)).rejects.toMatchObject({
      status: 401,
      code: 'invalid_token',
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('weigert een HS256-token als er geen secret is ingesteld', async () => {
    await expect(authenticator(rows([]), null).authenticate(`Bearer ${await token()}`)).rejects.toMatchObject({
      status: 401,
    })
  })

  it('weigert (403) iemand die bij geen enkel huishouden hoort', async () => {
    await expect(authenticator(rows([])).authenticate(`Bearer ${await token()}`)).rejects.toMatchObject({
      status: 403,
      code: 'no_household',
    })
  })

  it('weigert als Supabase de sessie niet accepteert', async () => {
    await expect(authenticator(rows({}, 401)).authenticate(`Bearer ${await token()}`)).rejects.toMatchObject({ status: 401 })
  })

  it('onthoudt het huishouden een minuut', async () => {
    let clock = 1_000_000
    const fetchImpl = rows([{ household_id: 'h-1' }])
    const auth = authenticator(fetchImpl, SECRET, () => clock)
    const header = `Bearer ${await token()}`
    await auth.authenticate(header)
    await auth.authenticate(header)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    clock += 61_000
    await auth.authenticate(header)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
