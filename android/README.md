# Flokk for Android

Native Kotlin-app (Jetpack Compose) som bruker samme Supabase-prosjekt som webappen og iOS-appen.

## Kom i gang

1. Installer Android Studio (har med Java, SDK og emulator).
2. Supabase-nøklene leses automatisk fra webappens `.env.local` når appen bygges – ingenting å kopiere.
3. For push: legg `google-services.json` fra Firebase i `android/app/` (se
   [docs/push-varsler.md](../docs/push-varsler.md#android-appen-fcm)). Uten filen bygger appen, men push er av.
4. Åpne mappen `android/` i Android Studio og trykk ▶︎, eller fra terminalen:

   ```sh
   cd android
   ./gradlew installDebug
   ```

## Innhold

- **Innlogging** med e-post og passord (registrering og glemt passord åpnes på nett)
- **Push-varsler** (FCM) med myk forespørsel om tillatelse; trykk åpner riktig skjerm,
  og varsel for chatten man allerede ser på vises ikke
- **Varsler-fane** med ulest-merke, samme tekster som web/iOS, «Merk alle som lest» og sanntid
- **Flokker**: lage ny flokk (navn, adresse, emoji, synlighet, farge og bakgrunn)
- **Flokkside**: arrangementer, gruppechat, medlemmer med «inne nå», invitasjonslenke,
  varslingsnivå, utseende (admin), fjerne medlemmer (hold inne) og melde seg ut
- **Arrangement**: lage nytt med adressesøk (Kartverket), flere tidsforslag og bakgrunn;
  stemme, se hvem som har svart, foreslå tidspunkt, velge/angre tidspunkt, oppgaver med ansvarlig,
  arkivere og slette (arrangør/admin)
- **Chat** for flokk og arrangement i sanntid
- **Lenker**: `flokk://invitasjon/<token>`, `flokk://<flokk>` og `flokk://<flokk>/arrangement/<id>`

## Ikke laget ennå

- App Links (at vanlige https-lenker åpner appen) – krever en `assetlinks.json`-fil på nettsiden
- Ekte app-ikon og Play Store-oppføring
- Profilbilde
