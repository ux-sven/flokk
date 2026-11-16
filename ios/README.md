# Flokk for iOS

Native SwiftUI-app som bruker samme Supabase-prosjekt (database, innlogging, RLS og sanntid) som webappen.

## Kom i gang

1. Lag `Flokk/Secrets.swift` fra webappens `.env.local` (filen er gitignorert):

   ```sh
   sh ios/scripts/make-secrets.sh
   ```

2. Åpne `ios/Flokk.xcodeproj` i Xcode, velg ditt Team under **Signing & Capabilities**,
   velg en iPhone (eller simulator) og trykk ▶︎.

Supabase-pakken (`supabase-swift`) hentes automatisk via Swift Package Manager.
Push-varsler krever migrasjon 11 og en APNs-nøkkel – se [docs/push-varsler.md](../docs/push-varsler.md#ios-appen-apns).

## Innhold

- **Innlogging** med e-post og passord (registrering og glemt passord åpnes på nett)
- **Push-varsler** (APNs) med myk forespørsel, ulest-merke på app-ikonet og trykk som åpner riktig skjerm
- **Varsler-fane** med samme tekster som webappen, «Merk alle som lest» og sanntidsoppdatering
- **Flokker**: lage ny flokk (navn, adresse, emoji, synlighet, farge og bakgrunn)
- **Flokkside**: arrangementer, gruppechat, medlemmer med «inne nå», invitasjonslenke,
  varslingsnivå, utseende (admin), fjerne medlemmer (admin) og melde seg ut
- **Arrangement**: lage nytt med adressesøk (Kartverket), flere tidsforslag og bakgrunn;
  stemme, se hvem som har svart, foreslå tidspunkt, velge/angre tidspunkt, oppgaver med ansvarlig,
  arkivere og slette (arrangør/admin)
- **Chat** for flokk og arrangement i sanntid
- **Lenker**: `flokk://invitasjon/<token>`, `flokk://<flokk>` og `flokk://<flokk>/arrangement/<id>` åpner appen

## Ikke laget ennå

- Universal Links (at vanlige https-lenker åpner appen) – krever Team ID og en
  `apple-app-site-association`-fil på nettsiden
- App Store-oppføring (app-ikonet lages med `npm run icons`)
- Profilbilde
