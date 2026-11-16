# Flokk for iOS

Native SwiftUI-app som bruker samme Supabase-prosjekt (database, innlogging, RLS og sanntid) som webappen.

## Kom i gang

1. Lag `Flokk/Secrets.swift` fra webappens `.env.local` (filen er gitignorert):

   ```sh
   sh ios/scripts/make-secrets.sh
   ```

2. Åpne `ios/Flokk.xcodeproj` i Xcode, velg en iPhone-simulator og trykk ▶︎.

Supabase-pakken (`supabase-swift`) hentes automatisk via Swift Package Manager.

## Innhold

- Innlogging med e-post og passord (registrering og glemt passord åpnes på nett)
- Mine flokker, flokkside med arrangementer, medlemmer og «inne nå» (samme presence-kanal som web)
- Arrangement med stemmegivning (Passer / Kanskje / Passer ikke), sanntidsoppdatering og kart-lenke
- Gruppechat og arrangementschat med sanntid
- Profil: endre visningsnavn og logge ut

## Ikke laget ennå

- Opprette flokk og arrangement, foreslå tidspunkt, velge tidspunkt (admin)
- Oppgaver, invitasjoner og utmelding
- Push-varsler (APNs) og dyplenker (Universal Links) for invitasjoner
- App-ikon
