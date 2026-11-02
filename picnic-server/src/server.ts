import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import type { Authenticator } from './auth.js'
import { addToCart, parseItems } from './cart.js'
import type { Config } from './config.js'
import { HttpError, notConnected, PicnicError } from './errors.js'
import { KeyedMutex } from './mutex.js'
import type { PicnicApi, PicnicApiFactory } from './picnic.js'
import type { Store } from './store.js'

export interface Deps {
  config: Pick<Config, 'allowedOrigins'>
  auth: Authenticator
  store: Store
  picnic: PicnicApiFactory
  /** Hoe lang een halve login (wachten op de SMS-code) openstaat. */
  pendingLoginMs?: number
  now?: () => number
}

type Variables = { householdId: string; userId: string }

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown
    if (typeof body === 'object' && body !== null && !Array.isArray(body)) return body as Record<string, unknown>
  } catch {
    // valt door naar de fout hieronder
  }
  throw new HttpError(400, 'invalid_json', 'Ongeldig verzoek.')
}

const text = (value: unknown, name: string, max = 200): string => {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) {
    throw new HttpError(400, 'invalid_input', `Vul ${name} in.`)
  }
  return value
}

export function createApp(deps: Deps) {
  const { auth, store, picnic } = deps
  const now = deps.now ?? Date.now
  const pendingLoginMs = deps.pendingLoginMs ?? 10 * 60_000
  const mutex = new KeyedMutex()
  // Halve logins (SMS-code onderweg) leven alleen in het geheugen en verlopen vanzelf.
  const pending = new Map<string, { api: PicnicApi; until: number }>()

  const app = new Hono<{ Variables: Variables }>()

  app.use(
    '*',
    cors({
      origin: (origin) => (deps.config.allowedOrigins.includes(origin) ? origin : null),
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    }),
  )
  app.use('*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: 'too_large', message: 'Verzoek te groot.' }, 413) }))

  app.get('/health', (c) => c.json({ ok: true }))

  // Alles onder /picnic vereist een geldige Supabase-sessie van een huishoudenslid.
  app.use('/picnic/*', async (c, next) => {
    const identity = await auth.authenticate(c.req.header('Authorization'))
    c.set('householdId', identity.householdId)
    c.set('userId', identity.userId)
    await next()
  })

  /** Een Picnic-client voor dit huishouden, of een nette fout als er nog niet is ingelogd. */
  function connected(householdId: string): PicnicApi {
    const key = store.getAuthKey(householdId)
    if (!key) throw notConnected()
    return picnic(key)
  }

  /** Voert een Picnic-actie uit en vergeet de sleutel als Picnic zegt dat die verlopen is. */
  async function withPicnic<T>(householdId: string, task: (api: PicnicApi) => Promise<T>): Promise<T> {
    const api = connected(householdId)
    try {
      return await task(api)
    } catch (error) {
      if (error instanceof PicnicError && error.authExpired) store.clearAuthKey(householdId)
      throw error
    }
  }

  app.get('/picnic/status', (c) => {
    const householdId = c.get('householdId')
    const waiting = pending.get(householdId)
    return c.json({
      connected: store.getAuthKey(householdId) !== null,
      secondFactorPending: !!waiting && waiting.until > now(),
    })
  })

  app.post('/picnic/login', async (c) => {
    const householdId = c.get('householdId')
    const body = await readJson(c.req.raw)
    const email = text(body.email, 'je Picnic-e-mailadres')
    const password = text(body.password, 'je Picnic-wachtwoord', 200)

    return mutex.run(householdId, async () => {
      const api = picnic()
      const { secondFactorRequired } = await api.login(email, password)
      if (secondFactorRequired) {
        pending.set(householdId, { api, until: now() + pendingLoginMs })
        return c.json({ status: 'second_factor_required' })
      }
      const key = api.authKey()
      if (!key) throw new PicnicError('picnic_error', 'Picnic gaf geen sleutel terug.')
      store.setAuthKey(householdId, key)
      return c.json({ status: 'connected' })
    })
  })

  app.post('/picnic/verify', async (c) => {
    const householdId = c.get('householdId')
    const body = await readJson(c.req.raw)
    const code = text(body.code, 'de code uit de sms', 20)

    return mutex.run(householdId, async () => {
      const waiting = pending.get(householdId)
      if (!waiting || waiting.until <= now()) {
        pending.delete(householdId)
        throw new HttpError(409, 'no_pending_login', 'Er wacht geen Picnic-login op een code. Begin opnieuw.')
      }
      await waiting.api.verifySecondFactor(code)
      const key = waiting.api.authKey()
      if (!key) throw new PicnicError('picnic_error', 'Picnic gaf geen sleutel terug.')
      pending.delete(householdId)
      store.setAuthKey(householdId, key)
      return c.json({ status: 'connected' })
    })
  })

  app.post('/picnic/logout', async (c) => {
    const householdId = c.get('householdId')
    return mutex.run(householdId, async () => {
      const key = store.getAuthKey(householdId)
      store.clearAuthKey(householdId)
      pending.delete(householdId)
      if (key) {
        try {
          await picnic(key).logout()
        } catch {
          // De sleutel is hier al weg; dat Picnic hem niet kon intrekken is niet erg.
        }
      }
      return c.json({ status: 'disconnected' })
    })
  })

  app.get('/picnic/search', async (c) => {
    const householdId = c.get('householdId')
    const query = text(c.req.query('q'), 'een zoekterm', 100)
    const limit = Math.min(20, Math.max(1, Number(c.req.query('limit') ?? 8) || 8))
    const products = await withPicnic(householdId, (api) => api.search(query, limit))
    return c.json({ products })
  })

  app.get('/picnic/cart', async (c) => {
    const householdId = c.get('householdId')
    const cart = await withPicnic(householdId, (api) => api.getCart())
    return c.json({ cart })
  })

  app.post('/picnic/cart/add', async (c) => {
    const householdId = c.get('householdId')
    const body = await readJson(c.req.raw)
    const requestId = body.requestId
    if (typeof requestId !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(requestId)) {
      throw new HttpError(400, 'invalid_request_id', 'Stuur een requestId van 8 tot 64 letters, cijfers of streepjes mee.')
    }
    const items = parseItems(body.items)

    // Per huishouden na elkaar: twee telefoons tegelijk mogen elkaars telling niet verstoren.
    const result = await mutex.run(householdId, () =>
      withPicnic(householdId, (api) => addToCart({ api, store }, householdId, requestId, items)),
    )
    return c.json(result)
  })

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json({ error: error.code, message: error.message }, error.status as 400)
    }
    console.error('onverwachte fout', error)
    return c.json({ error: 'internal', message: 'Er ging iets mis op de server.' }, 500)
  })

  app.notFound((c) => c.json({ error: 'not_found', message: 'Onbekend adres.' }, 404))

  return app
}
