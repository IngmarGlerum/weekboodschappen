-- Eenmalig uitvoeren in de SQL-editor van Supabase, NA de migratie.
-- Dit staat bewust niet in de migraties omdat er een wachtwoord in zit.
--
-- PowerSync leest wijzigingen mee via logische replicatie. Daarvoor heeft het
-- een publicatie en een eigen databasegebruiker nodig.

-- 1. Publicatie: de tabellen die PowerSync mag volgen.
--    household_members staat erin omdat de sync-definitie daarmee bepaalt
--    welke huishoudens bij welke gebruiker horen.
create publication powersync for table
  public.households,
  public.household_members,
  public.ingredients,
  public.dishes,
  public.dish_ingredients,
  public.week_days,
  public.general_items,
  public.store_items,
  public.list_states,
  public.weekmenus,
  public.weekmenu_days,
  public.weekmenu_store_items;

-- 2. Gebruiker met leesrechten die RLS mag omzeilen. Kies een eigen sterk
--    wachtwoord en vul dat in bij PowerSync (Connections).
create role powersync_role with replication bypassrls login password 'VERVANG_DIT_WACHTWOORD';

grant usage on schema public to powersync_role;
grant select on all tables in schema public to powersync_role;
alter default privileges in schema public grant select on tables to powersync_role;
