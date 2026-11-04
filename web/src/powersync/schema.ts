import { column, Schema, Table } from '@powersync/web'

/**
 * Het lokale schema. Dit spiegelt de Postgres-tabellen in
 * supabase/migrations, zonder `id` (dat voegt PowerSync zelf toe).
 *
 * PowerSync kent drie kolomtypen. Tekst en datums zijn `text`, ja/nee-waarden
 * zijn `integer` (0 of 1), hoeveelheden zijn `real`.
 */

const common = {
  household_id: column.text,
  modified_at: column.text,
  created_at: column.text,
  deleted_at: column.text,
}

export const AppSchema = new Schema({
  households: new Table({
    name: column.text,
    avatar: column.text,
    created_at: column.text,
  }),

  ingredients: new Table({
    ...common,
    name: column.text,
    default_unit: column.text,
    is_pantry: column.integer,
  }),

  dishes: new Table({
    ...common,
    name: column.text,
  }),

  dish_ingredients: new Table(
    {
      ...common,
      dish_id: column.text,
      ingredient_id: column.text,
      quantity: column.real,
      unit: column.text,
    },
    { indexes: { dish: ['dish_id'] } },
  ),

  week_days: new Table(
    {
      ...common,
      day: column.text,
      dish_id: column.text,
    },
    { indexes: { day: ['day'] } },
  ),

  general_items: new Table({
    ...common,
    name: column.text,
    is_pantry: column.integer,
  }),

  store_items: new Table({
    ...common,
    label: column.text,
    done: column.integer,
  }),

  list_states: new Table(
    {
      ...common,
      week_start: column.text,
      ref_type: column.text,
      ref_key: column.text,
      missing: column.integer,
      checked: column.integer,
    },
    { indexes: { week: ['week_start'] } },
  ),

  weekmenus: new Table({
    ...common,
    name: column.text,
  }),

  weekmenu_days: new Table(
    {
      ...common,
      weekmenu_id: column.text,
      weekday: column.integer,
      dish_id: column.text,
    },
    { indexes: { menu: ['weekmenu_id'] } },
  ),

  weekmenu_store_items: new Table(
    {
      ...common,
      weekmenu_id: column.text,
      label: column.text,
    },
    { indexes: { menu: ['weekmenu_id'] } },
  ),
})
