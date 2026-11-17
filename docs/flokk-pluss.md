# Flokk Pluss

Flokk er gratis å bruke, med noen grenser. **Flokk Pluss** fjerner grensene for alle flokkene
brukeren eier. Det er eieren av flokken som har Pluss – medlemmene trenger ikke betale.

| | Gratis | Pluss |
|---|---|---|
| Flokker du eier | 3 | ubegrenset |
| Medlemmer per flokk | 8 | ubegrenset |
| Kommende arrangementer per flokk | 1 om gangen | ubegrenset |

«Kommende» betyr ikke arkivert eller avlyst, og enten med valgt tidspunkt som ikke er passert
(til 6 timer etter start), eller under avstemning med minst ett forslag som ikke er passert.

## Slik virker det

- Grensene håndheves i databasen (migrasjon 15, `20261117120000_plans.sql`) med triggere på
  `groups`, `group_members` og `events`. Appene kan altså ikke omgå dem.
- Grensene sjekkes bare når noe **nytt** legges til. Flokker som allerede er over grensen,
  beholder det de har.
- Når en grense er nådd, svarer databasen med en norsk feilmelding og `hint = 'plan_limit:<type>'`
  (`groups`, `members` eller `upcoming_events`). Web, iOS og Android viser meldingen direkte.
- Gratisgrensene står i `plan_limit()` i migrasjonen. Endrer du dem, oppdater også teksten i
  `src/lib/plan.ts`, `ios/Flokk/Plan.swift` og `android/.../Plan.kt`.
- `my_plan()` gir din plan og hvor mange flokker du eier (vises på profilen).
  `group_plan(gid)` gir grensene for én flokk (vises på flokksiden).

## Gi noen Pluss manuelt

Til testing, eller til venner og familie. Kjør i Supabase → SQL Editor:

```sql
-- Livstid
insert into public.user_plans (user_id, source, note)
select id, 'manual', 'Test' from auth.users where email = 'navn@eksempel.no'
on conflict (user_id) do update set expires_at = null, source = 'manual', updated_at = now();

-- Til en bestemt dato
insert into public.user_plans (user_id, source, expires_at, note)
select id, 'manual', '2027-12-31', 'Prøveperiode' from auth.users where email = 'navn@eksempel.no'
on conflict (user_id) do update set expires_at = excluded.expires_at, updated_at = now();

-- Ta bort Pluss
delete from public.user_plans
where user_id = (select id from auth.users where email = 'navn@eksempel.no');
```

## Betaling på iOS (RevenueCat)

```
iPhone (StoreKit) ──► RevenueCat ──webhook──► Edge Function revenuecat-webhook ──► user_plans
      └── rett etter kjøp: appen ber revenuecat-webhook synke med en gang ──┘
```

- RevenueCat-brukeren er Supabase-brukeren (app user id = Supabase-id), satt ved innlogging.
- `revenuecat-webhook` henter alltid gjeldende status fra RevenueCat sitt API og skriver den til
  `user_plans`. Doble eller forsinkede webhooks gjør derfor ikke noe.
- Pluss gitt manuelt for alltid (`source = 'manual'`, ingen `expires_at`) overskrives aldri.
- Uten `REVENUECAT_IOS_KEY` er kjøp slått av i appen, og profilen sier «kommer snart».

| | Produkt-id | Type | Pris |
|---|---|---|---|
| Årlig | `no.innafor.flokk.plus.yearly` | Auto-fornybart abonnement, 1 år | 199 kr (gjerne 1 uke gratis prøveperiode) |
| Månedlig | `no.innafor.flokk.plus.monthly` | Auto-fornybart abonnement, 1 måned | 29 kr |
| Livstid | `no.innafor.flokk.plus.lifetime` | Ikke-forbruksvare (non-consumable) | 499 kr |

### 1. App Store Connect

1. **Business → Agreements, Tax and Banking:** godta *Paid Apps Agreement* og fyll ut bank og skatt.
   Kjøp virker ikke før avtalen står som *Active*.
