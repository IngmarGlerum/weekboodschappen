import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { env } from '../lib/env'
import { requireSupabase, supabase } from '../lib/supabase'
import { db } from '../powersync/db'

interface AuthContextValue {
  /** `local`: Supabase is niet ingesteld, de app draait alleen op dit apparaat. */
  mode: 'local' | 'online'
  loading: boolean
  session: Session | null
  user: User | null
  /**
   * Stuurt een code naar het e-mailadres. `signup` maakt een nieuw account;
   * `reset` werkt alleen voor een bestaand account (wachtwoord vergeten).
   */
  requestCode: (email: string, purpose: CodePurpose) => Promise<void>
  /** Logt in met de code uit de e-mail. Dit verifieert ook het e-mailadres. Daarna kies je een wachtwoord. */
  verifyCode: (email: string, code: string) => Promise<void>
  /** Gewoon inloggen met e-mailadres en wachtwoord. */
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Wachtwoord instellen of wijzigen voor de ingelogde gebruiker. */
  setPassword: (password: string) => Promise<void>
  /**
   * Waar: de gebruiker is ingelogd met een code, maar heeft (nog) geen nieuw
   * wachtwoord gekozen. De app vraagt dan eerst om een wachtwoord.
   */
  needsPassword: boolean
  signOut: () => Promise<void>
}

export type CodePurpose = 'signup' | 'reset'

const AuthContext = createContext<AuthContextValue | null>(null)

/** Onthoudt (alleen in dit tabblad) dat er na een code nog een wachtwoord gekozen moet worden. */
const RESET_KEY = 'weekplanner.passwordReset'
const readReset = () => {
  try {
    return sessionStorage.getItem(RESET_KEY) === '1'
  } catch {
    return false
  }
}
const writeReset = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(RESET_KEY, '1')
    else sessionStorage.removeItem(RESET_KEY)
  } catch {
    // Geen opslag: dan vraagt de app na herladen niet opnieuw om het wachtwoord.
  }
}

export const MIN_PASSWORD_LENGTH = 8

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(env.isConfigured)
  const [resetPending, setResetPending] = useState(readReset)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const requestCode = useCallback(async (email: string, purpose: CodePurpose) => {
    const { error } = await requireSupabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      // Bij "wachtwoord vergeten" nooit per ongeluk een nieuw account maken (tikfout in het adres).
      options: { shouldCreateUser: purpose === 'signup' },
    })
    if (error) throw error
  }, [])

  const verifyCode = useCallback(async (email: string, code: string) => {
    // Eerst markeren, zodat de app meteen om een wachtwoord vraagt zodra de sessie er is.
    writeReset(true)
    setResetPending(true)
    const { error } = await requireSupabase().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    if (error) {
      writeReset(false)
      setResetPending(false)
      throw error
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await requireSupabase().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
  }, [])

  const setPassword = useCallback(async (password: string) => {
    if (password.length < MIN_PASSWORD_LENGTH) throw new Error('weak_password')
    const { error } = await requireSupabase().auth.updateUser({ password, data: { has_password: true } })
    if (error) throw error
    writeReset(false)
    setResetPending(false)
  }, [])

  const signOut = useCallback(async () => {
    writeReset(false)
    setResetPending(false)
    // De lokale kopie van de gegevens hoort bij de ingelogde gebruiker en gaat mee weg.
    await db.disconnectAndClear()
    await requireSupabase().auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null
    // Oudere accounts (alleen met code ingelogd) krijgen zo ook één keer de vraag om een wachtwoord.
    const hasPassword = user?.user_metadata?.has_password === true
    return {
      mode: env.isConfigured ? 'online' : 'local',
      loading,
      session,
      user,
      requestCode,
      verifyCode,
      signInWithPassword,
      setPassword,
      needsPassword: user !== null && (resetPending || !hasPassword),
      signOut,
    }
  }, [loading, session, resetPending, requestCode, verifyCode, signInWithPassword, setPassword, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth buiten AuthProvider')
  return value
}
