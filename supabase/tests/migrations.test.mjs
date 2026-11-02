// Draait de Supabase-migraties tegen een echte Postgres (PGlite) met een nagebootst
// auth-schema en test toegangsregels, laatste-wijziging-wint en uitnodigingen.
// Supabase zelf (auth.users, de rol `authenticated`, de JWT-claim) is nagebootst;
// dit bewijst de SQL, niet de koppeling met een echt Supabase-project.
//
// Draaien: npm run test:sql
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'

const MIGRATIONS = new URL('../migrations/', import.meta.url)
const db = new PGlite()

let failures = 0
let passed = 0
function check(name, ok, detail = '') {
  if (ok) { passed++; console.log(`  ok   ${name}`) }
  else { failures++; console.log(`  FAIL ${name} ${detail}`) }
}
async function expectError(name, fn, pattern) {
  try { await fn(); check(name, false, '(geen fout)') }
  catch (e) { check(name, pattern.test(e.message), `(kreeg: ${e.message})`) }
}

// --- Nagebootste Supabase-omgeving ------------------------------------------
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role authenticated;
  grant usage on schema public, auth to authenticated;
`)

for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
  await db.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'))
}
await db.exec(`
  grant all on all tables in schema public to authenticated;
  grant select on auth.users to authenticated;
`)
console.log('Migratie draait zonder fouten.')

const A = '11111111-1111-1111-1111-111111111111' // Henk
const B = '22222222-2222-2222-2222-222222222222' // zijn vrouw
const C = '33333333-3333-3333-3333-333333333333' // vreemde
await db.exec(`
  insert into auth.users values
    ('${A}', 'henk@example.com', now()),
    ('${B}', 'vrouw@example.com', now()),
    ('${C}', 'ander@example.com', now());
