import { describe, expect, it } from 'vitest'
import { initials } from './avatar'

describe('initials', () => {
  it('neemt de eerste en laatste beginletter', () => {
    expect(initials('Onze weekplanning')).toBe('OW')
    expect(initials('Familie de Vries')).toBe('FV')
  })

  it("laat 's weg", () => {
    expect(initials("Henk's weekmenu")).toBe('HW')
    expect(initials('Henk’s')).toBe('H')
  })

  it('werkt met één woord, leestekens en lege namen', () => {
    expect(initials('werk')).toBe('W')
    expect(initials('  (thuis)  ')).toBe('T')
    expect(initials('')).toBe('?')
    expect(initials('🍝 Pasta')).toBe('P')
  })
})
