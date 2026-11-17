# Push-varsler på mobil og datamaskin

Flokk sender varsler som vanlige systemvarsler, også når appen er lukket:
Web Push til nettlesere, APNs til iOS-appen og FCM til Android-appen
(se [iOS-appen (APNs)](#ios-appen-apns) og [Android-appen (FCM)](#android-appen-fcm) nederst).

```
Noe skjer (melding, stemme, nytt arrangement …)
  → databasetrigger lager rad i public.notifications
  → Database Webhook kaller Edge Function «send-push»
  → send-push sender til alle enhetene mottakeren har slått på push for
  → service workeren (public/sw.js) viser varselet; trykk åpner riktig side
```

Varslingsnivået hver bruker har valgt per flokk (Alt / Det viktigste / Ingenting) gjelder også push.
Chat, stemmer og forslag samles: et nytt push erstatter det forrige for samme tråd.

## Hvor virker det?

| Plattform | Krav |
|---|---|
| Android (Chrome, Edge, Firefox, Samsung) | Fungerer direkte i nettleseren |
| iPhone / iPad (iOS 16.4+) | Flokk må legges til på Hjem-skjermen (Del → «Legg til på Hjem-skjerm») og åpnes derfra |
| Mac, Windows, Linux | Chrome, Edge, Firefox og Safari |

Push krever HTTPS. `localhost` er unntatt, så du kan teste på datamaskinen lokalt, men for å teste på
mobilen må appen være deployet (f.eks. Vercel) – telefonen når ikke `localhost` på maskinen din.

## Oppsett

### 1. Nøkler (allerede gjort for lokal utvikling)

`.env.local` har fått `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` og `PUSH_WEBHOOK_SECRET`.
Nye nøkler lages med `npm run vapid`. Bruk de **samme** nøklene i alle miljøer som deler database –
bytter du nøkler, slutter eksisterende abonnementer å virke og brukerne må slå på push på nytt.

Start `npm run dev` på nytt etter at `.env.local` er endret.

### 2. Migrasjon

Kjør `supabase/migrations/20261110090000_push_subscriptions.sql` i SQL Editor.

### 3. Edge Function «send-push»

**Via dashbordet:** Edge Functions → **Deploy a new function** → **Via Editor**.
Navn: `send-push`. Lim inn hele `supabase/functions/send-push/index.ts` og deploy.
Åpne funksjonen → **Details/Settings** → slå **av** «Verify JWT with legacy secret»/«Enforce JWT verification»
(funksjonen sjekker selv webhook-hemmeligheten og brukerens innlogging).

**Eller via CLI:**

```bash
npx supabase login
npx supabase functions deploy send-push --project-ref <prosjekt-ref> --no-verify-jwt --use-api
```

### 4. Hemmeligheter for funksjonen

Edge Functions → **Secrets** → legg til:

| Navn | Verdi |
|---|---|
| `VAPID_PUBLIC_KEY` | samme som `NEXT_PUBLIC_VAPID_PUBLIC_KEY` i `.env.local` |
| `VAPID_PRIVATE_KEY` | fra `.env.local` |
| `VAPID_SUBJECT` | `mailto:` + en adresse push-tjenestene kan kontakte ved problemer, eller nettstedets `https://`-adresse |
| `PUSH_WEBHOOK_SECRET` | fra `.env.local` |
| `SITE_URL` | Adressene appen kjører på, kommaseparert, f.eks. `https://flokk.vercel.app,http://localhost:3000` (brukes til CORS) |

### 5. Database Webhook

**Integrations** → **Database Webhooks** → (slå på webhooks hvis du blir spurt) → **Create a new hook**:

- **Name:** `push_notifications`
- **Table:** `notifications`
- **Events:** ✅ Insert ✅ Update
- **Type:** Supabase Edge Functions → `send-push`, metode `POST`, timeout `5000`
- **HTTP Headers:** legg til `x-flokk-secret` = verdien av `PUSH_WEBHOOK_SECRET`

### 6. Sjekk og test

```bash
npm run check:supabase
```

Åpne Flokk, trykk på 🔔 → **Få varsler på denne enheten** → tillat varsler → **Test**.
For ekte varsler trenger du en bruker til: du får ikke varsel om dine egne handlinger.

## Feilsøking

- **Ingenting kommer:** Edge Functions → send-push → **Logs**. Integrations → Database Webhooks → push_notifications viser svarkoder, og `select * from net._http_response order by created desc limit 10;` i SQL Editor viser svarene fra send-push.
- **«Kunne ikke slå på varsler»:** sjekk at `NEXT_PUBLIC_VAPID_PUBLIC_KEY` er satt og at dev-serveren er startet på nytt.
- **Varsler er blokkert:** brukeren må tillate varsler for nettstedet i nettleser- eller telefoninnstillingene.
- **iPhone viser ikke knappen:** Flokk er åpnet i Safari, ikke fra Hjem-skjermen.


## iOS-appen (APNs)

Samme kjede som over – `send-push` sender i tillegg til alle iPhoner mottakeren har logget inn på i appen
(tabellen `device_tokens`). Et trykk på varselet åpner riktig flokk, arrangement eller chat i appen.

### 1. Migrasjon

Kjør `supabase/migrations/20261116100000_device_tokens.sql` i SQL Editor.

### 2. Nøkkel fra Apple (krever Apple Developer Program)

1. [developer.apple.com](https://developer.apple.com/account) → **Certificates, Identifiers & Profiles** → **Keys** → **+**
2. Gi nøkkelen et navn (f.eks. «Flokk push»), kryss av for **Apple Push Notifications service (APNs)**,
   trykk **Configure** og velg miljø **Sandbox & Production** → Save → Continue → Register.
   Velger du bare ett miljø, svarer Apple `403 BadEnvironmentKeyInToken` for det andre:
   Xcode-bygg bruker *sandbox*, TestFlight og App Store bruker *production*.
3. Last ned `.p8`-filen (kan bare lastes ned én gang!) og noter **Key ID**
4. **Team ID** står øverst til høyre under **Membership details**
5. Under **Identifiers** må App ID-en `no.innafor.flokk` ha **Push Notifications** slått på
   (Xcode gjør dette automatisk når du velger Team under Signing & Capabilities)

### 3. Hemmeligheter for send-push

Edge Functions → **Secrets** → legg til:

| Navn | Verdi |
|---|---|
| `APNS_KEY_ID` | Key ID fra steg 2 |
| `APNS_TEAM_ID` | Team ID fra steg 2 |
| `APNS_BUNDLE_ID` | `no.innafor.flokk` |
| `APNS_PRIVATE_KEY` | Hele innholdet i `.p8`-filen, inkludert `-----BEGIN PRIVATE KEY-----`-linjene |

Deploy deretter `send-push` på nytt med innholdet i `supabase/functions/send-push/index.ts`.

### 4. Test

1. Åpne `ios/Flokk.xcodeproj`, velg ditt Team under **Signing & Capabilities** og kjør appen på en iPhone
   (push virker også i simulatoren på Mac med Apple Silicon)
2. Logg inn og trykk **Slå på varsler**. Under **Profil → Varsler** skal det stå «Varsler er på for denne telefonen»
3. Få noen til å skrive i en chat du er med i – varselet kommer på telefonen

Utviklingsbygg fra Xcode bruker Apples sandkasse og App Store/TestFlight-bygg produksjon; appen
oppgir selv hvilket miljø tokenet hører til, så samme nøkkel fungerer for begge.


## Android-appen (FCM)

`send-push` sender til Android-telefoner via Firebase Cloud Messaging (HTTP v1). Meldingene er rene
data-meldinger, så appen bygger varselet selv og et trykk åpner riktig flokk, arrangement eller chat.
Migrasjon 11 (`device_tokens`) brukes for både iOS og Android.

### 1. Firebase-prosjekt (gratis, krever Google-konto)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Opprett prosjekt** (f.eks. «Flokk»).
   Google Analytics kan slås av.
2. **Legg til app → Android**, pakkenavn `no.innafor.flokk`, kallenavn «Flokk». SHA-1 trengs ikke.
3. Last ned `google-services.json` og legg den i `android/app/` (filen er gitignorert).
4. Bygg appen på nytt – Gradle oppdager filen og slår på push automatisk.

### 2. Tjenestekonto for send-push

1. Firebase → ⚙️ **Prosjektinnstillinger** → **Tjenestekontoer** → **Generer ny privat nøkkel**
2. Edge Functions → **Secrets** → legg til `FCM_SERVICE_ACCOUNT` med **hele** innholdet i JSON-filen
3. Deploy `send-push` på nytt med innholdet i `supabase/functions/send-push/index.ts`

Hold JSON-nøkkelen hemmelig (den gir tilgang til å sende push i prosjektet) – ikke legg den i repoet.

### 3. Test

1. Kjør appen på en telefon eller emulator **med Google Play** og logg inn
2. Trykk **Slå på varsler** og tillat. Under **Profil** skal det stå «Varsler er på for denne telefonen»
3. Få noen til å skrive i en chat du er med i – varselet kommer på telefonen
