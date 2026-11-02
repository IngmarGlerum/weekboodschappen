import { describe, expect, it } from 'vitest'
import { addDays, isoWeekNumber, startOfWeek, weekDates, weekdayNumber } from './dates'
import { hasPlannedDishes, menuToWeek, needsOverwriteConfirmation, weekToMenu } from './weekmenu'

describe('requirement 12: weekmenu naar week en terug', () => {
  const menu = [
    { weekday: 1, dishId: 'spaghetti' },
    { weekday: 3, dishId: 'nasi' },
  ]

  it('zet een weekmenu om naar zeven dagen vanaf maandag', () => {
    const week = menuToWeek(menu, '2026-11-02')
    expect(week).toHaveLength(7)
    expect(week[0]).toEqual({ day: '2026-11-02', dishId: 'spaghetti' })
    expect(week[1]).toEqual({ day: '2026-11-03', dishId: null })
    expect(week[2]).toEqual({ day: '2026-11-04', dishId: 'nasi' })
    expect(week[6].day).toBe('2026-11-08')
  })

  it('bewaart een ingevulde week als weekmenu op volgorde van dag', () => {
    const saved = weekToMenu([
      { day: '2026-11-04', dishId: 'nasi' },
      { day: '2026-11-02', dishId: 'spaghetti' },
      { day: '2026-11-03', dishId: null },
    ])
    expect(saved).toHaveLength(7)
    expect(saved[0]).toEqual({ weekday: 1, dishId: 'spaghetti' })
    expect(saved[2]).toEqual({ weekday: 3, dishId: 'nasi' })
    expect(saved[6]).toEqual({ weekday: 7, dishId: null })
  })

  it('geeft hetzelfde terug na opslaan en opnieuw kiezen', () => {
    const week = menuToWeek(menu, '2026-11-09')
    expect(weekToMenu(week).filter((d) => d.dishId)).toEqual(menu)
  })

  it('vraagt om bevestiging als er al een lopende week met gerechten staat', () => {
    expect(needsOverwriteConfirmation(menuToWeek(menu, '2026-11-02'))).toBe(true)
    expect(needsOverwriteConfirmation(menuToWeek([], '2026-11-02'))).toBe(false)
    expect(hasPlannedDishes([{ day: '2026-11-02', dishId: null }])).toBe(false)
  })
})

describe('datums', () => {
  it('vindt de maandag van een week', () => {
    expect(startOfWeek('2026-11-02')).toBe('2026-11-02') // maandag
    expect(startOfWeek('2026-11-08')).toBe('2026-11-02') // zondag
    expect(startOfWeek('2026-11-04')).toBe('2026-11-02')
  })

  it('rekent over een maand- en jaarwisseling heen', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(weekDates('2026-12-28')[6]).toBe('2027-01-03')
  })

  it('telt weekdagen vanaf maandag = 1', () => {
    expect(weekdayNumber('2026-11-02')).toBe(1)
    expect(weekdayNumber('2026-11-08')).toBe(7)
  })

  it('berekent het ISO-weeknummer', () => {
    expect(isoWeekNumber('2026-11-02')).toBe(45)
    expect(isoWeekNumber('2027-01-01')).toBe(53)
    expect(isoWeekNumber('2026-01-01')).toBe(1)
  })
})
