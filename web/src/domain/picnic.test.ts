import { describe, expect, it } from 'vitest'
import { formatPrice, parseUnitQuantity, productRef, searchTermFor, suggestCount } from './picnic'

describe('verpakking lezen', () => {
  it.each([
    ['1 kg', 1000, 'g'],
    ['500 gram', 500, 'g'],
    ['1,5 liter', 1500, 'ml'],
    ['6 x 300 ml', 1800, 'ml'],
    ['9 rollen, In prijs verlaagd', 9, 'stuks'],
    ['per stuk', 1, 'stuks'],
    ['4 stuks', 4, 'stuks'],
    ['250 g', 250, 'g'],
    ['2 x 4 stuks', 8, 'stuks'],
  ])('%s', (text, amount, dimension) => {
    expect(parseUnitQuantity(text)).toEqual({ amount, dimension })
  })

  it('onleesbaar of leeg', () => {
    expect(parseUnitQuantity('')).toBeNull()
    expect(parseUnitQuantity(null)).toBeNull()
    expect(parseUnitQuantity('voordeelpak')).toBeNull()
  })
})

describe('aantal uitrekenen', () => {
  it('500 g gehakt met een pak van 300 g: 2 pakken', () => {
    expect(suggestCount([{ amount: 500, unit: 'g' }], '300 gram')).toBe(2)
  })
  it('precies genoeg: 1', () => {
    expect(suggestCount([{ amount: 1, unit: 'kg' }], '1000 g')).toBe(1)
  })
  it('stuks: 4 uien met een net van 1 kg kan niet: 1', () => {
    expect(suggestCount([{ amount: 4, unit: '' }], '1 kg')).toBe(1)
  })
  it('stuks: 8 eieren met een doos van 6: 2', () => {
    expect(suggestCount([{ amount: 8, unit: '' }], '6 eieren')).toBe(2)
  })
  it('liter en ml door elkaar', () => {
    expect(suggestCount([{ amount: 750, unit: 'ml' }, { amount: 1, unit: 'l' }], '1,5 liter')).toBe(2)
  })
  it('geen hoeveelheid, onbekende eenheid of geen verpakking: 1', () => {
    expect(suggestCount([], '1 kg')).toBe(1)
    expect(suggestCount([{ amount: null, unit: '' }], '1 kg')).toBe(1)
    expect(suggestCount([{ amount: 2, unit: 'el' }], '500 ml')).toBe(1)
    expect(suggestCount([{ amount: 2, unit: 'g' }], null)).toBe(1)
  })
  it('hooguit 99', () => {
    expect(suggestCount([{ amount: 100, unit: 'kg' }], '100 g')).toBe(99)
  })
})

describe('sleutel van een artikel', () => {
  it('extra op naam, de rest op de eigen sleutel', () => {
    expect(productRef({ refType: 'extra', refKey: 'x-123', name: ' Taart ' })).toEqual({ refType: 'extra', refKey: 'taart' })
    expect(productRef({ refType: 'ingredient', refKey: 'uien', name: 'uien' })).toEqual({ refType: 'ingredient', refKey: 'uien' })
    expect(productRef({ refType: 'general', refKey: 'g-1', name: 'koffie' })).toEqual({ refType: 'general', refKey: 'g-1' })
  })
})

it('prijs', () => {
  expect(formatPrice(129)).toBe('€ 1,29')
  expect(formatPrice(null)).toBe('')
})

describe('zoekterm voor Picnic', () => {
  it.each([
    ['Wokgroenten 600gr', 'Wokgroenten'],
    ['Halfvolle melk 1,5 liter', 'Halfvolle melk'],
    ['Cola 6 x 330 ml', 'Cola'],
    ['Eieren 10 stuks', 'Eieren'],
    ['uien', 'uien'],
    ['7up', '7up'],
    ['500 g', '500 g'],
  ])('%s → %s', (name, term) => {
    expect(searchTermFor(name)).toBe(term)
  })
})
