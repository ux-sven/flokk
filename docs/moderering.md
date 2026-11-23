# Moderering: rapporter og blokkering

Apple krever at apper med innhold fra brukerne (chat, flokker, arrangementer) har
**rapportering**, **blokkering** og vilkår med **nulltoleranse** for støtende innhold – og at
utvikleren behandler rapporter **innen 24 timer**.

- **Blokkering** (`user_blocks`): den som blokkerer ser ikke lenger meldingene til den blokkerte
  (RLS på `messages`, også i sanntid) og får ikke varsler om det den blokkerte gjør. Den blokkerte
  får ikke vite det. Oppheves under Min profil / Profil.
- **Rapportering** (`content_reports`, via `report_content()`): en melding eller en bruker kan
  rapporteres fra «⋯» i chatten (lang-trykk i iOS-appen) og i medlemslisten. Rapporten lagrer en
  kopi av meldingen (`snapshot`) og navnet, så den finnes selv om meldingen slettes.
- **Vilkår**: `/vilkar`, som man godtar når man oppretter en konto.

## Følg med på nye rapporter

Supabase → SQL Editor:

```sql
select r.created_at, r.kind, r.reason, r.reported_name, r.snapshot, r.details,
       g.name as flokk, r.id, r.message_id, r.reported_user_id
from content_reports r
left join groups g on g.id = r.group_id
where r.status = 'open'
order by r.created_at;
```

Tips: lagre spørringen i SQL Editor, og sjekk den daglig. (Senere kan en Database Webhook på
`content_reports` sende deg e-post eller push ved nye rapporter.)

## Behandle en rapport

```sql
-- Slett meldingen
delete from messages where id = '<message_id>';

-- Fjern brukeren fra flokken
delete from group_members where group_id = '<group_id>' and user_id = '<reported_user_id>';

-- Grovt brudd: steng kontoen (sletter brukeren og alt den har lagt inn)
delete from auth.users where id = '<reported_user_id>';

-- Marker rapporten som behandlet (eller 'dismissed' hvis den ikke brøt vilkårene)
update content_reports set status = 'resolved', resolved_at = now() where id = '<rapport-id>';
```

Eiere og administratorer av en flokk kan også selv slette meldinger og fjerne medlemmer.
