-- Elk artikel heeft een winkel (label). Geen label betekent Picnic.
--
-- * Ingrediënten, vaste boodschappen (general_items) en de items van een
--   weekmenu krijgen een label_id. Leeg = Picnic. Met een label (bijvoorbeeld
--   "Jumbo") komt het artikel niet op de Picnic-lijst maar op de Lijst.
-- * Nieuwe tabel week_extras: losse Picnic-boodschappen voor één week
--   ("Extra voor deze week").
-- * list_states kan nu ook de keuzes voor zo'n extra onthouden.
--
-- Eenmalig uitvoeren in de SQL-editor van Supabase, NA de eerdere migraties.
-- Daarna in PowerSync de sync-regels opnieuw deployen (er is een stream bij).

-- ---------------------------------------------------------------------------
-- 1. Winkel (label) per artikel
-- ---------------------------------------------------------------------------
-- Geen foreign key: een label dat nog niet op dit apparaat is aangekomen, of
-- dat verwijderd is, mag een upload niet laten vastlopen. De app behandelt
-- een onbekend label als "geen label".

alter table public.ingredients          add column if not exists label_id text;
alter table public.general_items        add column if not exists label_id text;
alter table public.weekmenu_store_items add column if not exists label_id text;

-- Bij een weekmenu-item betekent een leeg label voortaan Picnic. De items die er
-- al stonden waren bedoeld voor de Lijst (andere winkel, zonder label): die
-- krijgen de vaste waarde '__lijst', zodat ze op de Lijst blijven landen.
update public.weekmenu_store_items set label_id = '__lijst' where label_id is null;

-- ---------------------------------------------------------------------------
-- 2. Extra voor deze week (losse Picnic-boodschappen voor één week)
-- ---------------------------------------------------------------------------

create table if not exists public.week_extras (
  id           text primary key default gen_random_uuid()::text,
  household_id text not null references public.households (id) on delete cascade,
  week_start   date not null,
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists week_extras_week_idx on public.week_extras (household_id, week_start);

alter table public.week_extras enable row level security;

drop policy if exists week_extras_select on public.week_extras;
drop policy if exists week_extras_insert on public.week_extras;
drop policy if exists week_extras_update on public.week_extras;
drop policy if exists week_extras_delete on public.week_extras;
create policy week_extras_select on public.week_extras for select to authenticated
  using (public.is_household_member(household_id));
create policy week_extras_insert on public.week_extras for insert to authenticated
  with check (public.is_household_member(household_id));
create policy week_extras_update on public.week_extras for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy week_extras_delete on public.week_extras for delete to authenticated
  using (public.is_household_member(household_id));

drop trigger if exists week_extras_lww on public.week_extras;
create trigger week_extras_lww before insert or update on public.week_extras
  for each row execute function public.lww_guard();

grant select, insert, update, delete on public.week_extras to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Keuzes ("afgevinkt") ook voor de extra's
-- ---------------------------------------------------------------------------

alter table public.list_states drop constraint if exists list_states_ref_type_check;
alter table public.list_states
  add constraint list_states_ref_type_check check (ref_type in ('ingredient', 'general', 'extra'));

-- ---------------------------------------------------------------------------
-- 4. PowerSync mag de nieuwe tabel lezen (zoals bij store_labels)
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  if exists (select 1 from pg_publication where pubname = 'powersync' and not puballtables)
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'powersync' and schemaname = 'public' and tablename = 'week_extras') then
    execute 'alter publication powersync add table public.week_extras';
  end if;

  for r in
    select distinct grantee
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'store_items' and privilege_type = 'SELECT'
       and grantee not in ('anon', 'authenticated', 'service_role', 'postgres', 'PUBLIC')
  loop
    execute format('grant select on public.week_extras to %I', r.grantee);
  end loop;
end;
$$;
