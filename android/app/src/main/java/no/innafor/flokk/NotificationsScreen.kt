package no.innafor.flokk

import android.Manifest
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.EventBusy
import androidx.compose.material.icons.filled.EventNote
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.time.Duration
import java.time.Instant

@Serializable
data class AppNotification(
    val id: String,
    val kind: String,
    val count: Int = 1,
    val data: NData = NData(),
    @SerialName("read_at") val readAt: String? = null,
    @SerialName("updated_at") val updatedAt: String,
    @SerialName("event_id") val eventId: String? = null,
    val group: GroupRef? = null,
    val actor: Actor? = null,
) {
    @Serializable data class NData(
        val title: String? = null,
        @SerialName("starts_at") val startsAt: String? = null,
        val task: String? = null,
        val preview: String? = null,
    )
    @Serializable data class GroupRef(val id: String, val name: String, val emoji: String? = null)
    @Serializable data class Actor(@SerialName("display_name") val displayName: String = "")

    val unread get() = readAt == null

    /** Samme tekster som webappen og iOS (describeNotification). */
    val text: String
        get() {
            val who = actor?.displayName?.ifBlank { null } ?: "Noen"
            val title = data.title?.let { "«$it»" } ?: "arrangementet"
            val whenText = data.startsAt?.let(Fmt::dateTime) ?: ""
            return when (kind) {
                "event_created" -> "$who har laget $title. Stem på tidspunkt!"
                "time_suggested" -> if (count > 1) "$count nye forslag til tidspunkt for $title" else "$who foreslo $whenText for $title"
                "vote" -> if (count > 1) "$count nye stemmer på $title" else "$who har stemt på $title"
                "time_chosen" -> "$title er satt til $whenText"
                "event_cancelled" -> "$title er avlyst"
                "task_assigned" -> "$who ga deg oppgaven «${data.task ?: ""}» til $title"
                "message" -> {
                    val where = data.title?.let { "«$it»" } ?: "gruppechatten"
                    if (count > 1) "$count nye meldinger i $where" else "$who i $where: ${data.preview ?: ""}"
                }
                else -> "Noe nytt har skjedd i flokken"
            }
        }
}

/** Varsler for innlogget bruker; ulest-telleren vises på fanen. */
object NotificationCenter {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val items = MutableStateFlow<List<AppNotification>?>(null)

    suspend fun load() {
        runCatching {
            supabase.from("notifications").select(
                Columns.raw("id, kind, count, data, read_at, updated_at, event_id, group:groups(id, name, emoji), actor:profiles!notifications_actor_id_fkey(display_name)"),
            ) {
                order("updated_at", Order.DESCENDING)
                limit(50)
            }.decodeList<AppNotification>()
        }.onSuccess { items.value = it }
    }

    fun refreshSoon() { scope.launch { load() } }

    suspend fun listen(userId: String) {
        val channel = supabase.channel("notifications:$userId")
        val changes = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "notifications"
            filter("user_id", FilterOperator.EQ, userId)
        }
        try {
            channel.subscribe()
            changes.collect { load() }
        } finally {
            withContext(NonCancellable) { supabase.realtime.removeChannel(channel) }
        }
    }

    suspend fun markRead(n: AppNotification) {
        if (!n.unread) return
        runCatching {
            supabase.from("notifications").update({ set("read_at", Instant.now().toString()) }) { filter { eq("id", n.id) } }
        }
        load()
    }

    suspend fun markAllRead() {
        runCatching {
            supabase.from("notifications").update({ set("read_at", Instant.now().toString()) }) { filter { exact("read_at", null) } }
        }
        load()
    }

    fun clear() { items.value = null }
}

private fun symbol(kind: String) = when (kind) {
    "message" -> Icons.AutoMirrored.Filled.Chat
    "vote" -> Icons.Default.ThumbUp
    "time_suggested" -> Icons.Default.Schedule
    "time_chosen" -> Icons.Default.EventAvailable
    "event_cancelled" -> Icons.Default.EventBusy
    "task_assigned" -> Icons.Default.Checklist
    else -> Icons.Default.EventNote
}

