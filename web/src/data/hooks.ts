import { useQuery } from '@powersync/react'
import { useMemo } from 'react'
import { useCurrentHousehold } from '../auth/HouseholdProvider'
import { addDays } from '../domain/dates'
import { buildShoppingList, type ShoppingList } from '../domain/shoppingList'
import {
  isOn,
  type DishIngredientRow,
  type DishRow,
  type GeneralItemRow,
  type IngredientRow,
  type ListStateRow,
  type StoreItemRow,
  type WeekDayRow,
  type WeekmenuDayRow,
  type WeekmenuRow,
  type WeekmenuStoreItemRow,
} from './rows'

/**
 * Lees-hooks. Elke query kijkt mee met de lokale database en ververst vanzelf
 * zodra er iets verandert, ook als de wijziging van de ander binnenkomt.
 * Verwijderde rijen (deleted_at gevuld) worden standaard weggelaten.
 *
 * Op het apparaat staan de gegevens van alle planningen waar je lid van bent;
 * elke query toont alleen die van de gekozen planning.
 */

const useHid = () => useCurrentHousehold().id

export function useIngredients() {
  const hid = useHid()
  return useQuery<IngredientRow>(
    `SELECT id, name, default_unit, is_pantry FROM ingredients
     WHERE household_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
    [hid],
  )
}

/** Gerechten die nog bestaan. */
export function useDishes() {
  const hid = useHid()
  return useQuery<DishRow>(
    `SELECT id, name, deleted_at FROM dishes
     WHERE household_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
    [hid],
  )
}

/** Ook verwijderde gerechten, om hun naam grijs te kunnen tonen in een week of weekmenu. */
export function useAllDishes() {
  const hid = useHid()
  return useQuery<DishRow>(`SELECT id, name, deleted_at FROM dishes WHERE household_id = ?`, [hid])
}

export function useDishIngredients(dishId?: string) {
  const hid = useHid()
  return useQuery<DishIngredientRow>(
    dishId
      ? `SELECT id, dish_id, ingredient_id, quantity, unit FROM dish_ingredients
         WHERE household_id = ? AND deleted_at IS NULL AND dish_id = ? ORDER BY created_at, id`
      : `SELECT id, dish_id, ingredient_id, quantity, unit FROM dish_ingredients
         WHERE household_id = ? AND deleted_at IS NULL`,
    dishId ? [hid, dishId] : [hid],
  )
}

export function useWeekDays(weekStart: string) {
  const hid = useHid()
  return useQuery<WeekDayRow>(
    `SELECT id, day, dish_id FROM week_days
     WHERE household_id = ? AND deleted_at IS NULL AND day >= ? AND day <= ? ORDER BY day`,
    [hid, weekStart, addDays(weekStart, 6)],
  )
}

export function useGeneralItems() {
  const hid = useHid()
  return useQuery<GeneralItemRow>(
    `SELECT id, name, is_pantry FROM general_items
     WHERE household_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
    [hid],
  )
}

export function useStoreItems() {
  const hid = useHid()
  return useQuery<StoreItemRow>(
    `SELECT id, label, done FROM store_items
     WHERE household_id = ? AND deleted_at IS NULL ORDER BY created_at, id`,
    [hid],
  )
}

export function useWeekmenus() {
  const hid = useHid()
  return useQuery<WeekmenuRow>(
    `SELECT id, name FROM weekmenus WHERE household_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE`,
    [hid],
  )
}

export function useWeekmenuDays() {
  const hid = useHid()
  return useQuery<WeekmenuDayRow>(
    `SELECT id, weekmenu_id, weekday, dish_id FROM weekmenu_days
     WHERE household_id = ? AND deleted_at IS NULL ORDER BY weekday`,
    [hid],
  )
}

export function useWeekmenuStoreItems() {
  const hid = useHid()
  return useQuery<WeekmenuStoreItemRow>(
    `SELECT id, weekmenu_id, label FROM weekmenu_store_items
     WHERE household_id = ? AND deleted_at IS NULL ORDER BY created_at, id`,
    [hid],
  )
}

/**
 * De boodschappenlijst van een week, uitgerekend uit weekplan, gerechten,
 * ingrediënten, algemene boodschappen en de keuzes die jullie al maakten.
 */
export function useShoppingList(weekStart: string): { list: ShoppingList; isLoading: boolean } {
  const hid = useHid()
  const days = useWeekDays(weekStart)
  const dishes = useAllDishes()
  const dishIngredients = useDishIngredients()
  const ingredients = useQuery<IngredientRow>(
    `SELECT id, name, default_unit, is_pantry FROM ingredients WHERE household_id = ?`,
    [hid],
  )
  const general = useGeneralItems()
  const states = useQuery<ListStateRow>(
    `SELECT ref_type, ref_key, missing, checked FROM list_states
     WHERE household_id = ? AND deleted_at IS NULL AND week_start = ?`,
    [hid, weekStart],
  )

  const isLoading = [days, dishes, dishIngredients, ingredients, general, states].some((q) => q.isLoading)

  const list = useMemo(
    () =>
      buildShoppingList({
        days: days.data.map((d) => ({ day: d.day, dishId: d.dish_id })),
        dishes: dishes.data.map((d) => ({ id: d.id, name: d.name, deleted: d.deleted_at !== null })),
        dishIngredients: dishIngredients.data.map((d) => ({
          dishId: d.dish_id,
          ingredientId: d.ingredient_id,
          quantity: d.quantity,
          unit: d.unit ?? '',
        })),
        ingredients: ingredients.data.map((i) => ({ id: i.id, name: i.name, isPantry: isOn(i.is_pantry) })),
        generalItems: general.data.map((g) => ({ id: g.id, name: g.name, isPantry: isOn(g.is_pantry) })),
        states: states.data.map((s) => ({
          refType: s.ref_type,
          refKey: s.ref_key,
          missing: isOn(s.missing),
          checked: isOn(s.checked),
        })),
      }),
    [days.data, dishes.data, dishIngredients.data, ingredients.data, general.data, states.data],
  )

  return { list, isLoading }
}
