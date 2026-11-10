# Push-varsler på mobil og datamaskin

Flokk sender varsler som vanlige systemvarsler (Web Push), også når appen er lukket.

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
| `SITE_URL` | `http://localhost:3000` lokalt, senere produksjonsadressen (brukes til CORS) |

### 5. Database Webhook

Database → **Webhooks** → (slå på webhooks hvis du blir spurt) → **Create a new hook**:

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

- **Ingenting kommer:** Edge Functions → send-push → **Logs**. Database → Webhooks → push_notifications viser svarkoder.
- **«Kunne ikke slå på varsler»:** sjekk at `NEXT_PUBLIC_VAPID_PUBLIC_KEY` er satt og at dev-serveren er startet på nytt.
- **Varsler er blokkert:** brukeren må tillate varsler for nettstedet i nettleser- eller telefoninnstillingene.
- **iPhone viser ikke knappen:** Flokk er åpnet i Safari, ikke fra Hjem-skjermen.
