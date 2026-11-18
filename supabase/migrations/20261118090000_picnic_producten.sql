-- Welk Picnic-product hoort bij een artikel. Eén keer kiezen, daarna onthoudt
-- de app het (per planning) en staat het product er de volgende week al.
--
-- ref_type/ref_key zijn dezelfde sleutels als in list_states:
--   'ingredient' + genormaliseerde naam van het ingrediënt,
--   'general'    + id van de vaste boodschap,
--   'extra'      + genormaliseerde naam van de extra (zodat "taart" volgende week weer hetzelfde is).
-- Het id is vast: <household_id>|<ref_type>|<ref_key>, zodat twee telefoons
-- nooit twee koppelingen voor hetzelfde artikel maken.
--
-- Deze migratie gaat via de GitHub Action mee; met de hand uitvoeren is niet nodig.

create table if not exists public.picnic_products (
  id            text primary key,
  household_id  text not null references public.households (id) on delete cascade,
  ref_type      text not null check (ref_type in ('ingredient', 'general', 'extra')),
  ref_key       text not null check (char_length(ref_key) between 1 and 200),
  product_id    text not null check (product_id ~ '^[A-Za-z0-9_-]{1,40}$'),
  product_name  text not null check (char_length(product_name) between 1 and 200),
  unit_quantity text check (unit_quantity is null or char_length(unit_quantity) <= 100),
  image_url     text check (image_url is null or (image_url like 'https://%' and char_length(image_url) <= 500)),
  price_cents   integer check (price_cents is null or price_cents >= 0),
  modified_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists picnic_products_household_idx on public.picnic_products (household_id);

alter table public.picnic_products enable row level security;

drop policy if exists picnic_products_select on public.picnic_products;
drop policy if exists picnic_products_insert on public.picnic_products;
drop policy if exists picnic_products_update on public.picnic_products;
drop policy if exists picnic_products_delete on public.picnic_products;
create policy picnic_products_select on public.picnic_products for select to authenticated
  using (public.is_household_member(household_id));
create policy picnic_products_insert on public.picnic_products for insert to authenticated
  with check (public.is_household_member(household_id));
create policy picnic_products_update on public.picnic_products for update to authenticated
  using (public.is_household_member(household_id)) with check (public.is_household_member(household_id));
create policy picnic_products_delete on public.picnic_products for delete to authenticated
  using (public.is_household_member(household_id));

drop trigger if exists picnic_products_lww on public.picnic_products;
create trigger picnic_products_lww before insert or update on public.picnic_products
  for each row execute function public.lww_guard();

grant select, insert, update, delete on public.picnic_products to authenticated;

-- PowerSync mag de nieuwe tabel lezen (zoals bij store_labels en week_extras).
do $$
declare
  r record;
begin
  if exists (select 1 from pg_publication where pubname = 'powersync' and not puballtables)
     and not exists (select 1 from pg_publication_tables
                      where pubname = 'powersync' and schemaname = 'public' and tablename = 'picnic_products') then
    execute 'alter publication powersync add table public.picnic_products';
  end if;

  for r in
    select distinct grantee
      from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'store_items' and privilege_type = 'SELECT'
       and grantee not in ('anon', 'authenticated', 'service_role', 'postgres', 'PUBLIC')
  loop
    execute format('grant select on public.picnic_products to %I', r.grantee);
  end loop;
end;
$$;
