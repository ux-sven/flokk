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

## Neste steg: betaling

1. App Store Connect: Paid Apps Agreement, bank og skatt, og abonnementsprodukter
   (månedlig, årlig og livstid).
2. RevenueCat med Supabase-brukerens id som app user id.
3. En Edge Function som tar imot webhooks fra RevenueCat og skriver til `user_plans`
   (`source` = `app_store`, `play_store` eller `stripe`; `expires_at` = utløp, `null` for livstid).
4. Kjøpsskjerm og «Gjenopprett kjøp» i appene, og en vilkårsside på `/vilkar`.
