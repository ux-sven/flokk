package no.innafor.flokk

import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.realtime.Realtime
import io.github.jan.supabase.serializer.KotlinXSerializer
import kotlinx.serialization.json.Json

/** Felles Supabase-klient – samme prosjekt og regler (RLS) som webappen og iOS-appen. */
val supabase = createSupabaseClient(
    supabaseUrl = BuildConfig.SUPABASE_URL,
    supabaseKey = BuildConfig.SUPABASE_KEY,
) {
    defaultSerializer = KotlinXSerializer(Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    })
    install(Auth)
    install(Postgrest)
    install(Realtime)
}

/** Lenke til webversjonen (deling, registrering). */
fun siteUrl(path: String): String = BuildConfig.SITE_URL.trimEnd('/') + path
