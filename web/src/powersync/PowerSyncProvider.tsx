import { PowerSyncContext } from '@powersync/react'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { useHousehold } from '../auth/HouseholdProvider'
import { env } from '../lib/env'
import { supabase } from '../lib/supabase'
import { SupabaseConnector } from './connector'
import { db } from './db'

/**
 * Stelt de lokale database beschikbaar en houdt de verbinding met PowerSync
 * in stand zolang er een ingelogde gebruiker met een huishouden is.
 * In lokale modus (geen Supabase) blijft de database gewoon lokaal.
 */
export function PowerSyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { household } = useHousehold()
  const userId = session?.user.id
  const householdId = household?.id

  useEffect(() => {
    if (!env.isConfigured || !supabase || !userId || !householdId) return
    void db.connect(new SupabaseConnector(supabase))
    return () => {
      void db.disconnect()
    }
  }, [userId, householdId])

  return <PowerSyncContext.Provider value={db}>{children}</PowerSyncContext.Provider>
}
