# Weekplanner

Samen het avondeten en de boodschappen voor de week plannen. Web-app (installeerbaar als PWA) die ook
zonder verbinding werkt en synchroniseert tussen jullie telefoons.

- **Frontend:** Vite + React + TypeScript + Chakra UI v3 (`web/`)
- **Database en inloggen:** Supabase (`supabase/`)
- **Synchronisatie en offline:** PowerSync (`powersync/`, `web/src/powersync/`)
- **Picnic (versie 2):** Node-server voor de Google Cloud VM (`picnic-server/`)

De requirements en waar ze in de code zitten staan in [`docs/requirements.md`](docs/requirements.md).

## Direct uitproberen (lokale modus)

Zonder Supabase en PowerSync draait de app in *lokale modus*: geen login, alleen op dit apparaat.

```bash
npm --prefix web ci
npm --prefix web run dev        # http://localhost:5173
```

## Zo werkt het (kort)

De app leest en schrijft altijd naar een lokale SQLite-database in de browser. PowerSync zorgt dat die
database synchroniseert met Supabase Postgres, en tussen jullie twee telefoons. Daardoor werkt alles
offline. De boodschappenlijst wordt nooit opgeslagen: hij wordt steeds uitgerekend uit de week, de
gerechten en de algemene boodschappen. Alleen jullie keuzes ("niet in huis", "afgevinkt") worden bewaard,
per week.

**Laatste wijziging wint** werkt per rij, op het tijdstip waarop iemand iets wijzigde (ook als dat offline
was), niet op het moment dat het aankomt. De database wijst een oudere wijziging die later binnenkomt af.
Een telefoonklok die vooruit loopt wordt teruggezet naar nu, zodat één telefoon niet voorgoed wint.

## Opzetten voor tweeën (online)

### 1. Supabase

1. Maak een project aan.
2. Voer de bestanden in `supabase/migrations/` uit, op volgorde van naam (SQL-editor, of met de Supabase CLI):
   eerst `20261102090000_init.sql`, dan `20261104090000_planningen.sql`, dan `20261114090000_lijst.sql`.
3. Voer daarna `supabase/powersync_setup.sql` uit. **Vervang eerst het wachtwoord** in dat bestand.
4. Inloggen gaat met e-mailadres en wachtwoord. Een nieuw account en *wachtwoord vergeten* gaan met een
   code uit de e-mail: zo is het adres één keer geverifieerd, daarna kies je een wachtwoord en blijf je
   ingelogd. Pas in *Authentication > Emails* de sjablonen **Magic Link** én **Confirm signup** aan zodat de
   e-mail `{{ .Token }}` bevat, bijvoorbeeld: `Je code is {{ .Token }}`. Zonder dat krijg je alleen een link.
   Een account dat nog geen wachtwoord heeft (van vóór deze versie) krijgt één keer de vraag er een te kiezen.
5. De ingebouwde mailservice van Supabase is zwaar beperkt. Stel voor dagelijks gebruik een eigen
   SMTP-provider in (*Authentication > SMTP*).

### 2. PowerSync

