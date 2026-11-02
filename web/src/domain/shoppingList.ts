/**
 * De gecombineerde boodschappenlijst (requirement 4) met huisvoorraad
 * (requirement 6). Pure functies, zonder database, zodat de acceptatiecriteria
 * direct te testen zijn.
 *
 * De lijst wordt nooit opgeslagen: hij wordt steeds uitgerekend uit het
 * weekplan, de gerechten en de algemene boodschappen. Alleen de keuzes van de
 * gebruikers ("niet in huis", "afgevinkt") staan in de database.
 */

export type RefType = 'ingredient' | 'general'

export interface Dish {
  id: string
  name: string
  deleted: boolean
}

export interface Ingredient {
  id: string
  name: string
  isPantry: boolean
}

export interface DishIngredient {
  dishId: string
  ingredientId: string
  quantity: number | null
  unit: string
}

export interface GeneralItem {
  id: string
  name: string
  isPantry: boolean
}

export interface ListState {
  refType: RefType
  refKey: string
  missing: boolean
  checked: boolean
}

export interface PlannedDay {
  /** "YYYY-MM-DD" */
  day: string
  dishId: string | null
}

export interface Quantity {
  amount: number | null
  unit: string
}

export interface DishUse {
  name: string
  times: number
}

export interface ListLine {
  refType: RefType
  /** Genormaliseerde ingrediëntnaam, of het id van de algemene boodschap. */
  refKey: string
  name: string
  parts: Quantity[]
  /** Gerechten waar dit ingrediënt voor nodig is, in volgorde van de week. */
  dishes: DishUse[]
  isPantry: boolean
  /** Huisvoorraad die deze week toch gekocht moet worden. */
  missing: boolean
  checked: boolean
  /** Bijvoorbeeld "4 uien (stamppot, nasi)". */
  label: string
}

export interface ShoppingList {
  /** Wat nu op de lijst staat. */
  lines: ListLine[]
  /** Wat de afrondprompt "Ben je nog iets vergeten?" toont. */
  prompt: {
    /** "Huisvoorraad voor het weekmenu". */
    forMenu: ListLine[]
    /** "Andere huisvoorraad". */
    other: ListLine[]
  }
}

export interface ShoppingListInput {
  days: PlannedDay[]
  dishes: Dish[]
  dishIngredients: DishIngredient[]
  ingredients: Ingredient[]
  generalItems: GeneralItem[]
  states: ListState[]
}

export const normalizeName = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** "stuk" en "stuks" zijn de standaardeenheid en worden niet getoond. */
export const normalizeUnit = (u: string): string => {
  const x = u.trim().toLowerCase()
  return x === 'stuk' || x === 'stuks' ? '' : x
}

export function formatAmount(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',')
}

function partText(p: Quantity): string {
  if (p.amount === null) return p.unit
  return `${formatAmount(p.amount)} ${p.unit === '' ? 'stuks' : p.unit}`
}

/** "4 uien", "500 g gehakt", of bij meerdere eenheden "ui: 2 stuks + 200 g". */
export function formatLabel(
  name: string,
  parts: Quantity[],
  dishes: DishUse[],
  /** Ook bij één gerecht de gerechtnaam tonen (huisvoorraad die je "niet in huis" noemde). */
  alwaysShowDishes = false,
): string {
  const counted = parts.filter((p) => p.amount !== null)
  let base = name
  if (counted.length === 1 && parts.length === 1) {
    const { amount, unit } = counted[0]
    base = `${formatAmount(amount as number)}${unit ? ` ${unit}` : ''} ${name}`
  } else if (counted.length > 0) {
    base = `${name}: ${parts.map(partText).filter(Boolean).join(' + ')}`
  }
  const uses = dishes.reduce((sum, d) => sum + d.times, 0)
  if (uses >= 2 || (alwaysShowDishes && uses >= 1)) {
    const names = dishes.map((d) => (d.times > 1 ? `${d.name} ×${d.times}` : d.name))
    base += ` (${names.join(', ')})`
  }
  return base
}

