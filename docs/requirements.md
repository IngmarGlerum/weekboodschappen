# Requirements en waar ze in de code zitten

De volledige tekst met acceptatiecriteria staat in het Claude-document
https://claude.ai/artifact/EMvBY3xJRZHmso9Zz8moDS. Hieronder de twaalf requirements in het kort, met per
requirement waar het is gebouwd en hoe het is gecontroleerd.

Afkortingen bij "Gecontroleerd": **domein** = unit-tests in `web/src/domain/*.test.ts` (28), **SQL** = de
databasetest `supabase/tests/migrations.test.mjs` (28 controles, echte Postgres-semantiek via PGlite),
**browser** = de rooktest in headless Chromium in lokale modus (24 controles), **server** =
`picnic-server/test` (47 tests). "Niet live" betekent: nog niet tegen een echte Supabase/PowerSync geprobeerd.

| # | Requirement | Waar | Gecontroleerd |
| --- | --- | --- | --- |
| 1 | Een gerecht is een naam met ingrediënten en hoeveelheden (geen recept, foto of personen). | `web/src/pages/DishEditPage.tsx`, `DishesPage.tsx`; `repo.saveDish`; tabellen `dishes`, `dish_ingredients` | browser |
| 2 | Weekoverzicht met één avondeten per dag. | `pages/WeekPage.tsx`; tabel `week_days` (vaste id per huishouden en dag) | browser |
| 3 | Algemene boodschappenlijst (wc-papier, koffie). | `pages/ShoppingPage.tsx` (toevoegen en beheren); tabel `general_items` | domein, browser |
| 4 | Gecombineerde lijst met opgetelde hoeveelheden en gerechtnamen: "4 uien (stamppot, nasi)". | `domain/shoppingList.ts` (`buildShoppingList`); de lijst wordt nooit opgeslagen maar steeds uitgerekend | domein (o.a. optellen, eenheden, dezelfde naam, gerecht twee keer), browser |
| 5 | Eigen ingrediëntenlijst om uit te kiezen; nieuwe toevoegen; geen dubbelen. | `pages/IngredientsPage.tsx`, nieuw ingrediënt in `DishEditPage`; `repo.addIngredient` voorkomt dubbelen op genormaliseerde naam, de lijst voegt ze ook samen | domein, browser |
| 6 | Huisvoorraad. Bij afronden: "Ben je nog iets vergeten?" met blok "Huisvoorraad voor het weekmenu", een scheiding, en blok "Andere huisvoorraad"; wat "niet in huis" is komt met gerechtnamen op de lijst. | `is_pantry` op ingrediënten en algemene boodschappen; `ShoppingPage.tsx` (`FinishDialog`); `list_states.missing` | domein, browser |
| 7 | Aparte winkellijst voor een andere supermarkt (vervangt Microsoft To Do). | `pages/StorePage.tsx`; tabel `store_items` | browser |
| 8 | Gedeeld huishouden met realtime synchronisatie. | Supabase (`supabase/migrations`, rijbeveiliging per huishouden) + PowerSync (`powersync/sync-config.yaml`, `web/src/powersync`) | SQL (toegang en scheiding); synchronisatie **niet live** |
| 9 | Offline werken, later synchroniseren, laatste wijziging wint. | Lokale SQLite via PowerSync; `web/src/powersync/connector.ts`; trigger `lww_guard` | SQL (oudere wijziging wint niet, klok in de toekomst, herhaalde upsert); offline openen in browser; offline wijzigen en daarna syncen **niet live** |
| 10 | Partner uitnodigen met een link; alleen met geverifieerd, passend e-mailadres; eenmalig; verloopt na 7 dagen. | `pages/HouseholdPage.tsx`, `pages/InvitePage.tsx`, `pages/LoginForm.tsx`; functie `accept_invitation` in de migratie | SQL (juist/fout adres, gebruikt, verlopen, daarna dezelfde gegevens); de e-mail zelf en de schermen zelf **niet live** (alleen getypecheckt) |
| 11 | Responsieve, installeerbare web-app (PWA) die offline opent. | `web/vite.config.ts` (manifest, service worker), `web/src/main.tsx` | browser (manifest, service worker actief, offline herladen) |
| 12 | Weekmenu's: opslaan met naam, "Maak nieuw weekmenu", bladeren, kiezen vult week en lijsten (ook winkellijst-items, af te vinken); verwijst naar gerechten; huisvoorraadstatus niet opgeslagen; bevestiging bij overschrijven; verwijderprompt "Dit gerecht is onderdeel van een weekmenu. Wat wil je doen?" met grijs gerecht daarna. | `WeekPage.tsx`, `WeekmenusPage.tsx`, `WeekmenuEditPage.tsx`, `components/ApplyWeekmenuDialog.tsx`, `DishEditPage.tsx`; `domain/weekmenu.ts` | domein, SQL (verwijderd gerecht blijft met naam gekoppeld), browser (opslaan, verwijderprompt, grijs gerecht, overschrijfwaarschuwing) |

## Picnic

- **Versie 1** (klaar): de boodschappenlijst kopiëren of delen (`ShoppingPage.tsx`, knop "Kopieer of deel lijst").
- **Versie 2** (server klaar, scherm nog niet): `picnic-server/` voor de Google Cloud VM. Zie
  `picnic-server/README.md`. Gebruikt de onofficiële `picnic-api`, die kan breken als Picnic iets verandert.
