import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose'
import type { Config } from './config.js'
import { AuthError } from './errors.js'

export interface Identity {
  userId: string
  householdId: string
}

export interface Authenticator {
  authenticate(authorization: string | undefined): Promise<Identity>
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Controleert de inlogsessie van Supabase (de JWT die de web-app meestuurt) en zoekt het
 * huishouden van de gebruiker op. Het huishouden komt NOOIT uit het verzoek zelf: we vragen
 * het aan Supabase met de JWT van de gebruiker, dus de rijbeveiliging (RLS) beslist.
 */
export function createSupabaseAuthenticator(
  config: Pick<Config, 'supabaseUrl' | 'supabaseAnonKey' | 'supabaseJwtSecret'>,
  fetchImpl: FetchLike = fetch,
  now: () => number = Date.now,
): Authenticator {
  const issuer = `${config.supabaseUrl}/auth/v1`
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  const secret = config.supabaseJwtSecret ? new TextEncoder().encode(config.supabaseJwtSecret) : null
  const cache = new Map<string, { householdId: string; until: number }>()

  async function verify(token: string): Promise<string> {
    try {
      const { alg } = decodeProtectedHeader(token)
      let subject: string | undefined
      if (alg === 'HS256') {
        if (!secret) throw new Error('HS256 zonder ingestelde secret')
        subject = (await jwtVerify(token, secret, { issuer, audience: 'authenticated', algorithms: ['HS256'] })).payload.sub
      } else {
        subject = (
          await jwtVerify(token, jwks, { issuer, audience: 'authenticated', algorithms: ['RS256', 'ES256', 'EdDSA'] })
        ).payload.sub
      }
      if (!subject) throw new Error('geen gebruiker in token')
      return subject
    } catch {
      throw new AuthError(401, 'invalid_token', 'Je sessie is ongeldig of verlopen. Log opnieuw in.')
    }
  }

  async function householdOf(userId: string, token: string): Promise<string> {
    const hit = cache.get(`${userId}`)
    if (hit && hit.until > now()) return hit.householdId

    let response: Response
    try {
      response = await fetchImpl(`${config.supabaseUrl}/rest/v1/household_members?select=household_id&limit=1`, {
        headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
      })
    } catch {
      throw new AuthError(401, 'supabase_unreachable', 'Supabase is niet bereikbaar.')
    }
    if (!response.ok) throw new AuthError(401, 'invalid_token', 'Je sessie is ongeldig of verlopen. Log opnieuw in.')
    const rows = (await response.json()) as Array<{ household_id: string }>
    const householdId = rows[0]?.household_id
    if (!householdId) throw new AuthError(403, 'no_household', 'Dit account hoort nog bij geen huishouden.')
    cache.set(userId, { householdId, until: now() + 60_000 })
    return householdId
  }

  return {
    async authenticate(authorization) {
      const match = /^Bearer (.+)$/i.exec(authorization ?? '')
      if (!match) throw new AuthError(401, 'missing_token', 'Log eerst in.')
      const token = match[1]
      const userId = await verify(token)
      return { userId, householdId: await householdOf(userId, token) }
    },
  }
}
