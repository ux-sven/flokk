# Flokk for Android

Native Kotlin-app (Jetpack Compose) som bruker samme Supabase-prosjekt som webappen og iOS-appen.

## Kom i gang

1. Installer Android Studio (har med Java, SDK og emulator).
2. Supabase-nøklene leses automatisk fra webappens `.env.local` når appen bygges – ingenting å kopiere.
3. Åpne mappen `android/` i Android Studio og trykk ▶︎, eller fra terminalen:

   ```sh
   cd android
   ./gradlew installDebug
   ```

## Innhold (første versjon)

- Innlogging med e-post og passord (registrering og glemt passord åpnes på nett)
- Mine flokker, flokkside med arrangementer, medlemmer og «inne nå» (samme presence-kanal som web og iOS)
- Arrangement med stemmegivning, «hvem har svart» og sanntidsoppdatering
- Gruppechat og arrangementschat i sanntid
- Profil: visningsnavn og utlogging

## Ikke laget ennå

- Push-varsler (Firebase Cloud Messaging) og varselliste
- Lage flokk/arrangement, foreslå og velge tidspunkt, oppgaver, invitasjoner og flokkmeny
- App-ikon (nå et midlertidig ikon)