`)

// Voer SQL uit als ingelogde gebruiker (rol authenticated + RLS actief).
async function as(user, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`)
  try { return await fn() }
  finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`) }
}
const q = (sql, params) => db.query(sql, params)
// Tijdstippen in het verleden (de trigger zet de toekomst bewust terug naar nu).
const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString()

// --- Huishouden ----------------------------------------------------------------
console.log('\nHuishouden')
const hid = await as(A, async () => (await q(`select public.create_household('Huishouden Henk') as id`)).rows[0].id)
check('Henk maakt een huishouden', typeof hid === 'string' && hid.length > 10)
await expectError('Henk kan geen tweede huishouden maken',
  () => as(A, () => q(`select public.create_household('Nog een')`)), /already_in_household/)
await expectError('zonder login kan niemand een huishouden maken',
  () => as('', () => q(`select public.create_household('x')`)), /not_authenticated/)

// --- Row Level Security ----------------------------------------------------------
console.log('\nToegangsregels (RLS)')
await as(A, () => q(
  `insert into public.ingredients (id, household_id, name, modified_at) values ('ing-ui', $1, 'uien', $2)`, [hid, ago(120)]))
const seenByA = await as(A, async () => (await q(`select count(*)::int c from public.ingredients`)).rows[0].c)
check('Henk ziet zijn eigen ingrediënt', seenByA === 1)
const seenByC = await as(C, async () => (await q(`select count(*)::int c from public.ingredients`)).rows[0].c)
check('een vreemde ziet niets', seenByC === 0)
await expectError('een vreemde kan niet in dit huishouden schrijven',
  () => as(C, () => q(`insert into public.ingredients (id, household_id, name) values ('hack', $1, 'x')`, [hid])),
  /row-level security/)
const hhSeenByC = await as(C, async () => (await q(`select count(*)::int c from public.households`)).rows[0].c)
check('een vreemde ziet het huishouden niet', hhSeenByC === 0)
await expectError('leden toevoegen buiten de uitnodiging om kan niet',
  () => as(C, () => q(`insert into public.household_members (household_id, user_id) values ($1, $2)`, [hid, C])),
  /row-level security|permission denied/)

// --- Laatste wijziging wint --------------------------------------------------------
console.log('\nLaatste wijziging wint (requirement 9)')
await as(A, () => q(
  `update public.ingredients set name = 'uien (10:05)', modified_at = $1 where id = 'ing-ui'`, [ago(55)]))
let name = (await q(`select name from public.ingredients where id = 'ing-ui'`)).rows[0].name
check('nieuwere wijziging wordt opgeslagen', name === 'uien (10:05)')

await as(A, () => q(
  `update public.ingredients set name = 'uien (10:00, offline)', modified_at = $1 where id = 'ing-ui'`, [ago(60)]))
name = (await q(`select name from public.ingredients where id = 'ing-ui'`)).rows[0].name
check('een oudere wijziging die later binnenkomt wint NIET', name === 'uien (10:05)', `(naam is ${name})`)

await as(A, () => q(
  `update public.ingredients set name = 'uien (10:30)', modified_at = $1 where id = 'ing-ui'`, [ago(30)]))
name = (await q(`select name from public.ingredients where id = 'ing-ui'`)).rows[0].name
check('een nog nieuwere wijziging wint wel', name === 'uien (10:30)')

await as(A, () => q(
  `update public.ingredients set name = 'uien (toekomst)', modified_at = '2099-01-01T00:00:00Z' where id = 'ing-ui'`))
const future = (await q(`select name, modified_at from public.ingredients where id = 'ing-ui'`)).rows[0]
check('een klok in de toekomst wordt teruggezet naar nu',
  future.name === 'uien (toekomst)' && new Date(future.modified_at) < new Date('2030-01-01'),
  `(modified_at is ${future.modified_at})`)

await as(A, () => q(`update public.ingredients set household_id = 'ander', id = 'x' where id = 'ing-ui'`)).catch(() => {})
const stable = (await q(`select id, household_id from public.ingredients`)).rows[0]
check('id en household_id kunnen niet veranderen', stable.id === 'ing-ui' && stable.household_id === hid)

// Een upsert (PUT) van een bestaande rij met oudere tijd overschrijft niets.
await as(A, () => q(
  `insert into public.ingredients (id, household_id, name, modified_at) values ('ing-ui', $1, 'oud', '2020-01-01T00:00:00Z')
   on conflict (id) do update set name = excluded.name, modified_at = excluded.modified_at`, [hid]))
name = (await q(`select name from public.ingredients where id = 'ing-ui'`)).rows[0].name
check('een herhaalde (oudere) upsert overschrijft niets', name === 'uien (toekomst)', `(naam is ${name})`)

// --- Uitnodigen (requirement 10) -----------------------------------------------------
console.log('\nUitnodigen met e-mailcontrole (requirement 10)')
const inv = await as(A, async () => (await q(
  `insert into public.invitations (household_id, email, invited_by) values ($1, 'vrouw@example.com', $2) returning id, expires_at, created_at`,
  [hid, A])).rows[0])
const days = (new Date(inv.expires_at) - new Date(inv.created_at)) / 86_400_000
check('uitnodiging verloopt standaard na 7 dagen', Math.round(days) === 7, `(${days} dagen)`)
await expectError('een uitnodiging voor een ander adres wordt geweigerd',
  () => as(C, () => q(`select public.accept_invitation($1)`, [inv.id])), /invitation_wrong_email/)
await expectError('een onbekende uitnodiging wordt geweigerd',
  () => as(B, () => q(`select public.accept_invitation(gen_random_uuid())`)), /invitation_not_found/)

await db.exec(`update auth.users set email_confirmed_at = null where id = '${B}'`)
await expectError('met een ongeverifieerd e-mailadres geen toegang',
  () => as(B, () => q(`select public.accept_invitation($1)`, [inv.id])), /email_not_verified/)
await db.exec(`update auth.users set email_confirmed_at = now() where id = '${B}'`)

const joined = await as(B, async () => (await q(`select public.accept_invitation($1) as id`, [inv.id])).rows[0].id)
check('met het juiste, geverifieerde adres lukt het', joined === hid)
await expectError('de uitnodiging werkt maar één keer',
  () => as(B, () => q(`select public.accept_invitation($1)`, [inv.id])), /already_in_household|invitation_used/)

const bSees = await as(B, async () => (await q(`select name from public.ingredients`)).rows.map((r) => r.name))
check('na accepteren ziet de vrouw dezelfde gegevens', bSees.length === 1)
await as(B, () => q(
  `insert into public.dishes (id, household_id, name) values ('d1', $1, 'stamppot')`, [hid]))
const aSeesDish = await as(A, async () => (await q(`select name from public.dishes`)).rows.map((r) => r.name))
check('en kan ze ook bewerken (Henk ziet haar gerecht)', aSeesDish.join() === 'stamppot')

const members = await as(A, async () => (await q(`select email, role from public.household_overview($1) order by email`, [hid])).rows)
check('het huishouden toont beide leden met e-mailadres',
  members.length === 2 && members[0].email === 'henk@example.com' && members[1].email === 'vrouw@example.com')

// Verlopen en al gebruikt, met een tweede uitnodiging.
const expired = await as(A, async () => (await q(
  `insert into public.invitations (household_id, email, invited_by, expires_at) values ($1, 'ander@example.com', $2, now() - interval '1 day') returning id`,
  [hid, A])).rows[0])
await expectError('een verlopen uitnodiging wordt geweigerd',
  () => as(C, () => q(`select public.accept_invitation($1)`, [expired.id])), /invitation_expired/)

// Uitnodigen kan alleen door leden.
await expectError('een vreemde kan geen uitnodiging maken voor andermans huishouden',
  () => as(C, () => q(`insert into public.invitations (household_id, email, invited_by) values ($1, 'x@example.com', $2)`, [hid, C])),
  /row-level security/)
await expectError('een e-mailadres moet kleine letters zijn',
  () => as(A, () => q(`insert into public.invitations (household_id, email, invited_by) values ($1, 'Vrouw@Example.com', $2)`, [hid, A])),
  /check constraint|violates/)

// --- Soft delete en weekmenu (requirement 12) ------------------------------------------
console.log('\nWeekmenu en verwijderd gerecht (requirement 12)')
await as(A, async () => {
  await q(`insert into public.weekmenus (id, household_id, name) values ('m1', $1, 'Weekmenu 1')`, [hid])
  await q(`insert into public.weekmenu_days (id, household_id, weekmenu_id, weekday, dish_id) values ('m1|1', $1, 'm1', 1, 'd1')`, [hid])
  await q(`update public.dishes set deleted_at = now(), modified_at = now() where id = 'd1'`)
})
const ghost = (await q(`select d.name, d.deleted_at is not null as deleted from public.weekmenu_days w join public.dishes d on d.id = w.dish_id where w.id = 'm1|1'`)).rows[0]
check('een verwijderd gerecht blijft met naam gekoppeld aan het weekmenu', ghost.name === 'stamppot' && ghost.deleted === true)
await expectError('weekdag buiten 1 tot 7 wordt geweigerd',
  () => as(A, () => q(`insert into public.weekmenu_days (id, household_id, weekmenu_id, weekday) values ('m1|9', $1, 'm1', 9)`, [hid])),
  /check constraint|violates/)

console.log(`\n${passed} gelukt, ${failures} mislukt`)
process.exit(failures ? 1 : 0)
