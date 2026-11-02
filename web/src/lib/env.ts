const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const powersyncUrl = import.meta.env.VITE_POWERSYNC_URL as string | undefined

/**
 * Zonder Supabase- en PowerSync-gegevens draait de app in "lokale modus":
 * geen login, geen synchronisatie, alleen een lokale database op dit apparaat.
 * Handig om te ontwikkelen en om de app eerst uit te proberen.
 */
export const env = {
  supabaseUrl,
  supabaseKey,
  powersyncUrl,
  isConfigured: Boolean(supabaseUrl && supabaseKey && powersyncUrl),
}

/** Het huishouden-id in lokale modus. */
export const LOCAL_HOUSEHOLD_ID = 'lokaal'
