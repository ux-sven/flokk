# Publisering: GitHub → Vercel

Flokk er en Next.js-app med serverkode (innlogging, server actions, proxy), så den kan ikke ligge
på GitHub Pages, som bare serverer statiske filer. Vi bruker **Vercel**, som lages av samme folk som
Next.js og kobles direkte til GitHub-repoet:

```
git push til main  →  Vercel bygger og publiserer automatisk  →  https://<prosjekt>.vercel.app
pull request / annen branch  →  egen forhåndsvisnings-URL
```

Gratisnivået (Hobby) holder for utvikling og testing. Skal Flokk brukes kommersielt, krever Vercel Pro.

## 1. Opprett prosjektet i Vercel

1. Gå til <https://vercel.com/signup> og velg **Continue with GitHub** (bruk GitHub-kontoen `ux-sven`).
2. **Add New… → Project** → finn `flokk` → **Import**. Gi Vercel tilgang til repoet hvis du blir spurt.
3. Framework oppdages automatisk som **Next.js**. La build-innstillingene stå.
4. Åpne **Environment Variables** og legg inn:

   | Navn | Verdi |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | fra `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | fra `.env.local` |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | fra `.env.local` |

   **Ikke** legg inn `VAPID_PRIVATE_KEY` eller `PUSH_WEBHOOK_SECRET` – de brukes bare av Edge Function i Supabase.

5. **Deploy**. Etter et par minutter får du en adresse, f.eks. `https://flokk-abc.vercel.app`.
   (Du kan endre den under **Settings → Domains**, f.eks. til `flokk.vercel.app` hvis ledig, eller et eget domene.)

6. Legg til `NEXT_PUBLIC_SITE_URL` = produksjonsadressen (uten `/` til slutt) under
   **Settings → Environment Variables**, og trykk **Deployments → ⋯ → Redeploy**.

Serverfunksjonene kjører i Stockholm (`arn1`, satt i `vercel.json`), samme region som Supabase.

## 2. Oppdater Supabase

**Authentication → URL Configuration**

- **Site URL:** produksjonsadressen, f.eks. `https://flokk-abc.vercel.app`
- **Redirect URLs** – behold localhost og legg til:
  - `https://flokk-abc.vercel.app/auth/callback**`
  - (valgfritt, for forhåndsvisninger) `https://flokk-*-ux-sven.vercel.app/auth/callback**`

**Edge Functions → Secrets**

- `SITE_URL` = `https://flokk-abc.vercel.app,http://localhost:3000`
  (kommaseparert, så «Test»-knappen for push virker både lokalt og i produksjon)
- Deploy `send-push` på nytt med innholdet i `supabase/functions/send-push/index.ts`
  (den støtter nå flere adresser i `SITE_URL`).

**E-post:** Supabase sin innebygde e-post har svært lav grense per time. Sett opp egen SMTP
(f.eks. Resend) under **Authentication → Emails → SMTP Settings** før andre skal registrere seg.

## 3. Test

- Åpne produksjonsadressen, registrer deg / logg inn, lag en flokk.
- **Push på iPhone:** Åpne adressen i Safari → Del → «Legg til på Hjem-skjerm» → åpne Flokk fra
  Hjem-skjermen → 🔔 → «Få varsler på denne enheten» → **Test**.
- **Push på Android:** Chrome → 🔔 → «Få varsler på denne enheten» → **Test**.

## Videre

- Hver `git push` til `main` publiseres automatisk. Bygg som feiler publiseres ikke – siste fungerende
  versjon blir liggende.
- Nye migrasjoner i `supabase/migrations/` må fortsatt kjøres i Supabase (SQL Editor eller `npx supabase db push`)
  **før** koden som bruker dem pushes.