2. **Apps → Flokk → Monetization → Subscriptions:** lag gruppen **Flokk Pluss** og de to abonnementene
   over (samme nivå i gruppen). Hver trenger visningsnavn og beskrivelse på norsk, pris, og et
   skjermbilde av kjøpsskjermen til App Review. Prøveperioden legges inn som *Introductory Offer*
   på det årlige.
3. **Monetization → In-App Purchases:** lag livstidskjøpet som *Non-Consumable*.
4. **Users and Access → Integrations → In-App Purchase:** lag en nøkkel og last ned `.p8`-filen.
   Noter *Key ID* og *Issuer ID*. (Ikke del innholdet i filen med noen andre enn RevenueCat.)
5. **App Privacy:** legg til at appen samler inn *Purchases* (kjøpshistorikk), knyttet til brukeren,
   til appens funksjonalitet.

### 2. RevenueCat (app.revenuecat.com)

1. Lag prosjektet **Flokk** og legg til en **App Store**-app med bundle-id `no.innafor.flokk`.
   Last opp In-App Purchase-nøkkelen fra steg 1.4.
2. **Products:** importer de tre produktene.
3. **Entitlements:** lag `plus` og koble alle tre produktene til den.
4. **Offerings:** lag `default` (sett som *current*) med pakkene *Annual*, *Monthly* og *Lifetime*
   koblet til produktene. Appen viser pakkene i den rekkefølgen og fremhever den årlige.
5. **API keys:**
   - Den offentlige iOS-nøkkelen (`appl_…`) skal inn i appen – se steg 4.
   - Lag en **hemmelig** nøkkel (`sk_…`) til Supabase. Funksjonen bruker REST-API v1
     (`/v1/subscribers`); får du 401/403 i loggen, lag nøkkelen for API v1.
6. **Integrations → Webhooks:** URL `https://<prosjekt-ref>.supabase.co/functions/v1/revenuecat-webhook`,
   *Authorization header* `Bearer <REVENUECAT_WEBHOOK_SECRET>`, for både sandbox og produksjon.

### 3. Supabase

Edge Functions → **Secrets**:

| Navn | Verdi |
|---|---|
| `REVENUECAT_API_KEY` | den hemmelige nøkkelen (`sk_…`) |
| `REVENUECAT_WEBHOOK_SECRET` | en lang tilfeldig streng, samme som i webhooken (`openssl rand -hex 32`) |

Deploy funksjonen (JWT-sjekk av – funksjonen sjekker selv):

```bash
npx supabase functions deploy revenuecat-webhook --project-ref <prosjekt-ref> --no-verify-jwt --use-api
```

### 4. Appen

- **Lokalt:** legg `REVENUECAT_IOS_KEY=appl_…` i `.env.local` og kjør `sh ios/scripts/make-secrets.sh`.
- **Xcode Cloud:** legg til miljøvariabelen `REVENUECAT_IOS_KEY` i workflowen.

### 5. Test

1. Lag en *Sandbox Tester* i App Store Connect (Users and Access → Sandbox), og logg inn med den på
   iPhonen under Innstillinger → App Store → Sandbox-konto.
2. Installer fra TestFlight (eller Xcode), gå til Profil → **Oppgrader til Flokk Pluss** og kjøp.
   Sandbox-abonnementer fornyes raskt (et år varer omtrent en time) og stopper etter noen fornyelser.
3. Profilen skal vise **Flokk Pluss**, og `user_plans` skal ha en rad med `source = app_store`.
4. Sandbox-kjøp gir ekte Pluss i databasen, men bare til de utløper.

Feilsøking: Edge Functions → revenuecat-webhook → **Logs**, og RevenueCat → Customers → søk på
brukerens Supabase-id.

## Senere

- Android: Google Play Billing via RevenueCat (samme entitlement og webhook).
- Web: Stripe via RevenueCat Web Billing.
- Vilkårsside på `/vilkar` (kan erstatte Apples standardvilkår i kjøpsskjermen).
