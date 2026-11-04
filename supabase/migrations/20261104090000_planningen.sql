-- Meerdere planningen per account, met een foto per planning.
--
-- In de app heet een huishouden nu een "planning". In de database blijft het
-- `households`, zodat PowerSync en de bestaande gegevens niet hoeven te veranderen.
--
-- Eenmalig uitvoeren in de SQL-editor van Supabase, NA 20261102090000_init.sql.

-- ---------------------------------------------------------------------------
-- 1. Een account mag bij meerdere planningen horen
-- ---------------------------------------------------------------------------

drop index if exists public.household_members_one_household_per_user;

-- Om snel "mijn planningen" op te zoeken (de primaire sleutel begint met household_id).
create index if not exists household_members_user_idx on public.household_members (user_id);

-- ---------------------------------------------------------------------------
-- 2. Foto per planning
-- ---------------------------------------------------------------------------
-- De app verkleint de foto zelf tot een klein vierkant (ongeveer 160 x 160) en
-- slaat hem op als data-URL. Zo synchroniseert hij via PowerSync mee en is hij
-- ook offline te zien. De grens van 200 kB houdt de database klein.

alter table public.households
  add column if not exists avatar text
    check (avatar is null or (avatar like 'data:image/%' and char_length(avatar) <= 200000));

-- ---------------------------------------------------------------------------
-- 3. Functies
-- ---------------------------------------------------------------------------

-- Maakt een planning en maakt de aanroeper eigenaar. Kan nu ook als je al
-- bij een andere planning hoort.
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
  insert into public.households (name) values (btrim(p_name)) returning id into v_id;
  insert into public.household_members (household_id, user_id, role)
    values (v_id, auth.uid(), 'owner');
  return v_id;
end;
$$;

-- Accepteert een uitnodiging (zelfde controles als eerst). Ben je al lid van
-- die planning, dan is dat geen fout: de uitnodiging wordt gewoon afgerond.
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

  insert into public.household_members (household_id, user_id, role)
    values (v_inv.household_id, auth.uid(), 'member')
    on conflict (household_id, user_id) do nothing;

  update public.invitations
     set accepted_at = now(), accepted_by = auth.uid()
   where id = p_id;

  return v_inv.household_id;
end;
$$;

-- Naam en/of foto van een planning wijzigen. Alleen voor leden.
--  * p_name null: naam blijft zoals hij is.
--  * p_avatar null: foto blijft zoals hij is; een lege tekst haalt de foto weg.
create or replace function public.update_household(p_id text, p_name text default null, p_avatar text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_household_member(p_id) then
    raise exception 'not_a_member';
  end if;
  update public.households
     set name   = coalesce(nullif(btrim(p_name), ''), name),
         avatar = case when p_avatar is null then avatar
                       when p_avatar = ''    then null
                       else p_avatar end
   where id = p_id;
end;
$$;

-- Een planning verlaten. Was je het laatste lid, dan verdwijnt de planning met
-- alles erin (anders blijft er een planning over waar niemand meer bij kan).
create or replace function public.leave_household(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  delete from public.household_members where household_id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'not_a_member';
  end if;
  if not exists (select 1 from public.household_members where household_id = p_id) then
    delete from public.households where id = p_id;
  end if;
end;
$$;

revoke all on function public.update_household(text, text, text) from public;
revoke all on function public.leave_household(text)               from public;
grant execute on function public.update_household(text, text, text) to authenticated;
grant execute on function public.leave_household(text)               to authenticated;
