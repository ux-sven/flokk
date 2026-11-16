package no.innafor.flokk

import android.content.Intent
import android.net.Uri
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.flow.MutableStateFlow

/** Det et varsel eller en lenke peker på. */
data class PushTarget(val groupId: String, val eventId: String?, val isMessage: Boolean)

object AppRouter {
    /** Neste mål appen skal navigere til (fra varsel, varselliste eller lenke). */
    val pending = MutableStateFlow<PushTarget?>(null)
    val invitationToken = MutableStateFlow<String?>(null)
    /** Øker når flokklisten bør lastes på nytt (ny flokk, utmelding). */
    val groupsVersion = MutableStateFlow(0)

    /** Chatten som vises nå (for å ikke vise varsel for den) */
    @Volatile var visibleChat: Pair<String, String?>? = null

    fun isViewing(t: PushTarget): Boolean {
        val chat = visibleChat ?: return false
        return t.isMessage && chat.first == t.groupId && chat.second == t.eventId
    }

    fun open(t: PushTarget) {
        pending.value = t
    }

    /** Trykk på systemvarsel (extras) eller flokk://-lenke. */
    suspend fun handle(intent: Intent?) {
        intent ?: return
        intent.getStringExtra("group_id")?.let { g ->
            open(PushTarget(g, intent.getStringExtra("event_id"), intent.getStringExtra("kind") == "message"))
            intent.removeExtra("group_id")
            return
        }
        val uri: Uri = intent.data ?: return
        intent.data = null
        val parts = buildList {
            if (uri.scheme == "flokk") uri.host?.let(::add)
            addAll(uri.pathSegments)
        }.filter { it.isNotBlank() }
        val first = parts.firstOrNull() ?: return
        if (first == "invitasjon" && parts.size > 1) {
            invitationToken.value = parts[1]
            return
        }
        val group = runCatching {
            supabase.from("groups").select(Columns.raw("id")) { filter { eq("slug", first) } }.decodeSingle<IdRow>()
        }.getOrNull() ?: return
        val eventId = if (parts.size > 2 && parts[1] == "arrangement") parts[2] else null
        open(PushTarget(group.id, eventId, false))
    }
}

@kotlinx.serialization.Serializable
data class IdRow(val id: String)
