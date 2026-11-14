import { createContext, useContext } from 'react'

interface WeekContextValue {
  /** Maandag van de week waar de gebruiker mee bezig is; gedeeld door Week en Boodschappen. */
  weekStart: string
  setWeekStart: (weekStart: string) => void
}

export const WeekContext = createContext<WeekContextValue | null>(null)

export function useWeek(): WeekContextValue {
  const value = useContext(WeekContext)
  if (!value) throw new Error('useWeek buiten AppShell')
  return value
}

