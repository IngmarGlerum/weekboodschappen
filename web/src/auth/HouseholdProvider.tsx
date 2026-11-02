import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { env, LOCAL_HOUSEHOLD_ID } from '../lib/env'
import { describeError } from '../lib/errors'
import { requireSupabase, supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'

export interface Household {
  id: string
  name: string
}

interface HouseholdContextValue {
  household: Household | null
  loading: boolean
  /** Alleen gevuld als het huishouden niet geladen kon worden en er ook geen kopie op dit apparaat is. */
  error: string | null
  refresh: () => Promise<void>
  createHousehold: (name: string) => Promise<void>
  acceptInvitation: (invitationId: string) => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

const LOCAL_HOUSEHOLD: Household = { id: LOCAL_HOUSEHOLD_ID, name: 'Dit apparaat' }
const cacheKey = (userId: string) => `weekplanner.household.${userId}`

function readCache(userId: string): Household | null {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    return raw ? (JSON.parse(raw) as Household) : null
  } catch {
    return null
  }
}

function writeCache(userId: string, household: Household | null) {
  try {
    if (household) localStorage.setItem(cacheKey(userId), JSON.stringify(household))
    else localStorage.removeItem(cacheKey(userId))
  } catch {
    // Opslag kan geblokkeerd zijn; de app werkt dan gewoon door zonder kopie.
  }
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const [household, setHousehold] = useState<Household | null>(mode === 'local' ? LOCAL_HOUSEHOLD : null)
  const [loading, setLoading] = useState(mode === 'online')
  const [error, setError] = useState<string | null>(null)
  const userId = user?.id ?? null

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    const cached = readCache(userId)
    if (cached) setHousehold(cached)
    try {
      const { data, error: queryError } = await supabase
        .from('household_members')
        .select('household_id, households ( id, name )')
        .limit(1)
      if (queryError) throw queryError
      const row = data?.[0] as { households: unknown } | undefined
      const joined = Array.isArray(row?.households) ? row?.households[0] : row?.households
      const found = joined as Household | undefined | null
      const next = found ? { id: found.id, name: found.name } : null
      setHousehold(next)
      writeCache(userId, next)
      setError(null)
    } catch (e) {
      // Offline: de kopie van de vorige keer is goed genoeg om door te werken.
      if (!cached) setError(describeError(e))
    }
  }, [userId])

  useEffect(() => {
    if (mode === 'local') return
    if (!userId) {
      setHousehold(null)
      setLoading(false)
      return
    }
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [mode, userId, load])

  const createHousehold = useCallback(
    async (name: string) => {
      const { error: rpcError } = await requireSupabase().rpc('create_household', { p_name: name })
      if (rpcError) throw rpcError
      await load()
    },
    [load],
  )

  const acceptInvitation = useCallback(
    async (invitationId: string) => {
      const { error: rpcError } = await requireSupabase().rpc('accept_invitation', { p_id: invitationId })
      if (rpcError) throw rpcError
      await load()
    },
    [load],
  )

  const value = useMemo<HouseholdContextValue>(
    () => ({
      household: env.isConfigured ? household : LOCAL_HOUSEHOLD,
      loading,
      error,
      refresh: load,
      createHousehold,
      acceptInvitation,
    }),
    [household, loading, error, load, createHousehold, acceptInvitation],
  )

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold(): HouseholdContextValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold buiten HouseholdProvider')
  return value
}

/** Het huishouden waarmee gewerkt wordt; alleen binnen schermen die al een huishouden eisen. */
export function useCurrentHousehold(): Household {
  const { household } = useHousehold()
  if (!household) throw new Error('Geen huishouden')
  return household
}
