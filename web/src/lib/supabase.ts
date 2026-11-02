import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

/** `null` in lokale modus. */
export const supabase: SupabaseClient | null = env.isConfigured
  ? createClient(env.supabaseUrl as string, env.supabaseKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // We loggen in met een code uit de e-mail, niet met een link.
        detectSessionInUrl: false,
      },
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase is niet ingesteld (lokale modus)')
  return supabase
}