private fun relative(iso: String): String {
    val t = Fmt.parse(iso)?.toInstant() ?: return ""
    val d = Duration.between(t, Instant.now())
    return when {
        d.toMinutes() < 1 -> "nå nettopp"
        d.toMinutes() < 60 -> "for ${d.toMinutes()} min siden"
        d.toHours() < 24 -> "for ${d.toHours()} t siden"
        d.toDays() < 7 -> "for ${d.toDays()} ${if (d.toDays() == 1L) "dag" else "dager"} siden"
        else -> Fmt.messageTime(iso)
    }
}

@Composable
fun NotificationsScreen() {
    val items by NotificationCenter.items.collectAsState()
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { NotificationCenter.load() }

    LazyColumn(
        Modifier.fillMaxSize().statusBarsPadding(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Varsler", fontSize = 34.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                if (items.orEmpty().any { it.unread }) {
                    TextButton(onClick = { scope.launch { NotificationCenter.markAllRead() } }) { Text("Merk alle som lest") }
                }
            }
        }
        item { PushPrompt() }
        val list = items
        if (list != null && list.isEmpty()) {
            item { Text("Ingen varsler ennå. Her ser du nye arrangementer, stemmer og meldinger.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        items(list.orEmpty(), key = { it.id }) { n ->
            Card(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).clickable {
                    scope.launch { NotificationCenter.markRead(n) }
                    n.group?.let { AppRouter.open(PushTarget(it.id, n.eventId, n.kind == "message")) }
                },
                radius = 20.dp,
            ) {
                Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(Modifier.size(36.dp).clip(CircleShape).background(tintColor("mint")), contentAlignment = Alignment.Center) {
                        Icon(symbol(n.kind), null, Modifier.size(18.dp))
                    }
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        n.group?.let {
                            Text(listOfNotNull(it.emoji, it.name).joinToString(" "), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text(n.text, fontWeight = if (n.unread) FontWeight.SemiBold else FontWeight.Normal)
                        Text(relative(n.updatedAt), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (n.unread) Box(Modifier.padding(top = 6.dp).size(9.dp).clip(CircleShape).background(MaterialTheme.colorScheme.primary))
                }
            }
        }
    }
}

/** Myk forespørsel før systemdialogen – og hjelp hvis varsler er slått av. */
@Composable
fun PushPrompt() {
    val context = LocalContext.current
    var granted by remember { mutableStateOf(PushManager.hasPermission(context)) }
    val registered by PushManager.registered.collectAsState()
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        granted = ok
        if (ok) PushManager.refresh(context)
    }
    if (granted && (registered || !PushManager.isConfigured(context))) return
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Default.NotificationsActive, null)
                Text("Få beskjed når noe skjer", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            }
            Text(
                "Varsler om nye arrangementer, tidspunkt som blir valgt og nye meldinger i flokkene dine.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (!granted) {
                Button(onClick = {
                    if (Build.VERSION.SDK_INT >= 33) launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }) { Text("Slå på varsler") }
                TextButton(onClick = {
                    context.startActivity(
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName),
                    )
                }) { Text("Åpne innstillinger") }
            } else {
                OutlinedButton(onClick = { PushManager.refresh(context) }) { Text("Registrer telefonen på nytt") }
            }
        }
    }
}

/** Gjør innloggings-avhengig oppstart: tokens og varselstrøm. */
@Composable
fun SessionEffects() {
    val context = LocalContext.current
    LaunchedEffect(Unit) {
        if (PushManager.hasPermission(context)) PushManager.refresh(context)
        NotificationCenter.load()
        supabase.auth.currentUserOrNull()?.id?.let { NotificationCenter.listen(it) }
    }
}
