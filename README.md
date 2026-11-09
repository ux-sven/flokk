# Flokk

Samle flokken: opprett grupper, inviter medlemmer og planlegg arrangementer der alle stemmer på tidspunkt, fordeler oppgaver og snakker sammen.

- **Grupper** med egen delbar adresse (`flokk.no/turgjengen`), åpne for alle eller kun for inviterte
- **Invitasjonslenker** (gyldige i 14 dager)
- **Arrangementer** med tidsavstemning (ja / kanskje / nei) og valgt tidspunkt
- **Oppgaver** per arrangement med ansvarlig og status
- **Chat** for hele gruppen og for hvert arrangement (sanntid)

Design: Figma – _lenke kommer_

## Teknologi

| Del | Valg |
|---|---|
| App | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui (Base UI), lucide-ikoner, Plus Jakarta Sans |
| Backend | Supabase: Postgres med Row Level Security, Auth (magisk lenke), Realtime |

## Kom i gang

1. Opprett et prosjekt på [supabase.com](https://supabase.com).
2. Kjør migrasjonen i `supabase/migrations/` – enten i SQL-editoren i Supabase-dashbordet, eller med CLI:
   ```bash
   npx supabase link --project-ref <prosjekt-ref>
   npx supabase db push
   ```
3. Under **Authentication → URL Configuration**: sett *Site URL* til `http://localhost:3000` og legg til `http://localhost:3000/auth/callback` som redirect-URL.
4. Kopier miljøvariabler og fyll inn verdier fra **Project Settings → API**:
   ```bash
   cp .env.example .env.local
   ```
5. Start utviklingsserveren:
   ```bash
   npm install
   npm run dev
   ```

## Struktur

```
src/
  app/
    page.tsx                         Forside / mine flokker
    login/                           Innlogging med magisk lenke
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
