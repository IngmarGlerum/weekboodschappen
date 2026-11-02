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
  /** Stuurt een inlogcode naar het e-mailadres (en maakt het account bij de eerste keer). */
  requestCode: (email: string) => Promise<void>
  /** Logt in met de code uit de e-mail. Dit verifieert ook het e-mailadres. */
  verifyCode: (email: string, code: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(env.isConfigured)

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

  const requestCode = useCallback(async (email: string) => {
    const { error } = await requireSupabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true },
    })
    if (error) throw error
  }, [])

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await requireSupabase().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'email',
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    // De lokale kopie van de gegevens hoort bij de ingelogde gebruiker en gaat mee weg.
    await db.disconnectAndClear()
    await requireSupabase().auth.signOut()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: env.isConfigured ? 'online' : 'local',
      loading,
      session,
      user: session?.user ?? null,
      requestCode,
      verifyCode,
      signOut,
    }),
    [loading, session, requestCode, verifyCode, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth buiten AuthProvider')
  return value
}
