import { describe, expect, it } from 'vitest'
import {
  buildShoppingList,
  formatLabel,
  shoppingListToText,
  type ShoppingListInput,
} from './shoppingList'

const ui = { id: 'i-ui', name: 'uien', isPantry: false }
const olie = { id: 'i-olie', name: 'olijfolie', isPantry: true }
const gehakt = { id: 'i-gehakt', name: 'gehakt', isPantry: false }

function input(overrides: Partial<ShoppingListInput> = {}): ShoppingListInput {
  return {
    days: [
      { day: '2026-11-02', dishId: 'd-stamppot' },
      { day: '2026-11-03', dishId: 'd-nasi' },
    ],
    dishes: [
      { id: 'd-stamppot', name: 'stamppot', deleted: false },
      { id: 'd-nasi', name: 'nasi', deleted: false },
    ],
    dishIngredients: [
      { dishId: 'd-stamppot', ingredientId: 'i-ui', quantity: 2, unit: 'stuks' },
      { dishId: 'd-nasi', ingredientId: 'i-ui', quantity: 2, unit: '' },
    ],
    ingredients: [ui, olie, gehakt],
    generalItems: [],
    states: [],
    ...overrides,
  }
}

describe('requirement 4: gecombineerde boodschappenlijst', () => {
  it('telt hetzelfde ingrediënt op en noemt de gerechten: "4 uien (stamppot, nasi)"', () => {
    const { lines } = buildShoppingList(input())
    expect(lines).toHaveLength(1)
    expect(lines[0].label).toBe('4 uien (stamppot, nasi)')
  })

  it('noemt geen gerechten als het ingrediënt maar in één gerecht zit', () => {
    const { lines } = buildShoppingList(
      input({ days: [{ day: '2026-11-02', dishId: 'd-stamppot' }] }),
    )
    expect(lines[0].label).toBe('2 uien')
  })

  it('telt een gerecht dat twee keer in de week staat twee keer mee', () => {
    const { lines } = buildShoppingList(
      input({
        days: [
          { day: '2026-11-02', dishId: 'd-stamppot' },
          { day: '2026-11-05', dishId: 'd-stamppot' },
        ],
      }),
    )
    expect(lines[0].label).toBe('4 uien (stamppot ×2)')
  })

  it('beschouwt "Uien " en "uien" als hetzelfde ingrediënt', () => {
    const { lines } = buildShoppingList(
      input({
        ingredients: [ui, { id: 'i-ui2', name: 'Uien ', isPantry: false }, olie, gehakt],
        dishIngredients: [
          { dishId: 'd-stamppot', ingredientId: 'i-ui', quantity: 2, unit: '' },
          { dishId: 'd-nasi', ingredientId: 'i-ui2', quantity: 1, unit: '' },
        ],
      }),
    )
    expect(lines).toHaveLength(1)
    expect(lines[0].label).toBe('3 uien (stamppot, nasi)')
  })

  it('telt alleen op binnen dezelfde eenheid', () => {
    const { lines } = buildShoppingList(
      input({
        dishIngredients: [
          { dishId: 'd-stamppot', ingredientId: 'i-ui', quantity: 2, unit: '' },
          { dishId: 'd-nasi', ingredientId: 'i-ui', quantity: 200, unit: 'g' },
        ],
      }),
    )
    expect(lines[0].label).toBe('uien: 2 stuks + 200 g (stamppot, nasi)')
  })

  it('laat een verwijderd gerecht (het grijze gerecht) buiten de lijst', () => {
    const { lines } = buildShoppingList(
      input({
        dishes: [
          { id: 'd-stamppot', name: 'stamppot', deleted: true },
          { id: 'd-nasi', name: 'nasi', deleted: false },
        ],
      }),
    )
    expect(lines[0].label).toBe('2 uien')
  })

  it('negeert dagen zonder gerecht', () => {
    const { lines } = buildShoppingList(input({ days: [{ day: '2026-11-02', dishId: null }] }))
    expect(lines).toEqual([])
  })

  it('neemt de algemene boodschappen mee', () => {
    const { lines } = buildShoppingList(
      input({
        days: [],
        generalItems: [{ id: 'g-koffie', name: 'koffie', isPantry: false }],
      }),
    )
    expect(lines.map((l) => l.label)).toEqual(['koffie'])
  })

  it('toont afgevinkte regels met hun status', () => {
    const { lines } = buildShoppingList(
      input({ states: [{ refType: 'ingredient', refKey: 'uien', missing: false, checked: true }] }),
    )
    expect(lines[0].checked).toBe(true)
  })

  it('sorteert alfabetisch', () => {
    const { lines } = buildShoppingList(
      input({
        dishIngredients: [
          { dishId: 'd-stamppot', ingredientId: 'i-ui', quantity: 2, unit: '' },
          { dishId: 'd-nasi', ingredientId: 'i-gehakt', quantity: 500, unit: 'g' },
        ],
      }),
    )
    expect(lines.map((l) => l.name)).toEqual(['gehakt', 'uien'])
  })
})

