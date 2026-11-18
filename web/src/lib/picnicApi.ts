import { env } from './env'
import { supabase } from './supabase'

/**
 * Praat met onze eigen Picnic-server (picnic-server/). Die logt in bij Picnic,
 * zoekt producten en vult het mandje. De app stuurt de inlogsessie van Supabase
 * mee en zegt om welke planning het gaat; de server controleert dat je lid bent.
 */

export interface PicnicProduct {
  id: string
  name: string
  brand: string | null
  unitQuantity: string
  priceCents: number
  unavailable: boolean
  imageUrl: string | null
}

export interface PicnicCart {
  totalCount: number
  totalPriceCents: number
  items: Array<{ productId: string; name: string; quantity: number }>
}

export interface PicnicStatus {
  connected: boolean
  secondFactorPending: boolean
}

export class PicnicApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'PicnicApiError'
    this.code = code
    this.status = status
  }
}

export const picnicConfigured = () => Boolean(env.picnicUrl) && Boolean(supabase)

async function call<T>(householdId: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!env.picnicUrl || !supabase) throw new PicnicApiError('not_configured', 'De Picnic-koppeling is niet ingesteld.', 0)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new PicnicApiError('missing_token', 'Log eerst in.', 401)

  let response: Response
  try {
    response = await fetch(`${env.picnicUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Household-Id': householdId,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new PicnicApiError('unreachable', 'De Picnic-server is niet bereikbaar. Ben je online?', 0)
  }
  const json = (await response.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!response.ok) {
    throw new PicnicApiError(json.error ?? 'error', json.message ?? `De Picnic-server gaf een fout (${response.status}).`, response.status)
  }
  return json as T
}

export const picnicApi = {
  status: (hid: string) => call<PicnicStatus>(hid, 'GET', '/picnic/status'),
  login: (hid: string, email: string, password: string) =>
    call<{ status: 'connected' | 'second_factor_required' }>(hid, 'POST', '/picnic/login', { email, password }),
  verify: (hid: string, code: string) => call<{ status: 'connected' }>(hid, 'POST', '/picnic/verify', { code }),
  logout: (hid: string) => call<{ status: 'disconnected' }>(hid, 'POST', '/picnic/logout'),
  search: async (hid: string, query: string) =>
    (await call<{ products: PicnicProduct[] }>(hid, 'GET', `/picnic/search?q=${encodeURIComponent(query)}&limit=12`)).products,
  cart: async (hid: string) => (await call<{ cart: PicnicCart }>(hid, 'GET', '/picnic/cart')).cart,
  addToCart: (hid: string, requestId: string, items: Array<{ productId: string; count: number }>) =>
    call<{
      requestId: string
      replayed: boolean
      outcomes: Array<{ productId: string; requested: number; added: number; alreadyThere: number }>
      cart: PicnicCart
    }>(hid, 'POST', '/picnic/cart/add', { requestId, items }),
}
