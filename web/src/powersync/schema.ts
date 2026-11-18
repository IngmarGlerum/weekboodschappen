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
    // Winkel; leeg = Picnic.
    label_id: column.text,
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
    label_id: column.text,
  }),

  // Welk Picnic-product bij een artikel hoort (één keer kiezen, daarna onthouden).
  picnic_products: new Table({
    ...common,
    ref_type: column.text,
    ref_key: column.text,
    product_id: column.text,
    product_name: column.text,
    unit_quantity: column.text,
    image_url: column.text,
    price_cents: column.integer,
  }),

  // Losse Picnic-boodschappen voor één week.
  week_extras: new Table(
    {
      ...common,
      week_start: column.text,
      name: column.text,
    },
    { indexes: { week: ['week_start'] } },
  ),

  // `label` is de tekst van het item; het label ("Jumbo") is `label_id`.
  store_items: new Table({
    ...common,
    label: column.text,
    done: column.integer,
    label_id: column.text,
    note: column.text,
    important: column.integer,
    position: column.real,
    completed_at: column.text,
  }),

  store_labels: new Table({
    ...common,
    name: column.text,
    icon: column.text,
    color: column.text,
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
      label_id: column.text,
    },
    { indexes: { menu: ['weekmenu_id'] } },
  ),
})
