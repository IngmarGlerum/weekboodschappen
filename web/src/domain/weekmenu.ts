/**
 * Weekmenu's (requirement 12): een opgeslagen week met een gerecht per
 * weekdag. Een weekmenu verwijst naar gerechten en bevat geen kopie.
 */

import { addDays } from './dates'
import type { PlannedDay } from './shoppingList'

export interface MenuDay {
  /** 1 = maandag … 7 = zondag */
  weekday: number
  dishId: string | null
}

/** Zet een weekmenu om naar zeven concrete dagen, vanaf maandag `weekStart`. */
export function menuToWeek(menuDays: MenuDay[], weekStart: string): PlannedDay[] {
  const byWeekday = new Map(menuDays.map((d) => [d.weekday, d.dishId]))
  return Array.from({ length: 7 }, (_, i) => ({
    day: addDays(weekStart, i),
    dishId: byWeekday.get(i + 1) ?? null,
  }))
}

/** Zet een ingevulde week om naar een weekmenu. Alleen de volgorde telt, niet de datum. */
export function weekToMenu(days: PlannedDay[]): MenuDay[] {
  const sorted = [...days].sort((a, b) => a.day.localeCompare(b.day))
  return Array.from({ length: 7 }, (_, i) => ({ weekday: i + 1, dishId: sorted[i]?.dishId ?? null }))
}

export function hasPlannedDishes(days: PlannedDay[]): boolean {
  return days.some((d) => d.dishId !== null)
}

/** Vóór het overschrijven van een lopende week vraagt de app om bevestiging. */
export function needsOverwriteConfirmation(current: PlannedDay[]): boolean {
  return hasPlannedDishes(current)
}
