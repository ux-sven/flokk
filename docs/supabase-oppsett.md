# Supabase-oppsett for Flokk

Denne guiden setter opp et Supabase-prosjekt som passer koden i repoet. Kjør `npm run check:supabase` til slutt for å verifisere.

## 1. Opprett prosjekt

1. Gå til [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. **Region:** velg *Europe (Stockholm) – eu-north-1* (nærmest Norge, data innenfor EU/EØS).
3. Lagre databasepassordet i passordbehandleren din – det trengs for CLI senere.
4. La **Enable Data API** være på. Hvis du får valget *«Automatically expose new tables»*, spiller det ingen rolle – migrasjon nr. 2 gir rettighetene eksplisitt.

## 2. Kjør migrasjonene

Rekkefølgen er viktig. Velg én av måtene:

**A – SQL-editor (enklest):** **SQL Editor → New query**, lim inn hele innholdet i hver fil og kjør:

1. `supabase/migrations/20261109120000_init.sql`
2. `supabase/migrations/20261109130000_grants.sql`
3. `supabase/migrations/20261109140000_reserve_konto_slug.sql`
4. `supabase/migrations/20261109150000_time_suggestions.sql`
5. `supabase/migrations/20261109160000_notifications.sql`
6. `supabase/migrations/20261110090000_push_subscriptions.sql` (deretter: [push-varsler.md](push-varsler.md))
7. `supabase/migrations/20261110120000_members_and_archive.sql`

**B – CLI (anbefalt på sikt, holder styr på hva som er kjørt):**

```bash
npx supabase login
npx supabase link --project-ref <prosjekt-ref>
npx supabase db push
```

> Bruk bare én av måtene for samme prosjekt. Har du kjørt A og vil over på B senere, se `supabase migration repair`.

Sjekk etterpå i **Database → Publications → supabase_realtime** at `messages`, `event_votes`, `event_tasks` og `event_time_options` er med (det gjør migrasjonen, men verdt å se).

## 3. API-nøkler → `.env.local`

**Project Settings → API Keys**:

| Variabel | Hvor | Merk |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://<ref>.supabase.co`) | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **Publishable key** (`sb_publishable_…`) | Eldre `anon`-nøkkel fungerer også |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` lokalt | Produksjons-URL i Vercel |

**Aldri** bruk *secret key* / `service_role` her – alt med `NEXT_PUBLIC_` sendes til nettleseren.

## 4. Authentication

### URL Configuration (*Authentication → URL Configuration*)

| Felt | Lokalt | Produksjon |
|---|---|---|
| Site URL | `http://localhost:3000` | `https://flokk.no` (e.l.) |
| Redirect URLs | `http://localhost:3000/auth/callback**` | `https://flokk.no/auth/callback**` |

For Vercel preview-deployer kan du i tillegg legge til `https://*-<vercel-team>.vercel.app/**`.

Lenken i e-posten går via Supabase og sendes tilbake til `/auth/callback?next=…&code=…`. Merk `**` på slutten: appen legger på `?next=` (hvor brukeren skal etterpå), og uten jokertegnet godtar ikke Supabase adressen. Da havner brukeren på Site URL uten å bli logget inn.

### Providers (*Authentication → Sign In / Providers*)

- **Email:** på (dekker både passord og magisk lenke)
- **Allow new users to sign up:** på (ellers kan ingen registrere seg)
- **Confirm email:** på i produksjon. Lokalt kan du slå det av mens du venter på SMTP – da blir nye brukere logget inn med en gang uten e-post.
- **Minimum password length:** 8 (samme som appen krever)

Appen støtter:

| Flyt | Side | Sender e-post? |
|---|---|---|
| Innlogging med passord | `/login` | Nei |
| Innlogging med magisk lenke | `/login` → «Lenke på e-post» | Ja |
| Registrering | `/konto/registrer` | Ja, hvis «Confirm email» er på |
| Glemt passord | `/konto/glemt-passord` → `/konto/nytt-passord` | Ja |

### E-postmal (*Authentication → Emails → Magic Link*)

- **Subject:** `Logg inn på Flokk`
- **Body:** lim inn `supabase/templates/magic-link.html`

Gjør det samme for **Confirm signup** (`supabase/templates/confirm-signup.html`, emne «Bekreft e-postadressen din») og **Reset Password** (`supabase/templates/reset-password.html`, emne «Nytt passord for Flokk»).

### SMTP – viktig før dere tar den i bruk

Den innebygde e-posttjenesten til Supabase har en svært lav grense (noen få e-poster i timen) og er bare ment for testing. Sett opp egen SMTP under **Authentication → Emails → SMTP Settings** før dere inviterer flere enn et par personer – f.eks. Resend, Postmark eller SendGrid, med et avsenderdomene dere eier (`ikke-svar@flokk.no`).

Juster deretter **Authentication → Rate Limits** (e-poster per time) etter behov.

## 5. Verifiser

```bash
npm run check:supabase
```

Skriptet sjekker miljøvariabler, at tabeller og RPC-er finnes, at RLS skjuler data for utloggede, og at e-postinnlogging/registrering er på. Deretter:

```bash
npm run dev
```

Logg inn, opprett en flokk, lag en invitasjonslenke og åpne den i et privat vindu med en annen e-post.

## 6. Senere

- **Typer:** `npx supabase gen types typescript --linked > src/lib/database.types.ts` gir full typesikkerhet i spørringene.
- **Security Advisor** (*Advisors → Security*) – kjør etter hver migrasjon.
- **Backups / PITR** vurderes før produksjon.
