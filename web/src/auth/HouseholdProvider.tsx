import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { env, LOCAL_HOUSEHOLD_ID } from '../lib/env'
import { describeError } from '../lib/errors'
import { requireSupabase, supabase } from '../lib/supabase'
import { db } from '../powersync/db'
import { useAuth } from './AuthProvider'

/**
 * Een planning. In de database heet dit een huishouden (`households`); een
 * account kan bij meerdere planningen horen en kiest er per apparaat één.
 */
export interface Household {
  id: string
  name: string
  /** Kleine foto als data-URL, of null. */
  avatar: string | null
}

interface HouseholdContextValue {
  /** De gekozen planning, of null als je nog bij geen enkele hoort. */
  household: Household | null
  /** Alle planningen waar je lid van bent, op naam. */
  households: Household[]
  loading: boolean
  /** Alleen gevuld als de planningen niet geladen konden worden en er ook geen kopie op dit apparaat is. */
  error: string | null
  refresh: () => Promise<void>
  /** Kies een planning op dit apparaat. */
  selectHousehold: (id: string) => void
  /** Maakt een planning en kiest hem meteen. */
  createHousehold: (name: string) => Promise<void>
  /** Accepteert een uitnodiging en kiest die planning meteen. */
  acceptInvitation: (invitationId: string) => Promise<void>
  /** Naam en/of foto wijzigen. `avatar: null` haalt de foto weg. */
  updateHousehold: (id: string, patch: { name?: string; avatar?: string | null }) => Promise<void>
  leaveHousehold: (id: string) => Promise<void>
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

const LOCAL_HOUSEHOLD: Household = { id: LOCAL_HOUSEHOLD_ID, name: 'Dit apparaat', avatar: null }
const listKey = (userId: string) => `weekplanner.households.${userId}`
const activeKey = (userId: string) => `weekplanner.activeHousehold.${userId}`

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Opslag kan geblokkeerd zijn; de app werkt dan gewoon door zonder kopie.
  }
}

const byName = (a: Household, b: Household) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' })

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { mode, user } = useAuth()
  const userId = user?.id ?? null
  const [households, setHouseholds] = useState<Household[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // Voor welke gebruiker de lijst geladen is. Zo is "laden" meteen waar zodra er
  // een gebruiker is, en stuurt de app niet eerst even naar /start.
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loading = mode === 'online' && userId !== null && loadedFor !== userId

  const choose = useCallback(
    (id: string | null) => {
      setActiveId(id)
      if (userId) write(activeKey(userId), id)
    },
    [userId],
  )

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    const cached = read<Household[]>(listKey(userId))
    if (cached) setHouseholds(cached)
    try {
      const { data, error: queryError } = await supabase
        .from('household_members')
        .select('household_id, households ( id, name, avatar )')
        .eq('user_id', userId)
      if (queryError) throw queryError
      const next = (data ?? [])
        .map((row) => {
          const joined = (row as { households: unknown }).households
          return (Array.isArray(joined) ? joined[0] : joined) as Household | null
        })
        .filter((h): h is Household => Boolean(h))
        .map((h) => ({ id: h.id, name: h.name, avatar: h.avatar ?? null }))
        .sort(byName)
      setHouseholds(next)
      write(listKey(userId), next)
      setError(null)
    } catch (e) {
      // Offline: de kopie van de vorige keer is goed genoeg om door te werken.
      if (!cached) setError(describeError(e))
    }
  }, [userId])

  useEffect(() => {
    if (mode === 'local') return
    if (!userId) {
      setHouseholds([])
      setActiveId(null)
      setLoadedFor(null)
      return
    }
    setActiveId(read<string>(activeKey(userId)))
    // Met een kopie op dit apparaat kan de app meteen door; de verse lijst volgt.
    const cached = read<Household[]>(listKey(userId))
    if (cached) {
      setHouseholds(cached)
      setLoadedFor(userId)
    }
    void load().finally(() => setLoadedFor(userId))
  }, [mode, userId, load])

  // Naam en foto die de ander wijzigt komen via PowerSync binnen; neem ze over.
  useEffect(() => {
    if (mode === 'local' || !userId) return
    const controller = new AbortController()
    db.watch(
      'SELECT id, name, avatar FROM households',
      [],
      {
        onResult: (result) => {
          const rows = (result.rows?._array ?? []) as Household[]
          if (rows.length === 0) return
          const fresh = new Map(rows.map((r) => [r.id, r]))
          setHouseholds((current) => {
            let changed = false
            const next = current.map((h) => {
              const r = fresh.get(h.id)
              if (!r || (r.name === h.name && (r.avatar ?? null) === h.avatar)) return h
              changed = true
              return { ...h, name: r.name, avatar: r.avatar ?? null }
            })
            if (!changed) return current
            next.sort(byName)
            write(listKey(userId), next)
            return next
          })
        },
      },
      { signal: controller.signal },
    )
    return () => controller.abort()
  }, [mode, userId])

  const createHousehold = useCallback(
    async (name: string) => {
      const { data, error: rpcError } = await requireSupabase().rpc('create_household', { p_name: name })
      if (rpcError) throw rpcError
      await load()
      choose(data as string)
    },
    [load, choose],
  )

  const acceptInvitation = useCallback(
    async (invitationId: string) => {
      const { data, error: rpcError } = await requireSupabase().rpc('accept_invitation', { p_id: invitationId })
      if (rpcError) throw rpcError
      await load()
      choose(data as string)
    },
    [load, choose],
  )

  const updateHousehold = useCallback(
    async (id: string, patch: { name?: string; avatar?: string | null }) => {
      const { error: rpcError } = await requireSupabase().rpc('update_household', {
        p_id: id,
        p_name: patch.name ?? null,
        // null = niet wijzigen, '' = weghalen
        p_avatar: patch.avatar === undefined ? null : (patch.avatar ?? ''),
      })
      if (rpcError) throw rpcError
      await load()
    },
    [load],
  )

  const leaveHousehold = useCallback(
    async (id: string) => {
      const { error: rpcError } = await requireSupabase().rpc('leave_household', { p_id: id })
      if (rpcError) throw rpcError
      if (activeId === id) choose(null)
      await load()
    },
    [load, choose, activeId],
  )

  const value = useMemo<HouseholdContextValue>(() => {
    if (!env.isConfigured) {
      return {
        household: LOCAL_HOUSEHOLD,
        households: [LOCAL_HOUSEHOLD],
        loading: false,
        error: null,
        refresh: async () => {},
        selectHousehold: () => {},
        createHousehold: async () => {},
        acceptInvitation: async () => {},
        updateHousehold: async () => {},
        leaveHousehold: async () => {},
      }
    }
    const household = households.find((h) => h.id === activeId) ?? households[0] ?? null
    return {
      household,
      households,
      loading,
      error,
      refresh: load,
      selectHousehold: choose,
      createHousehold,
      acceptInvitation,
      updateHousehold,
      leaveHousehold,
    }
  }, [households, activeId, loading, error, load, choose, createHousehold, acceptInvitation, updateHousehold, leaveHousehold])

  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>
}

export function useHousehold(): HouseholdContextValue {
  const value = useContext(HouseholdContext)
  if (!value) throw new Error('useHousehold buiten HouseholdProvider')
  return value
}

/** De planning waarmee gewerkt wordt; alleen binnen schermen die al een planning eisen. */
export function useCurrentHousehold(): Household {
  const { household } = useHousehold()
  if (!household) throw new Error('Geen planning')
  return household
}
