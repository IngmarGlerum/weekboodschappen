import { useMemo } from 'react'
import { useCurrentHousehold } from '../auth/HouseholdProvider'
import { todayISO } from '../domain/dates'
import { normalizeName, type PlannedDay, type RefType } from '../domain/shoppingList'
import { menuToWeek, weekToMenu, type MenuDay } from '../domain/weekmenu'
import { db } from '../powersync/db'

/**
 * Alle schrijfacties. Elke wijziging zet `modified_at` op het moment van de
 * gebruiker. Dat is wat "laatste wijziging wint" mogelijk maakt, ook voor
 * wijzigingen die offline zijn gedaan (requirement 9).
 *
 * Verwijderen is markeren met `deleted_at`, nooit echt wissen (requirement 12:
 * een verwijderd gerecht blijft als grijs gerecht zichtbaar in een weekmenu).
 */

const nowISO = () => new Date().toISOString()
const newId = () => crypto.randomUUID()
const flag = (value: boolean) => (value ? 1 : 0)

// Rijen met een vaste sleutel, zodat twee telefoons nooit twee rijen voor hetzelfde maken.
export const weekDayId = (householdId: string, day: string) => `${householdId}|${day}`
export const listStateId = (householdId: string, weekStart: string, refType: RefType, refKey: string) =>
  `${householdId}|${weekStart}|${refType}|${refKey}`
export const weekmenuDayId = (menuId: string, weekday: number) => `${menuId}|${weekday}`

export interface DishLineInput {
  ingredientId: string
  quantity: number | null
  unit: string
}

export interface DishUsage {
  /** Namen van de weekmenu's waar het gerecht in zit. */
  menuNames: string[]
  /** Aantal geplande dagen vanaf vandaag. */
  plannedDays: number
}