describe('requirement 6: huisvoorraad en de afrondprompt', () => {
  const withOil = (extra: Partial<ShoppingListInput> = {}) =>
    input({
      dishIngredients: [
        { dishId: 'd-stamppot', ingredientId: 'i-olie', quantity: 2, unit: 'el' },
        { dishId: 'd-nasi', ingredientId: 'i-olie', quantity: 1, unit: 'el' },
      ],
      generalItems: [{ id: 'g-wc', name: 'wc-papier', isPantry: true }],
      ...extra,
    })

  it('zet olie als huisvoorraad niet op de lijst, maar wel in blok 1 van de prompt', () => {
    const list = buildShoppingList(withOil())
    expect(list.lines).toEqual([])
    expect(list.prompt.forMenu.map((l) => l.name)).toEqual(['olijfolie'])
    expect(list.prompt.forMenu[0].label).toBe('3 el olijfolie (stamppot, nasi)')
  })

  it('zet huisvoorraad die niet in de gerechten van de week zit niet in de prompt', () => {
    const list = buildShoppingList(
      withOil({ days: [{ day: '2026-11-02', dishId: null }] }),
    )
    expect(list.prompt.forMenu).toEqual([])
  })

  it('toont huisvoorraad van algemene boodschappen in blok 2 ("Andere huisvoorraad")', () => {
    const list = buildShoppingList(withOil())
    expect(list.prompt.other.map((l) => l.name)).toEqual(['wc-papier'])
    expect(list.lines.map((l) => l.name)).not.toContain('wc-papier')
  })

  it('zet "niet in huis" direct op de lijst, met de gerechtnamen erbij', () => {
    const list = buildShoppingList(
      withOil({
        states: [
          { refType: 'ingredient', refKey: 'olijfolie', missing: true, checked: false },
          { refType: 'general', refKey: 'g-wc', missing: true, checked: false },
        ],
      }),
    )
    expect(list.lines.map((l) => l.label)).toEqual(['3 el olijfolie (stamppot, nasi)', 'wc-papier'])
  })

  it('toont bij "niet in huis" ook één gerechtnaam, want daar draait de prompt om', () => {
    const list = buildShoppingList(
      input({
        dishIngredients: [{ dishId: 'd-stamppot', ingredientId: 'i-olie', quantity: 2, unit: 'el' }],
        states: [{ refType: 'ingredient', refKey: 'olijfolie', missing: true, checked: false }],
      }),
    )
    expect(list.lines.map((l) => l.label)).toEqual(['2 el olijfolie (stamppot)'])
  })

  it('houdt huisvoorraad in de prompt staan, ook als het op de lijst is gezet', () => {
    const list = buildShoppingList(
      withOil({ states: [{ refType: 'ingredient', refKey: 'olijfolie', missing: true, checked: false }] }),
    )
    expect(list.prompt.forMenu[0].missing).toBe(true)
  })

  it('markeert een ingrediënt als huisvoorraad zodra één van de dubbele namen dat is', () => {
    const list = buildShoppingList(
      withOil({
        ingredients: [
          ui,
          { id: 'i-olie', name: 'olijfolie', isPantry: true },
          { id: 'i-olie2', name: 'Olijfolie', isPantry: false },
        ],
        dishIngredients: [
          { dishId: 'd-stamppot', ingredientId: 'i-olie', quantity: 2, unit: 'el' },
          { dishId: 'd-nasi', ingredientId: 'i-olie2', quantity: 1, unit: 'el' },
        ],
      }),
    )
    expect(list.lines).toEqual([])
    expect(list.prompt.forMenu).toHaveLength(1)
  })
})

describe('tekst voor kopiëren of delen', () => {
  it('slaat afgevinkte regels over', () => {
    const { lines } = buildShoppingList(
      input({
        generalItems: [{ id: 'g-koffie', name: 'koffie', isPantry: false }],
        states: [{ refType: 'general', refKey: 'g-koffie', missing: false, checked: true }],
      }),
    )
    expect(shoppingListToText(lines)).toBe('- 4 uien (stamppot, nasi)')
  })
})

describe('formatLabel', () => {
  it('schrijft kommagetallen op zijn Nederlands', () => {
    expect(formatLabel('melk', [{ amount: 0.5, unit: 'l' }], [])).toBe('0,5 l melk')
  })

  it('toont alleen de naam bij een ingrediënt zonder hoeveelheid', () => {
    expect(formatLabel('zout', [{ amount: null, unit: '' }], [])).toBe('zout')
  })
})
