import { PowerSyncDatabase } from '@powersync/web'
import { AppSchema } from './schema'

/**
 * De lokale database op dit apparaat. Het scherm leest en schrijft hier altijd
 * naartoe, ook zonder internet (requirement 9). PowerSync synchroniseert op
 * de achtergrond met Supabase.
 *
 * Maak per bestand maar één instantie.
 */
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'weekplanner.db' },
})
