-- De winkellijst wordt een vaste lijst in de stijl van een to-do-app, met labels.
--
-- * Labels (bijvoorbeeld "Jumbo" of "Kruidvat") met een naam, een icoon (emoji of
--   klein plaatje als data-URL) en een kleur. Een item heeft hooguit één label.
-- * Items krijgen een notitie, een ster ("belangrijk"), een eigen volgorde en
--   het tijdstip waarop ze zijn afgevinkt.
--
-- Let op de namen: in store_items is `label` (al sinds de eerste versie) de
-- tekst van het item; het label in de zin van "Jumbo" heet hier `label_id`.
--
-- Eenmalig uitvoeren in de SQL-editor van Supabase, NA de eerdere migraties.
-- Daarna in PowerSync de sync-regels opnieuw deployen (er is een stream bij).

-- ---------------------------------------------------------------------------
-- 1. Labels
-- ---------------------------------------------------------------------------

create table if not exists public.store_labels (
  id           text primary key default gen_random_uuid()::text,
  household_id text not null references public.households (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  icon         text check (icon is null or char_length(icon) <= 60000),
  color        text not null default 'gray' check (color ~ '^[a-z]{3,10}$'),
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index if not exists store_labels_household_idx on public.store_labels (household_id);

alter table public.store_labels enable row level security;

drop policy if exists store_labels_select on public.store_labels;
drop policy if exists store_labels_insert on public.store_labels;
drop policy if exists store_labels_update on public.store_labels;
drop policy if exists store_labels_delete on public.store_labels;
create policy store_labels_select on public.store_labels for select to authenticated
  using (public.is_household_member(household_id));
create policy store_labels_insert on public.store_labels for insert to authenticated
  with check (public.is_household_member(household_id));
create policy store_labels_update on public.store_labels for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy store_labels_delete on public.store_labels for delete to authenticated
  using (public.is_household_member(household_id));

drop trigger if exists store_labels_lww on public.store_labels;
create trigger store_labels_lww before insert or update on public.store_labels
  for each row execute function public.lww_guard();

grant select, insert, update, delete on public.store_labels to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Nieuwe kolommen voor items
-- ---------------------------------------------------------------------------
-- Geen foreign key op label_id: een item mag even naar een label wijzen dat op
-- een ander apparaat nog niet is aangekomen, zonder dat de upload vastloopt.

alter table public.store_items
  add column if not exists label_id     text,
  add column if not exists note         text check (note is null or char_length(note) <= 2000),
  add column if not exists important    boolean not null default false,
  add column if not exists position     double precision,
  add column if not exists completed_at timestamptz;

-- Bestaande items krijgen de volgorde waarin ze zijn toegevoegd.
update public.store_items s
   set position = o.n
  from (select id, row_number() over (partition by household_id order by created_at, id) as n
          from public.store_items) o
 where s.id = o.id and s.position is null;

-- ---------------------------------------------------------------------------
-- 3. PowerSync mag de nieuwe tabel lezen
-- ---------------------------------------------------------------------------
-- De publicatie en de databasegebruiker van PowerSync zijn er al (via ons
-- script of via de koppeling in het PowerSync-dashboard). De nieuwe tabel moet
-- er nog bij, en krijgt dezelfde leesrechten als store_items.

do $$
declare
  r record;
begin
  if exists (select 1 from pg_publication where pubname = 'powersync' and not puballtables)
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'powersync' and schemaname = 'public' and tablename = 'store_labels') then
    execute 'alter publication powersync add table public.store_labels';
  end if;

  for r in
    select distinct grantee
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'store_items' and privilege_type = 'SELECT'
       and grantee not in ('anon', 'authenticated', 'service_role', 'postgres', 'PUBLIC')
  loop
    execute format('grant select on public.store_labels to %I', r.grantee);
  end loop;
end;
$$;
