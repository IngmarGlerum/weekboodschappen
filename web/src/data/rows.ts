/**
 * Rijen zoals SQLite ze teruggeeft. Ja/nee-waarden zijn 0 of 1, lege waarden null.
 */

export interface IngredientRow {
  id: string
  name: string
  default_unit: string | null
  is_pantry: number | null
}

export interface DishRow {
  id: string
  name: string
  deleted_at: string | null
}

export interface DishIngredientRow {
  id: string
  dish_id: string
  ingredient_id: string
  quantity: number | null
  unit: string | null
}

export interface WeekDayRow {
  id: string
  day: string
  dish_id: string | null
}

export interface GeneralItemRow {
  id: string
  name: string
  is_pantry: number | null
}

export interface StoreItemRow {
  id: string
  /** De tekst van het item. */
  label: string
  done: number | null
  label_id: string | null
  note: string | null
  important: number | null
  position: number | null
  created_at: string | null
  completed_at: string | null
}

/** Een label zoals "Jumbo", met een emoji of een klein plaatje (data-URL) als icoon. */
export interface StoreLabelRow {
  id: string
  name: string
  icon: string | null
  color: string | null
}

export interface ListStateRow {
  ref_type: 'ingredient' | 'general'
  ref_key: string
  missing: number | null
  checked: number | null
}

export interface WeekmenuRow {
  id: string
  name: string
}

export interface WeekmenuDayRow {
  id: string
  weekmenu_id: string
  weekday: number
  dish_id: string | null
}

export interface WeekmenuStoreItemRow {
  id: string
  weekmenu_id: string
  label: string
}

export const isOn = (value: number | null | undefined): boolean => value === 1