interface Group {
  name: string
  isPantry: boolean
  parts: Map<string, number | null>
  dishes: Map<string, DishUse>
}

const stateKey = (t: RefType, k: string) => `${t}|${k}`
const byName = (a: ListLine, b: ListLine) => a.name.localeCompare(b.name, 'nl')

export function buildShoppingList(input: ShoppingListInput): ShoppingList {
  const dishById = new Map(input.dishes.map((d) => [d.id, d]))
  const ingredientById = new Map(input.ingredients.map((i) => [i.id, i]))
  const linesOfDish = new Map<string, DishIngredient[]>()
  for (const di of input.dishIngredients) {
    const list = linesOfDish.get(di.dishId) ?? []
    list.push(di)
    linesOfDish.set(di.dishId, list)
  }
  const states = new Map(input.states.map((s) => [stateKey(s.refType, s.refKey), s]))

  const groups = new Map<string, Group>()
  const days = [...input.days].sort((a, b) => a.day.localeCompare(b.day))

  for (const day of days) {
    if (!day.dishId) continue
    const dish = dishById.get(day.dishId)
    // Een verwijderd gerecht (het grijze gerecht) levert niets op voor de lijst.
    if (!dish || dish.deleted) continue

    const countedThisDay = new Set<string>()
    for (const di of linesOfDish.get(dish.id) ?? []) {
      const ingredient = ingredientById.get(di.ingredientId)
      if (!ingredient) continue
      const key = normalizeName(ingredient.name)

      let group = groups.get(key)
      if (!group) {
        group = { name: ingredient.name.trim(), isPantry: false, parts: new Map(), dishes: new Map() }
        groups.set(key, group)
      }
      group.isPantry = group.isPantry || ingredient.isPantry

      const unit = normalizeUnit(di.unit)
      if (di.quantity === null) {
        if (!group.parts.has(unit)) group.parts.set(unit, null)
      } else {
        group.parts.set(unit, (group.parts.get(unit) ?? 0) + di.quantity)
      }

      // Het gerecht telt één keer per dag mee, ook als het ingrediënt er twee keer in staat.
      if (!countedThisDay.has(key)) {
        countedThisDay.add(key)
        const use = group.dishes.get(dish.id) ?? { name: dish.name, times: 0 }
        use.times += 1
        group.dishes.set(dish.id, use)
      }
    }
  }

  const toLine = (refType: RefType, refKey: string, g: Group): ListLine => {
    const state = states.get(stateKey(refType, refKey))
    const parts = [...g.parts].map(([unit, amount]) => ({ amount, unit }))
    const dishes = [...g.dishes.values()]
    return {
      refType,
      refKey,
      name: g.name,
      parts,
      dishes,
      isPantry: g.isPantry,
      missing: state?.missing ?? false,
      checked: state?.checked ?? false,
      label: formatLabel(g.name, parts, dishes, g.isPantry && (state?.missing ?? false)),
    }
  }

  const ingredientLines = [...groups].map(([key, g]) => toLine('ingredient', key, g))
  const generalLines = input.generalItems.map((item) =>
    toLine('general', item.id, {
      name: item.name.trim(),
      isPantry: item.isPantry,
      parts: new Map(),
      dishes: new Map(),
    }),
  )

  // Huisvoorraad staat niet op de lijst, tenzij je zei dat je het niet in huis hebt.
  const onList = (l: ListLine) => !l.isPantry || l.missing

  return {
    lines: [...ingredientLines, ...generalLines].filter(onList).sort(byName),
    prompt: {
      forMenu: ingredientLines.filter((l) => l.isPantry).sort(byName),
      other: generalLines.filter((l) => l.isPantry).sort(byName),
    },
  }
}

/** Platte tekst om te kopiëren of te delen (versie 1 van de Picnic-koppeling). */
export function shoppingListToText(lines: ListLine[]): string {
  return lines
    .filter((l) => !l.checked)
    .map((l) => `- ${l.label}`)
    .join('\n')
}