export function createRepo(householdId: string) {
  const hid = householdId

  async function softDelete(table: string, id: string) {
    const t = nowISO()
    await db.execute(`UPDATE ${table} SET deleted_at = ?, modified_at = ? WHERE id = ?`, [t, t, id])
  }

  async function upsertWeekDay(
    tx: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
    day: string,
    dishId: string | null,
    t: string,
  ) {
    await tx.execute(
      `INSERT OR REPLACE INTO week_days (id, household_id, day, dish_id, modified_at, created_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)`,
      [weekDayId(hid, day), hid, day, dishId, t, t],
    )
  }

  async function insertStoreItem(
    tx: { execute: (sql: string, params?: unknown[]) => Promise<unknown> },
    label: string,
    t: string,
  ) {
    await tx.execute(
      `INSERT INTO store_items (id, household_id, label, done, modified_at, created_at) VALUES (?, ?, ?, 0, ?, ?)`,
      [newId(), hid, label.trim(), t, t],
    )
  }

  return {
    // --- Ingrediënten (requirement 5) -----------------------------------
    /** Voegt een ingrediënt toe, of geeft het bestaande terug als de naam al bestaat. */
    async addIngredient(input: { name: string; defaultUnit?: string; isPantry?: boolean }): Promise<string> {
      const name = input.name.trim()
      const existing = await db.getAll<{ id: string; name: string }>(
        `SELECT id, name FROM ingredients WHERE household_id = ? AND deleted_at IS NULL`,
        [hid],
      )
      const duplicate = existing.find((i) => normalizeName(i.name) === normalizeName(name))
      if (duplicate) return duplicate.id
      const id = newId()
      const t = nowISO()
      await db.execute(
        `INSERT INTO ingredients (id, household_id, name, default_unit, is_pantry, modified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, hid, name, input.defaultUnit?.trim() ?? '', flag(input.isPantry ?? false), t, t],
      )
      return id
    },

    async setIngredientPantry(id: string, isPantry: boolean) {
      await db.execute(`UPDATE ingredients SET is_pantry = ?, modified_at = ? WHERE id = ?`, [
        flag(isPantry),
        nowISO(),
        id,
      ])
    },

    async setIngredientUnit(id: string, unit: string) {
      await db.execute(`UPDATE ingredients SET default_unit = ?, modified_at = ? WHERE id = ?`, [
        unit.trim(),
        nowISO(),
        id,
      ])
    },

    /** Aantal gerechten dat dit ingrediënt gebruikt. */
    async ingredientUsage(id: string): Promise<number> {
      const row = await db.get<{ c: number }>(
        `SELECT COUNT(DISTINCT di.dish_id) AS c
           FROM dish_ingredients di JOIN dishes d ON d.id = di.dish_id
          WHERE di.ingredient_id = ? AND di.deleted_at IS NULL AND d.deleted_at IS NULL`,
        [id],
      )
      return row.c
    },

    removeIngredient: (id: string) => softDelete('ingredients', id),

    // --- Gerechten (requirement 1) --------------------------------------
    /** Slaat een gerecht op. Zonder `id` wordt een nieuw gerecht gemaakt. */
    async saveDish(input: { id?: string; name: string; lines: DishLineInput[] }): Promise<string> {
      const id = input.id ?? newId()
      await db.writeTransaction(async (tx) => {
        const t = nowISO()
        if (input.id) {
          await tx.execute(`UPDATE dishes SET name = ?, modified_at = ? WHERE id = ?`, [input.name.trim(), t, id])
          await tx.execute(
            `UPDATE dish_ingredients SET deleted_at = ?, modified_at = ? WHERE dish_id = ? AND deleted_at IS NULL`,
            [t, t, id],
          )
        } else {
          await tx.execute(
            `INSERT INTO dishes (id, household_id, name, modified_at, created_at) VALUES (?, ?, ?, ?, ?)`,
            [id, hid, input.name.trim(), t, t],
          )
        }
        for (const line of input.lines) {
          await tx.execute(
            `INSERT INTO dish_ingredients
               (id, household_id, dish_id, ingredient_id, quantity, unit, modified_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId(), hid, id, line.ingredientId, line.quantity, line.unit.trim(), t, t],
          )
        }
      })
      return id
    },

    /** Waar een gerecht nog in voorkomt, voor de vraag bij verwijderen (requirement 12). */
    async dishUsage(dishId: string): Promise<DishUsage> {
      const menus = await db.getAll<{ name: string }>(
        `SELECT DISTINCT m.name AS name
           FROM weekmenu_days d JOIN weekmenus m ON m.id = d.weekmenu_id
          WHERE d.dish_id = ? AND d.deleted_at IS NULL AND m.deleted_at IS NULL
          ORDER BY m.name`,
        [dishId],
      )
      const days = await db.get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM week_days WHERE dish_id = ? AND deleted_at IS NULL AND day >= ?`,
        [dishId, todayISO()],
      )
      return { menuNames: menus.map((m) => m.name), plannedDays: days.c }
    },

    /** Het gerecht verdwijnt uit de lijst; weekmenu's en weken tonen het daarna grijs. */
    removeDish: (id: string) => softDelete('dishes', id),

    // --- Week (requirement 2) -------------------------------------------
    async setWeekDay(day: string, dishId: string | null) {
      await db.writeTransaction((tx) => upsertWeekDay(tx, day, dishId, nowISO()))
    },

    async clearWeek(days: string[]) {
      await db.writeTransaction(async (tx) => {
        const t = nowISO()
        for (const day of days) await upsertWeekDay(tx, day, null, t)
      })
    },

    // --- Algemene boodschappen (requirement 3) --------------------------
    async addGeneralItem(name: string): Promise<string> {
      const existing = await db.getAll<{ id: string; name: string }>(
        `SELECT id, name FROM general_items WHERE household_id = ? AND deleted_at IS NULL`,
        [hid],
      )
      const duplicate = existing.find((i) => normalizeName(i.name) === normalizeName(name))
      if (duplicate) return duplicate.id
      const id = newId()
      const t = nowISO()
      await db.execute(
        `INSERT INTO general_items (id, household_id, name, is_pantry, modified_at, created_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
        [id, hid, name.trim(), t, t],
      )
      return id
    },

    async setGeneralPantry(id: string, isPantry: boolean) {
      await db.execute(`UPDATE general_items SET is_pantry = ?, modified_at = ? WHERE id = ?`, [
        flag(isPantry),
        nowISO(),
        id,
      ])
    },

    removeGeneralItem: (id: string) => softDelete('general_items', id),

    // --- Keuzes bij de boodschappenlijst (requirement 4 en 6) -----------
    /** Zet "niet in huis" en/of "afgevinkt" voor één regel van één week. */
    async patchListState(
      weekStart: string,
      refType: RefType,
      refKey: string,
      patch: { missing?: boolean; checked?: boolean },
    ) {
      const id = listStateId(hid, weekStart, refType, refKey)
      await db.writeTransaction(async (tx) => {
        const current = await tx.getOptional<{ missing: number | null; checked: number | null }>(
          `SELECT missing, checked FROM list_states WHERE id = ?`,
          [id],
        )
        const missing = patch.missing ?? current?.missing === 1
        const checked = patch.checked ?? current?.checked === 1
        const t = nowISO()
        await tx.execute(
          `INSERT OR REPLACE INTO list_states
             (id, household_id, week_start, ref_type, ref_key, missing, checked, modified_at, created_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [id, hid, weekStart, refType, refKey, flag(missing), flag(checked), t, t],
        )
      })
    },

    // --- Winkellijst voor een andere supermarkt (requirement 7) ---------
    async addStoreItem(label: string) {
      await db.writeTransaction((tx) => insertStoreItem(tx, label, nowISO()))
    },

    async setStoreItemDone(id: string, done: boolean) {
      await db.execute(`UPDATE store_items SET done = ?, modified_at = ? WHERE id = ?`, [
        flag(done),
        nowISO(),
        id,
      ])
    },

    removeStoreItem: (id: string) => softDelete('store_items', id),

    async clearDoneStoreItems() {
      const t = nowISO()
      await db.execute(
        `UPDATE store_items SET deleted_at = ?, modified_at = ?
          WHERE household_id = ? AND done = 1 AND deleted_at IS NULL`,
        [t, t, hid],
      )
    },

    // --- Weekmenu's (requirement 12) ------------------------------------
    async createWeekmenu(name: string): Promise<string> {
      const id = newId()
      const t = nowISO()
      await db.execute(
        `INSERT INTO weekmenus (id, household_id, name, modified_at, created_at) VALUES (?, ?, ?, ?, ?)`,
        [id, hid, name.trim(), t, t],
      )
      return id
    },

    async renameWeekmenu(id: string, name: string) {
      await db.execute(`UPDATE weekmenus SET name = ?, modified_at = ? WHERE id = ?`, [name.trim(), nowISO(), id])
    },

    removeWeekmenu: (id: string) => softDelete('weekmenus', id),

    async setWeekmenuDay(menuId: string, weekday: number, dishId: string | null) {
      const t = nowISO()
      await db.execute(
        `INSERT OR REPLACE INTO weekmenu_days
           (id, household_id, weekmenu_id, weekday, dish_id, modified_at, created_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
        [weekmenuDayId(menuId, weekday), hid, menuId, weekday, dishId, t, t],
      )
    },

    async addWeekmenuStoreItem(menuId: string, label: string) {
      const t = nowISO()
      await db.execute(
        `INSERT INTO weekmenu_store_items (id, household_id, weekmenu_id, label, modified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId(), hid, menuId, label.trim(), t, t],
      )
    },

    removeWeekmenuStoreItem: (id: string) => softDelete('weekmenu_store_items', id),

    /** Slaat de ingevulde week op als weekmenu, met de gekozen items van de winkellijst. */
    async saveWeekAsMenu(input: { name: string; days: PlannedDay[]; storeLabels: string[] }): Promise<string> {
      const id = newId()
      await db.writeTransaction(async (tx) => {
        const t = nowISO()
        await tx.execute(
          `INSERT INTO weekmenus (id, household_id, name, modified_at, created_at) VALUES (?, ?, ?, ?, ?)`,
          [id, hid, input.name.trim(), t, t],
        )
        for (const day of weekToMenu(input.days)) {
          await tx.execute(
            `INSERT INTO weekmenu_days
               (id, household_id, weekmenu_id, weekday, dish_id, modified_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [weekmenuDayId(id, day.weekday), hid, id, day.weekday, day.dishId, t, t],
          )
        }
        for (const label of input.storeLabels) {
          await tx.execute(
            `INSERT INTO weekmenu_store_items (id, household_id, weekmenu_id, label, modified_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [newId(), hid, id, label.trim(), t, t],
          )
        }
      })
      return id
    },

    /**
     * Vult de week in één keer in met een weekmenu en zet de gekozen items op
     * de winkellijst (items die al op de lijst staan worden niet dubbel toegevoegd).
     * De boodschappenlijst volgt vanzelf, want die wordt uit de week uitgerekend.
     */
    async applyWeekmenu(input: { menuDays: MenuDay[]; weekStart: string; storeLabels: string[] }) {
      await db.writeTransaction(async (tx) => {
        const t = nowISO()
        for (const day of menuToWeek(input.menuDays, input.weekStart)) {
          await upsertWeekDay(tx, day.day, day.dishId, t)
        }
        const open = await tx.getAll<{ label: string }>(
          `SELECT label FROM store_items WHERE household_id = ? AND deleted_at IS NULL AND done = 0`,
          [hid],
        )
        const known = new Set(open.map((r) => normalizeName(r.label)))
        for (const label of input.storeLabels) {
          if (known.has(normalizeName(label))) continue
          known.add(normalizeName(label))
          await insertStoreItem(tx, label, t)
        }
      })
    },
  }
}

export type Repo = ReturnType<typeof createRepo>

/** De schrijfacties voor de gekozen planning. */
export function useRepo(): Repo {
  const { id } = useCurrentHousehold()
  return useMemo(() => createRepo(id), [id])
}
