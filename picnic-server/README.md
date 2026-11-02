# Picnic-server (versie 2)

Een kleine server voor de Google Cloud VM. De web-app praat hier met Picnic via deze server, omdat
Picnic geen officiële API heeft en het inloggen/mandje niet vanuit een browser kan.

> **Let op:** dit gebruikt de **onofficiële** [`picnic-api`](https://github.com/MRVDH/picnic-api).
> Picnic kan er op elk moment iets aan veranderen. Daarom zit die bibliotheek op één plek
> (`src/picnic.ts`) achter een eigen interface, en is alles daaromheen getest met een nep-Picnic.
> **Tegen het echte Picnic is dit niet getest**: dat vraagt jullie eigen account en een sms-code.

Versie 1 van de Picnic-koppeling (de lijst kopiëren of delen) heeft deze server niet nodig.

## Wat de server doet

| Adres | Wat |
| --- | --- |
| `GET /health` | Leeft de server? (geen login nodig) |
| `GET /picnic/status` | Is Picnic gekoppeld? Wacht er een sms-code? |
| `POST /picnic/login` `{email, password}` | Inloggen. Bij 2FA stuurt Picnic een sms en antwoordt de server `second_factor_required`. |
| `POST /picnic/verify` `{code}` | De sms-code invullen. |
| `POST /picnic/logout` | Koppeling verbreken. |
| `GET /picnic/search?q=melk&limit=8` | Producten zoeken. |
| `GET /picnic/cart` | Het huidige mandje. |
| `POST /picnic/cart/add` `{requestId, items:[{productId,count}]}` | Producten in het mandje zetten, zonder ooit dubbel toe te voegen. |

Alles onder `/picnic` vereist `Authorization: Bearer <Supabase-sessie>` van een lid van het huishouden.

## Veiligheid

- **Wie mag erbij?** De server controleert de Supabase-JWT (handtekening, uitgever, audience, verloop)
  en vraagt dan met díe JWT aan Supabase bij welk huishouden de gebruiker hoort. Het huishouden komt
  nooit uit het verzoek zelf, dus de rijbeveiliging van Supabase beslist.
- **Wachtwoord:** wordt alleen gebruikt om in te loggen en daarna vergeten. Bewaard wordt alleen de
  sleutel die Picnic teruggeeft, versleuteld met AES-256-GCM (`PICNIC_ENCRYPTION_KEY`).
- **Eén Picnic-account per huishouden**, gescheiden van andere huishoudens.
- CORS staat alleen de origins in `ALLOWED_ORIGINS` toe; verzoeken zijn beperkt tot 64 KB.

## Nooit dubbel toevoegen

Een mislukte verbinding betekent niet dat Picnic het verzoek niet heeft uitgevoerd. De app stuurt daarom
bij elke "zet in mandje"-actie een `requestId` mee dat bij een herhaling gelijk blijft:

1. Vóór het toevoegen noteert de server hoeveel van elk product al in het mandje zit.
2. Bij een herhaling met hetzelfde `requestId` telt hij wat er sindsdien bij is gekomen en voegt hij
   alleen het tekort toe. Een al afgerond verzoek geeft gewoon hetzelfde resultaat terug (`replayed: true`).
3. Na afloop controleert hij in het echte mandje dat alles erin zit.
4. Verzoeken van één huishouden lopen na elkaar, zodat twee telefoons elkaars telling niet verstoren.

Beperking: past iemand tussen twee pogingen zelf het mandje aan in de Picnic-app, dan kan de telling afwijken.

## Opzetten op de VM

1. Een kleine Linux-VM met Docker, en een domeinnaam die naar het IP van de VM wijst
   (poort 80 en 443 open in de firewall van Google Cloud).
2. `cp .env.example .env` en invullen (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PICNIC_ENCRYPTION_KEY`,
   `ALLOWED_ORIGINS` met het adres van de web-app).
3. `DOMAIN=picnic.jouwdomein.nl docker compose up -d --build`. Caddy regelt het HTTPS-certificaat.
4. Controleer: `curl https://picnic.jouwdomein.nl/health`.

Zonder Docker: `npm ci && npm run build && npm start` (Node 22.13 of nieuwer; de opslag gebruikt de
ingebouwde `node:sqlite`, dus er hoeft niets gecompileerd te worden).

## Ontwikkelen

```bash
npm ci
npm test            # 47 tests met een nep-Picnic
npm run typecheck
npm run dev         # herstart bij wijzigingen; vereist een ingevuld .env
```

## Nog niet gedaan

- De web-app roept deze server nog niet aan. Dat is het volgende stuk: een "Naar Picnic"-scherm dat per
  boodschappenregel een product laat kiezen (en die keuze onthoudt) en dan `cart/add` aanroept.
- Productkeuzes per ingrediënt onthouden (bijvoorbeeld "uien = Picnic Uien 1 kg").
