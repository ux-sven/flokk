package no.innafor.flokk

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.decodeRecord
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName

private const val MESSAGE_COLUMNS = "id, group_id, event_id, author_id, body, created_at"

@Serializable
private data class NewMessage(
    @SerialName("group_id") val groupId: String,
    @SerialName("event_id") val eventId: String?,
    val body: String,
)

@Composable
fun ChatScreen(groupId: String, eventId: String?, onBack: () -> Unit) {
    val me = supabase.auth.currentUserOrNull()?.id
    var messages by remember { mutableStateOf<List<Message>>(emptyList()) }
    var names by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var text by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    LaunchedEffect(groupId, eventId) {
        names = runCatching { loadMembers(groupId).associate { it.userId to it.name } }.getOrDefault(emptyMap())
        messages = runCatching {
            supabase.from("messages").select(Columns.raw(MESSAGE_COLUMNS)) {
                filter {
                    eq("group_id", groupId)
                    if (eventId != null) eq("event_id", eventId) else exact("event_id", null)
                }
                order("created_at", Order.DESCENDING)
                limit(50)
            }.decodeList<Message>().reversed()
        }.getOrDefault(emptyList())

        val channel = supabase.channel("messages:$groupId:${eventId ?: "group"}")
        val inserts = channel.postgresChangeFlow<PostgresAction.Insert>(schema = "public") {
            table = "messages"
            filter("group_id", FilterOperator.EQ, groupId)
        }
        try {
            channel.subscribe()
            inserts.collect { action ->
                val m = runCatching { action.decodeRecord<Message>() }.getOrNull() ?: return@collect
                if (m.eventId == eventId && messages.none { it.id == m.id }) messages = messages + m
            }
        } finally {
            withContext(NonCancellable) { supabase.realtime.removeChannel(channel) }
        }
    }
    androidx.compose.runtime.DisposableEffect(groupId, eventId) {
        AppRouter.visibleChat = groupId to eventId
        onDispose { AppRouter.visibleChat = null }
    }
    LaunchedEffect(messages.size) { if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex) }

    fun send() {
        val body = text.trim()
        if (body.isEmpty()) return
        sending = true
        scope.launch {
            runCatching {
                supabase.from("messages").insert(NewMessage(groupId, eventId, body)) { select(Columns.raw(MESSAGE_COLUMNS)) }
                    .decodeSingle<Message>()
            }.onSuccess { m ->
                text = ""
                if (messages.none { it.id == m.id }) messages = messages + m
            }
            sending = false
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = { BackBar(if (eventId == null) "Gruppechat" else "Chat for arrangementet", onBack) },
        bottomBar = {
            Row(
                Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).imePadding().padding(horizontal = 12.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    text, { text = it }, placeholder = { Text("Skriv en melding …") },
                    maxLines = 5, shape = RoundedCornerShape(20.dp), modifier = Modifier.weight(1f),
                )
                FilledIconButton(onClick = ::send, enabled = !sending && text.isNotBlank()) {
                    Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "Send")
                }
            }
        },
    ) { padding ->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            state = listState,
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (messages.isEmpty()) item { Text("Ingen meldinger ennå. Si hei!", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(messages, key = { it.id }) { m -> Bubble(m, mine = m.authorId == me, name = names[m.authorId] ?: "Medlem") }
        }
    }
}

@Composable
private fun Bubble(m: Message, mine: Boolean, name: String) {
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom,
    ) {
        if (!mine) {
            Avatar(name, size = 28.dp)
            Spacer(Modifier.padding(4.dp))
        }
        Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start, modifier = Modifier.widthIn(max = 290.dp)) {
            if (!mine) Text(name, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                m.body,
                color = if (mine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.clip(RoundedCornerShape(18.dp))
                    .background(if (mine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            )
            Text(Fmt.messageTime(m.createdAt), fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f))
        }
    }
}