1. Maak een instance aan en koppel de Supabase-database met de gebruiker `powersync_role` (stap 1.3).
2. Zet de client-authenticatie op Supabase (de JWT's van Supabase worden gecontroleerd via de JWKS van je project).
3. Plak `powersync/sync-config.yaml` in de sync-definitie en deploy die.

De namen van de menu's in het PowerSync-dashboard kunnen afwijken van deze beschrijving.

### 3. Web-app

```bash
cp web/.env.example web/.env.local     # vul URL's en publieke sleutel in
npm --prefix web run build
```

Zet `web/dist` online met HTTPS (dat is nodig voor installeren en voor de service worker). Voor Vercel
staat `web/vercel.json` klaar (alle adressen naar `index.html`). Gebruik nooit de `service_role`-sleutel in de web-app.

### 4. Partner uitnodigen

Eén van jullie logt in en maakt een planning aan. Via het menu linksboven, *Naam, foto en leden*, vul je het
e-mailadres van je partner in en krijg je een link (kopiëren of openen in je mail-app). De link werkt één keer en 7 dagen,
en alleen als je partner inlogt met precies dat e-mailadres. De app verstuurt zelf geen e-mail.

### 5. Picnic (versie 2)

Zie [`picnic-server/README.md`](picnic-server/README.md).

## Controleren

```bash
npm ci && npm --prefix web ci && npm --prefix picnic-server ci   # eenmalig
npm test                          # domein (28) + database (28) + picnic-server (47)
npm --prefix web run typecheck
npm --prefix web run build
```

## Wat is wel en niet getest

Getest: de rekenlogica (unit-tests), de databaseregels (toegang per huishouden, laatste-wijziging-wint,
uitnodigingen, verwijderd gerecht in weekmenu) op een echte Postgres-engine zonder Supabase, de web-app in
een headless browser in lokale modus (week, gerechten, ingrediënten, boodschappen met de afrondprompt,
winkellijst en weekmenu's; herladen, offline openen, manifest en service worker), en de Picnic-server met een nep-Picnic.

**Niet getest, omdat het jullie accounts vraagt of hier niet kan:**

- Tegen een live **Supabase** en **PowerSync**: inloggen met wachtwoord en e-mailcode, de upload-connector, en het
  daadwerkelijk synchroniseren tussen twee apparaten, ook na offline wijzigen. Dit is het eerste wat je
  na het opzetten met twee telefoons moet proberen.
- De schermen **inloggen, uitnodiging en huishouden** (die bestaan alleen online): die zijn gebouwd en
  getypecheckt, maar niet in een browser uitgeprobeerd.
- Het **bewerkscherm van een weekmenu** en het daadwerkelijk toepassen van een weekmenu op een lege week
  (alleen de overschrijfwaarschuwing is in de browser gezien; de rekenlogica is wel unit-getest).
- Tegen het echte **Picnic**: inloggen, 2FA, zoeken en het mandje.
- Het bouwen van de **Docker-image** van de Picnic-server (geen Docker-daemon beschikbaar hier).
- Installeren als app op een echte iPhone of Android.

## Keuzes die ik heb gemaakt

- **Laatste wijziging wint** op tijdstip van wijzigen, niet van aankomen (zie boven).
- **Algemene boodschappen** staan elke week op de lijst totdat je ze weghaalt of als huisvoorraad markeert.
- **Meerdere planningen per account.** In de app heet een huishouden een *planning*; in de database blijft het
  `households`. Je kiest de planning in de zijbalk (menu linksboven); de keuze wordt per apparaat onthouden.
  Alle planningen waar je lid van bent synchroniseren naar het apparaat, zodat je ook offline kunt wisselen.
- **Foto per planning** wordt op het apparaat verkleind tot 160 x 160 en als data-URL in `households.avatar`
  opgeslagen (hooguit 200 kB). Zo synchroniseert hij mee en is hij offline te zien, zonder Supabase Storage.
- **Planning verlaten**: ben je het laatste lid, dan verdwijnt de planning met alles erin.
- **Geen unieke database-regel op ingrediëntnamen.** Een mislukte upload zou anders de hele synchronisatie
  blokkeren. Dubbelen worden in de app voorkomen en de lijst voegt ze samen op genormaliseerde naam.
- **Alles wordt zacht verwijderd** (`deleted_at`). Daardoor kan een verwijderd gerecht grijs in een
  weekmenu blijven staan.
- Alleen avondeten; geen donkere modus; het Picnic-scherm in de app (versie 2) is nog niet gebouwd.
- De service worker legt de app en de SQLite-bestanden vooraf in de cache (ongeveer 9 MB). Dat kan later
  slanker door alleen de benodigde WebAssembly-variant te cachen.

## Mappen

```
web/            React-app (src/pages, src/components, src/data, src/domain, src/powersync, src/auth)
supabase/       migratie, PowerSync-setup en de databasetest
powersync/      sync-definitie
picnic-server/  Picnic-server voor de VM (versie 2)
docs/           requirements en traceability
```
