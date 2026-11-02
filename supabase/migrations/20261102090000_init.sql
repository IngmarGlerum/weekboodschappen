-- Weekplanner: schema, toegangsregels en uitnodigingen.
--
-- Uitgangspunten
--  * Elk huishouden is een eigen "kluis": alle data hangt aan household_id en
--    is alleen leesbaar en schrijfbaar voor leden (requirement 8).
--  * Alle data-tabellen hebben text-id's, `modified_at` en `deleted_at`.
--    Verwijderen is markeren (soft delete), zodat een verwijderd gerecht in een
--    weekmenu als grijs gerecht zichtbaar blijft (requirement 12).
--  * Conflicten: de laatste wijziging wint, per rij, op `modified_at` zoals de
--    client die zette (requirement 9). Zie lww_guard().
--  * Uitnodigen werkt op e-mailadres en vereist een geverifieerd account met
--    precies dat adres (requirement 10). Zie accept_invitation().

-- ---------------------------------------------------------------------------
-- Huishouden, leden, uitnodigingen
-- ---------------------------------------------------------------------------

create table public.households (
  id         text primary key default gen_random_uuid()::text,
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id text not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- Eén huishouden per gebruiker houdt de app eenvoudig.
create unique index household_members_one_household_per_user
  on public.household_members (user_id);

create table public.invitations (
  -- Het id is de (onraadbare) code in de uitnodigingslink. De beveiliging zit
  -- niet in het geheim houden van de link, maar in de controle op e-mailadres.
  id           uuid primary key default gen_random_uuid(),
  household_id text not null references public.households (id) on delete cascade,
  email        text not null check (email = lower(email) and position('@' in email) > 1),
  invited_by   uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users (id)
);

create index invitations_household_idx on public.invitations (household_id);

-- ---------------------------------------------------------------------------
-- Hulpfuncties
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(p_household text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = p_household
      and m.user_id = auth.uid()
  );
$$;

-- Maakt een huishouden en maakt de aanroeper eigenaar.
create or replace function public.create_household(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'already_in_household';
  end if;
  insert into public.households (name) values (btrim(p_name)) returning id into v_id;
  insert into public.household_members (household_id, user_id, role)
    values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

-- Accepteert een uitnodiging. Alleen als:
--  * de aanroeper is ingelogd met een GEVERIFIEERD e-mailadres,
--  * dat adres gelijk is aan het uitgenodigde adres,
--  * de uitnodiging nog niet gebruikt en niet verlopen is.
create or replace function public.accept_invitation(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_inv       public.invitations%rowtype;
  v_email     text;
  v_confirmed timestamptz;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select lower(u.email), u.email_confirmed_at
    into v_email, v_confirmed
    from auth.users u
   where u.id = auth.uid();

  if v_email is null or v_confirmed is null then
    raise exception 'email_not_verified';
  end if;

  select * into v_inv from public.invitations where id = p_id for update;
  if not found then
    raise exception 'invitation_not_found';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation_wrong_email';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invitation_used';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invitation_expired';
  end if;

  begin
    insert into public.household_members (household_id, user_id, role)
      values (v_inv.household_id, auth.uid(), 'member');
  exception when unique_violation then
    raise exception 'already_in_household';
  end;

  update public.invitations
     set accepted_at = now(), accepted_by = auth.uid()
   where id = p_id;

  return v_inv.household_id;
end;
$$;

-- Wie zit er in het huishouden (met e-mailadres), voor het scherm Huishouden.
create or replace function public.household_overview(p_household text)
returns table (user_id uuid, email text, role text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select m.user_id, u.email::text, m.role
    from public.household_members m
    join auth.users u on u.id = m.user_id
   where m.household_id = p_household
     and public.is_household_member(p_household);
$$;

-- Laatste wijziging wint (requirement 9).
--  * `modified_at` komt van de client: het moment waarop de gebruiker iets
--    wijzigde, ook als hij toen offline was. Een oudere wijziging die later
--    binnenkomt overschrijft dus nooit een nieuwere.
--  * Een tijdstip in de toekomst (verkeerd ingestelde telefoonklok) wordt
--    teruggezet naar nu, zodat die ene telefoon niet voorgoed wint.
--  * Een verouderde UPDATE wordt stil overgeslagen (RETURN NULL).
create or replace function public.lww_guard()
returns trigger
language plpgsql
as $$
begin
  if new.modified_at is null or new.modified_at > now() + interval '5 minutes' then
    new.modified_at := now();
  end if;

  if tg_op = 'UPDATE' then
    -- Deze kolommen veranderen nooit.
    new.id           := old.id;
    new.household_id := old.household_id;
    new.created_at   := old.created_at;

    if new.modified_at < old.modified_at then
      return null;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Data-tabellen (alle gesynchroniseerd via PowerSync)
-- ---------------------------------------------------------------------------

-- Requirement 5 en 6: eigen ingrediëntenlijst, met huisvoorraad-markering.
-- Bewust geen unieke index op de naam: twee telefoons die offline hetzelfde
-- ingrediënt toevoegen zouden anders een upload laten vastlopen. Dubbele namen
-- worden in de app voorkomen en bij het optellen samengenomen.
create table public.ingredients (
  id           text primary key default gen_random_uuid()::text,
  household_id text not null references public.households (id) on delete cascade,
  name         text not null,
  default_unit text not null default '',
  is_pantry    boolean not null default false,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Requirement 1: gerecht = naam + ingrediënten met hoeveelheden.
create table public.dishes (
  id           text primary key default gen_random_uuid()::text,
  household_id text not null references public.households (id) on delete cascade,
  name         text not null,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table public.dish_ingredients (
  id            text primary key default gen_random_uuid()::text,
  household_id  text not null references public.households (id) on delete cascade,
  dish_id       text not null references public.dishes (id) on delete cascade,
  ingredient_id text not null references public.ingredients (id),
  quantity      numeric,
  unit          text not null default '',
  modified_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Requirement 2: één avondeten per dag. Het id is `${household_id}|${datum}`,
-- zodat twee telefoons nooit twee rijen voor dezelfde dag maken.
create table public.week_days (
  id           text primary key,
  household_id text not null references public.households (id) on delete cascade,
  day          date not null,
  dish_id      text references public.dishes (id) on delete set null,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Requirement 3: algemene boodschappen (wc-papier, koffie).
create table public.general_items (
  id           text primary key default gen_random_uuid()::text,
  household_id text not null references public.households (id) on delete cascade,
  name         text not null,
  is_pantry    boolean not null default false,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Requirement 7: winkellijst voor een andere supermarkt.
create table public.store_items (
  id           text primary key default gen_random_uuid()::text,
  household_id text not null references public.households (id) on delete cascade,
  label        text not null,
  done         boolean not null default false,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Requirement 4 en 6: per week de keuzes bij de boodschappenlijst.
-- De lijst zelf wordt nooit opgeslagen, die rekent de app uit weekplan,
-- gerechten en algemene boodschappen. Hier staat alleen wat jullie beslissen:
-- "niet in huis" (huisvoorraad die toch nodig is) en "afgevinkt".
create table public.list_states (
  id           text primary key,
  household_id text not null references public.households (id) on delete cascade,
  week_start   date not null,
  ref_type     text not null check (ref_type in ('ingredient', 'general')),
  ref_key      text not null,
  missing      boolean not null default false,
  checked      boolean not null default false,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Requirement 12: opgeslagen weekmenu's. Ze verwijzen naar gerechten (geen kopie).
create table public.weekmenus (
  id           text primary key default gen_random_uuid()::text,
  household_id text not null references public.households (id) on delete cascade,
  name         text not null,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table public.weekmenu_days (
  id           text primary key,
  household_id text not null references public.households (id) on delete cascade,
  weekmenu_id  text not null references public.weekmenus (id) on delete cascade,
  weekday      smallint not null check (weekday between 1 and 7),
  dish_id      text references public.dishes (id) on delete set null,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create table public.weekmenu_store_items (
  id           text primary key default gen_random_uuid()::text,
  household_id text not null references public.households (id) on delete cascade,
  weekmenu_id  text not null references public.weekmenus (id) on delete cascade,
  label        text not null,
  modified_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index ingredients_household_idx          on public.ingredients (household_id);
create index dishes_household_idx               on public.dishes (household_id);
create index dish_ingredients_household_idx     on public.dish_ingredients (household_id);
create index dish_ingredients_dish_idx          on public.dish_ingredients (dish_id);
create index week_days_household_day_idx        on public.week_days (household_id, day);
create index general_items_household_idx        on public.general_items (household_id);
create index store_items_household_idx          on public.store_items (household_id);
create index list_states_household_week_idx     on public.list_states (household_id, week_start);
create index weekmenus_household_idx            on public.weekmenus (household_id);
create index weekmenu_days_menu_idx             on public.weekmenu_days (weekmenu_id);
create index weekmenu_store_items_menu_idx      on public.weekmenu_store_items (weekmenu_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.invitations       enable row level security;

create policy households_select on public.households
  for select to authenticated
  using (public.is_household_member(id));

create policy household_members_select on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));

create policy invitations_select on public.invitations
  for select to authenticated
  using (public.is_household_member(household_id));

create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and invited_by = auth.uid()
    and accepted_at is null
  );

create policy invitations_delete on public.invitations
  for delete to authenticated
  using (public.is_household_member(household_id) and accepted_at is null);

-- Data-tabellen: leden van het huishouden mogen alles; anderen niets.
-- Dezelfde regels en dezelfde laatste-wijziging-wint-trigger voor elke tabel.
do $$
declare
  t text;
begin
  foreach t in array array[
    'ingredients', 'dishes', 'dish_ingredients', 'week_days', 'general_items',
    'store_items', 'list_states', 'weekmenus', 'weekmenu_days', 'weekmenu_store_items'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_household_member(household_id))',
      t || '_select', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_household_member(household_id))',
      t || '_insert', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_household_member(household_id)) with check (public.is_household_member(household_id))',
      t || '_update', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_household_member(household_id))',
      t || '_delete', t);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.lww_guard()',
      t || '_lww', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rechten op de functies
-- ---------------------------------------------------------------------------

revoke all on function public.is_household_member(text) from public;
revoke all on function public.create_household(text)    from public;
revoke all on function public.accept_invitation(uuid)   from public;
revoke all on function public.household_overview(text)  from public;

grant execute on function public.is_household_member(text) to authenticated;
grant execute on function public.create_household(text)    to authenticated;
grant execute on function public.accept_invitation(uuid)   to authenticated;
grant execute on function public.household_overview(text)  to authenticated;
