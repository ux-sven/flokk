# Flokk

Samle flokken: opprett grupper, inviter medlemmer og planlegg arrangementer der alle stemmer på tidspunkt, fordeler oppgaver og snakker sammen.

- **Innlogging** med passord eller magisk lenke, registrering og glemt passord
- **Grupper** med egen delbar adresse (`flokk.no/turgjengen`), åpne for alle eller kun for inviterte
- **Invitasjonslenker** (gyldige i 14 dager)
- **Arrangementer** med tidsavstemning (ja / kanskje / nei), der medlemmene også kan foreslå nye tidspunkt
- **Oppgaver** per arrangement med ansvarlig og status
- **Chat** for hele gruppen og for hvert arrangement (sanntid)

Design: Figma – _lenke kommer_

## Teknologi

| Del | Valg |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Base UI), lucide-ikoner, Plus Jakarta Sans |
| Backend | Supabase: Postgres med Row Level Security, Auth (passord og magisk lenke), Realtime, Edge Functions (Web Push) |

## Kom i gang

1. Sett opp Supabase etter **[docs/supabase-oppsett.md](docs/supabase-oppsett.md)** (prosjekt, migrasjoner, auth-URL-er, e-post).
2. Kopier miljøvariabler og fyll inn:
   ```bash
   cp .env.example .env.local
   ```
3. Verifiser oppsettet og start:
   ```bash
   npm install
   npm run check:supabase
   npm run dev
   ```
4. Push-varsler: **[docs/push-varsler.md](docs/push-varsler.md)**.
5. Publisering (GitHub → Vercel): **[docs/publisering.md](docs/publisering.md)**.

## Struktur

```
src/
  app/
    page.tsx                         Forside / mine flokker
    login/                           Innlogging (passord eller magisk lenke)
    konto/                           Registrering, glemt passord, nytt passord
    auth/callback, auth/logout       Supabase-auth
    grupper/ny/                      Opprett flokk
    [gruppe]/                        Gruppens hjemmeside (delbar URL)
    [gruppe]/arrangement/ny/         Nytt arrangement med tidsforslag
    [gruppe]/arrangement/[id]/       Avstemning, oppgaver og chat
    invitasjon/[token]/              Godta invitasjon
  components/                        Chat, avstemning, oppgaver, UI (shadcn)
  lib/supabase/                      Klienter for nettleser, server og proxy
  proxy.ts                           Fornyer Supabase-sesjonen
supabase/migrations/                 Databaseskjema og RLS-policyer
```

## Tilgangsmodell (RLS)

- Åpne grupper er synlige for alle; lukkede kun for medlemmer.
- Kun medlemmer ser arrangementer, stemmer, oppgaver og meldinger.
- Eier/admin kan lage invitasjoner og redigere gruppen; den som opprettet et arrangement (eller admin) velger tidspunkt.
- Hver bruker kan bare endre sine egne stemmer.

Gruppeadresser som kolliderer med app-ruter (`login`, `grupper`, `invitasjon` …) er reservert i databasen.
