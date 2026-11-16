package no.innafor.flokk

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.encodeURLParameter
import io.ktor.http.isSuccess
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/** Søk etter norske adresser og stedsnavn i Kartverkets åpne API-er (samme som web og iOS). */
data class Place(val label: String, val detail: String, val isAddress: Boolean, val lat: Double, val lng: Double)

object Places {
    private val http = HttpClient(OkHttp)
    private val json = Json { ignoreUnknownKeys = true }

    @Serializable private data class AddressResponse(val adresser: List<Hit> = emptyList()) {
        @Serializable data class Hit(
            val adressetekst: String,
            val postnummer: String,
            val poststed: String,
            val kommunenavn: String? = null,
            val representasjonspunkt: Point? = null,
        )
        @Serializable data class Point(val lat: Double, val lon: Double)
    }

    @Serializable private data class NameResponse(val navn: List<Hit> = emptyList()) {
        @Serializable data class Hit(
            @SerialName("skrivemåte") val skrivemate: String,
            val navneobjekttype: String,
            val kommuner: List<Kommune>? = null,
            val representasjonspunkt: Point? = null,
        )
        @Serializable data class Kommune(val kommunenavn: String)
        @Serializable data class Point(val nord: Double, @SerialName("øst") val ost: Double)
    }

    private suspend fun get(url: String): String? =
        runCatching { http.get(url).takeIf { it.status.isSuccess() }?.bodyAsText() }.getOrNull()

    private fun titleCase(s: String) = s.lowercase().split(" ").joinToString(" ") { w ->
        w.split("-").joinToString("-") { it.replaceFirstChar(Char::uppercase) }
    }

    suspend fun search(query: String): List<Place> = coroutineScope {
        val q = query.trim().split(Regex("\\s+")).joinToString(" ")
        if (q.length < 3) return@coroutineScope emptyList()
        val base = "https://ws.geonorge.no/adresser/v1/sok?treffPerSide=5&utkoordsys=4258&sok="
        val exact = async { get(base + q.encodeURLParameter()) }
        val prefix = async { get(base + "$q*".encodeURLParameter()) }
        val names = async { get("https://api.kartverket.no/stedsnavn/v1/navn?treffPerSide=5&utkoordsys=4258&sok=" + "$q*".encodeURLParameter()) }

        val out = linkedMapOf<String, Place>()
        fun add(p: Place) { out.putIfAbsent(p.label.lowercase(), p) }
        listOf(exact.await(), prefix.await()).forEach { body ->
            body ?: return@forEach
            runCatching { json.decodeFromString<AddressResponse>(body) }.getOrNull()?.adresser?.forEach { a ->
                val pt = a.representasjonspunkt ?: return@forEach
                val poststed = titleCase(a.poststed)
                val kommune = a.kommunenavn?.let(::titleCase)
                add(Place("${a.adressetekst}, ${a.postnummer} $poststed", if (kommune != null && kommune != poststed) "Adresse i $kommune" else "Adresse", true, pt.lat, pt.lon))
            }
        }
        names.await()?.let { body ->
            runCatching { json.decodeFromString<NameResponse>(body) }.getOrNull()?.navn?.forEach { n ->
                val pt = n.representasjonspunkt ?: return@forEach
                val kommune = n.kommuner?.firstOrNull()?.kommunenavn
                add(Place(if (kommune != null && kommune != n.skrivemate) "${n.skrivemate}, $kommune" else n.skrivemate, n.navneobjekttype, false, pt.nord, pt.ost))
            }
        }
        // Adresser først når søket har husnummer, ellers stedsnavn først
        val hasNumber = q.any { it.isDigit() }
        out.values.sortedBy { if (it.isAddress == hasNumber) 0 else 1 }.take(8)
    }
}
