import {
  UpdateType,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
  type PowerSyncDatabase,
} from '@powersync/web'
import type { SupabaseClient } from '@supabase/supabase-js'
import { env } from '../lib/env'

/**
 * Postgres-fouten die opnieuw proberen niet oplost: ongeldige gegevens (22xxx),
 * een schending van een beperking (23xxx, bijvoorbeeld een verwijzing naar een
 * rij die niet bestaat) en geen toegang (42501). Zo'n wijziging wordt
 * weggegooid, anders blijft de wachtrij voor altijd op die ene wijziging staan.
 */
const FATAL_POSTGRES_ERRORS = [/^22...$/, /^23...$/, /^42501$/]

/** SQLite kent geen boolean; PowerSync geeft 0 en 1. Postgres wil true en false. */
const BOOLEAN_COLUMNS = new Set(['is_pantry', 'done', 'missing', 'checked', 'important'])

function toPostgresRow(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data ?? {})) {
    row[key] = BOOLEAN_COLUMNS.has(key) && value !== null ? Boolean(value) : value
  }
  return row
}

function isFatal(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return typeof code === 'string' && FATAL_POSTGRES_ERRORS.some((pattern) => pattern.test(code))
}

/**
 * Verbindt PowerSync met Supabase:
 *  - inloggen bij PowerSync met het token van de Supabase-sessie;
 *  - lokale wijzigingen naar Postgres schrijven zodra er verbinding is.
 *
 * Laatste wijziging wint (requirement 9): elke schrijfactie draagt het
 * `modified_at` van het moment waarop de gebruiker iets wijzigde. De trigger
 * `lww_guard` in Postgres slaat een wijziging over die ouder is dan wat er al
 * staat. Daar hoeft deze code dus niets voor te doen.
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  private readonly supabase: SupabaseClient

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const { data, error } = await this.supabase.auth.getSession()
    if (error) throw error
    const session = data.session
    if (!session) return null
    return {
      endpoint: env.powersyncUrl as string,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    }
  }

  async uploadData(database: PowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction()
    if (!transaction) return

    let lastEntry: CrudEntry | undefined
    try {
      for (const entry of transaction.crud) {
        lastEntry = entry
        const table = this.supabase.from(entry.table)
        let result: { error: unknown }

        switch (entry.op) {
          case UpdateType.PUT:
            // Nieuwe rij. Bestaat hij al (opnieuw verstuurd), dan wordt het een update.
            result = await table.upsert({ ...toPostgresRow(entry.opData), id: entry.id })
            break
          case UpdateType.PATCH:
            result = await table.update(toPostgresRow(entry.opData)).eq('id', entry.id)
            break
          case UpdateType.DELETE:
            // De app verwijdert nooit echt (soft delete), maar voor de volledigheid.
            result = await table.delete().eq('id', entry.id)
            break
        }
        if (result.error) throw result.error
      }
      await transaction.complete()
    } catch (error) {
      if (isFatal(error)) {
        console.error('Wijziging kan niet worden opgeslagen en wordt overgeslagen', lastEntry, error)
        await transaction.complete()
      } else {
        // Tijdelijk probleem (geen verbinding, server niet bereikbaar): later opnieuw.
        throw error
      }
    }
  }
}
