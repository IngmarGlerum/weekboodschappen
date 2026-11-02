/**
 * Datumhulp op basis van lokale kalenderdata als "YYYY-MM-DD"-tekst.
 * De week begint op maandag. Er wordt bewust niet met tijdzones gerekend:
 * een dag is een dag, waar je ook bent.
 */

const WEEKDAYS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'] as const
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'] as const

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

/** Maandag van de week waarin de datum valt. */
export function startOfWeek(iso: string): string {
  const d = parseISODate(iso)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toISODate(d)
}

/** De zeven datums van een week, maandag eerst. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
}

/** Naam van de weekdag, 1 = maandag … 7 = zondag. */
export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday - 1] ?? ''
}

/** 1 = maandag … 7 = zondag. */
export function weekdayNumber(iso: string): number {
  return ((parseISODate(iso).getDay() + 6) % 7) + 1
}

/** "3 nov" */
export function formatDayMonth(iso: string): string {
  const d = parseISODate(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** ISO-weeknummer (de week met de eerste donderdag is week 1). */
export function isoWeekNumber(iso: string): number {
  const d = parseISODate(iso)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)) // donderdag van deze week
  const week1 = new Date(d.getFullYear(), 0, 4)
  const diffDays = (d.getTime() - week1.getTime()) / 86_400_000
  return 1 + Math.round((diffDays - 3 + ((week1.getDay() + 6) % 7)) / 7)
}
