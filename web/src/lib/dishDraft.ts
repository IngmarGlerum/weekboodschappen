/**
 * Een gerecht dat je aan het maken of wijzigen bent, maar nog niet hebt
 * opgeslagen, blijft op dit apparaat bewaard. Zo ben je niets kwijt als je
 * even naar een andere tab gaat.
 */
export interface DishDraft {
  name: string
  lines: Array<{ key: string; ingredientId: string; quantity: string; unit: string }>
}

interface DraftKey {
  householdId: string
  /** Het id van het gerecht, of 'nieuw'. */
  dishId: string
}

const keyOf = ({ householdId, dishId }: DraftKey) => `weekplanner.dishDraft.${householdId}.${dishId}`

export function readDishDraft(key: DraftKey): DishDraft | null {
  try {
    const raw = localStorage.getItem(keyOf(key))
    return raw ? (JSON.parse(raw) as DishDraft) : null
  } catch {
    return null
  }
}

export function writeDishDraft(key: DraftKey, draft: DishDraft) {
  try {
    localStorage.setItem(keyOf(key), JSON.stringify(draft))
  } catch {
    // Geen opslag: dan blijft het concept alleen zolang de pagina open is.
  }
}

export function clearDishDraft(key: DraftKey) {
  try {
    localStorage.removeItem(keyOf(key))
  } catch {
    // Niets te doen.
  }
}
