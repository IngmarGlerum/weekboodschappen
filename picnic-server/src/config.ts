import { resolve } from 'node:path'

export interface Config {
  port: number
  supabaseUrl: string
  supabaseAnonKey: string
  /** Alleen voor Supabase-projecten die nog HS256 gebruiken. */
  supabaseJwtSecret?: string
  /** 32 bytes voor AES-256-GCM. */
  encryptionKey: Buffer
  dataDir: string
  allowedOrigins: string[]
  countryCode: 'NL' | 'DE' | 'FR'
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'PICNIC_ENCRYPTION_KEY'].filter((k) => !env[k])
  if (missing.length > 0) throw new Error(`Ontbrekende instellingen: ${missing.join(', ')}`)

  const encryptionKey = Buffer.from(env.PICNIC_ENCRYPTION_KEY as string, 'base64')
  if (encryptionKey.length !== 32) {
    throw new Error('PICNIC_ENCRYPTION_KEY moet 32 bytes in base64 zijn (openssl rand -base64 32).')
  }

  const country = (env.PICNIC_COUNTRY ?? 'NL').toUpperCase()
  if (country !== 'NL' && country !== 'DE' && country !== 'FR') {
    throw new Error('PICNIC_COUNTRY moet NL, DE of FR zijn.')
  }

  return {
    port: Number(env.PORT ?? 8787),
    supabaseUrl: (env.SUPABASE_URL as string).replace(/\/+$/, ''),
    supabaseAnonKey: env.SUPABASE_ANON_KEY as string,
    supabaseJwtSecret: env.SUPABASE_JWT_SECRET || undefined,
    encryptionKey,
    dataDir: resolve(env.DATA_DIR ?? './data'),
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    countryCode: country,
  }
}
