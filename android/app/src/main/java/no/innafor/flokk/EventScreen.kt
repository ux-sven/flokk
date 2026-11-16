package no.innafor.flokk

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.QuestionMark
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
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
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private const val EVENT_COLUMNS =
    "id, title, description, location, location_lat, location_lng, backdrop, status, chosen_option_id, created_by, group_id, groups(tint, backdrop)"

@Composable
fun EventScreen(eventId: String, onBack: () -> Unit, onChat: (String, String) -> Unit) {
    val me = supabase.auth.currentUserOrNull()?.id
    var event by remember { mutableStateOf<EventDetail?>(null) }
    var options by remember { mutableStateOf<List<TimeOption>>(emptyList()) }
    var members by remember { mutableStateOf<List<Member>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        try {
            val e = supabase.from("events").select(Columns.raw(EVENT_COLUMNS)) { filter { eq("id", eventId) } }
                .decodeSingle<EventDetail>()
            event = e
            options = supabase.from("event_time_options")
                .select(Columns.raw("id, starts_at, created_by, event_votes(option_id, user_id, answer)")) {
                    filter { eq("event_id", eventId) }
                    order("starts_at", Order.ASCENDING)
                }.decodeList()
            if (members.isEmpty()) members = runCatching { loadMembers(e.groupId) }.getOrDefault(emptyList())
        } catch (e: Exception) {
            if (event == null) error = "Kunne ikke hente arrangementet."
        }
    }

    // Stemmer oppdateres i sanntid
    LaunchedEffect(eventId) {
        load()
        val channel = supabase.channel("votes:$eventId")
        val changes = channel.postgresChangeFlow<PostgresAction>(schema = "public") { table = "event_votes" }
        try {
            channel.subscribe()
            changes.collect { load() }
        } finally {
            withContext(NonCancellable) { supabase.realtime.removeChannel(channel) }
        }
    }

    /** Trykk på valgt svar igjen fjerner stemmen (som på web og iOS). */
    fun vote(optionId: String, answer: VoteAnswer) {
        val uid = me ?: return
        val before = options
        val current = options.firstOrNull { it.id == optionId }?.eventVotes?.firstOrNull { it.userId == uid }?.answer
        options = options.map { o ->
            if (o.id != optionId) o
            else o.copy(eventVotes = o.eventVotes.filter { it.userId != uid } +
                if (current == answer.value) emptyList() else listOf(Vote(optionId, uid, answer.value)))
        }
        scope.launch {
            try {
                if (current == answer.value) {
                    supabase.from("event_votes").delete { filter { eq("option_id", optionId); eq("user_id", uid) } }
                } else {
                    supabase.from("event_votes").upsert(Vote(optionId, uid, answer.value))
                }
                error = null
            } catch (e: Exception) {
                options = before
                error = "Kunne ikke lagre svaret. Prøv igjen."
            }
        }
    }

    Scaffold(containerColor = MaterialTheme.colorScheme.background, topBar = { BackBar(event?.title ?: "", onBack) }) { padding ->
        val e = event ?: return@Scaffold
        val names = members.associate { it.userId to it.name }
        val locked = e.chosenOptionId != null
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            item { EventHeader(e, options.firstOrNull { it.id == e.chosenOptionId }) }
            item { Text("Tidspunkter", fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp)) }
            if (me != null && options.isNotEmpty()) {
                item {
                    val answered = options.count { o -> o.eventVotes.any { it.userId == me } }
                    val voters = options.flatMap { o -> o.eventVotes.map { it.userId } }.toSet().size
                    Text(
                        "Du har svart på $answered av ${options.size} · $voters av ${members.size} har svart",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (options.isEmpty()) item { Text("Ingen tidspunkter er foreslått ennå.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(options, key = { it.id }) { o ->
                OptionCard(
                    option = o,
                    myAnswer = o.eventVotes.firstOrNull { it.userId == me }?.answer?.let(VoteAnswer::of),
                    isChosen = o.id == e.chosenOptionId,
                    locked = locked,
                    names = names,
                    onVote = { vote(o.id, it) },
                )
            }
            error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
            item {
                Card(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).clickable { onChat(e.groupId, e.id) }) {
                    Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.AutoMirrored.Filled.Chat, null)
                        Spacer(Modifier.width(12.dp))
                        Text("Chat for arrangementet", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun EventHeader(e: EventDetail, chosen: TimeOption?) {
    val shape = RoundedCornerShape(24.dp)
    val uri = LocalUriHandler.current
    val ownBackdrop = e.backdrop?.takeIf { it in backdropDrawables }
    SurfaceBox(
        ownBackdrop ?: e.groups?.backdrop, if (ownBackdrop != null) null else e.groups?.tint,
        Modifier.fillMaxWidth().shadow(8.dp, shape, ambientColor = Color.Black.copy(0.08f), spotColor = Color.Black.copy(0.12f)).clip(shape),
    ) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(e.title, fontSize = 30.sp, fontWeight = FontWeight.Bold, lineHeight = 34.sp)
            if (chosen != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.EventAvailable, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(Fmt.dateTime(chosen.startsAt), fontWeight = FontWeight.SemiBold)
                }
            } else {
                Text(
                    "Stemming pågår", fontSize = 12.sp, fontWeight = FontWeight.Medium,
                    modifier = Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.surface.copy(0.7f)).padding(horizontal = 10.dp, vertical = 4.dp),
                )
            }
            e.location?.let { loc ->
                val hasMap = e.locationLat != null && e.locationLng != null
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = if (hasMap) Modifier.clickable {
                        uri.openUri("https://www.google.com/maps/search/?api=1&query=${e.locationLat},${e.locationLng}")
                    } else Modifier,
                ) {
                    Icon(Icons.Default.Place, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(loc, textDecoration = if (hasMap) TextDecoration.Underline else null)
                }
            }
            if (e.description.isNotBlank()) Text(e.description, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f))
        }
    }
}

private fun answerColor(a: VoteAnswer) = when (a) {
    VoteAnswer.YES -> Green
    VoteAnswer.MAYBE -> Amber
    VoteAnswer.NO -> Color(0xFF71717A)
}

private fun answerIcon(a: VoteAnswer) = when (a) {
    VoteAnswer.YES -> Icons.Default.Check
    VoteAnswer.MAYBE -> Icons.Default.QuestionMark
    VoteAnswer.NO -> Icons.Default.Close
}

@Composable
private fun OptionCard(
    option: TimeOption,
    myAnswer: VoteAnswer?,
    isChosen: Boolean,
    locked: Boolean,
    names: Map<String, String>,
    onVote: (VoteAnswer) -> Unit,
) {
    val p = Fmt.parts(option.startsAt)
    val haptics = LocalHapticFeedback.current
    var showVoters by remember { mutableStateOf(false) }
    fun count(a: VoteAnswer) = option.eventVotes.count { it.answer == a.value }

    Card(
        Modifier.fillMaxWidth().alpha(if (locked && !isChosen) 0.6f else 1f)
            .then(if (isChosen) Modifier.border(BorderStroke(2.dp, Green), RoundedCornerShape(24.dp)) else Modifier),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Column(
                    Modifier.width(54.dp).clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant).padding(vertical = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(p.weekday, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(p.day, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text(p.month, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("kl. ${p.time}", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                        if (isChosen) {
                            Text(
                                "Valgt", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                                modifier = Modifier.clip(CircleShape).background(Green).padding(horizontal = 8.dp, vertical = 2.dp),
                            )
                        }
                    }
                    ResultBar(count(VoteAnswer.YES), count(VoteAnswer.MAYBE), count(VoteAnswer.NO))
                    Text(
                        "${count(VoteAnswer.YES)} passer · ${count(VoteAnswer.MAYBE)} kanskje · ${count(VoteAnswer.NO)} passer ikke " +
                            if (showVoters) "▴" else "▾",
                        fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.clickable { showVoters = !showVoters },
                    )
                }
            }
            AnimatedVisibility(showVoters) {
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(MaterialTheme.colorScheme.surfaceVariant).padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    VoteAnswer.entries.forEach { a ->
                        val who = option.eventVotes.filter { it.answer == a.value }.map { names[it.userId] ?: "Medlem" }
                        if (who.isNotEmpty()) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(answerIcon(a), null, Modifier.size(16.dp), tint = answerColor(a))
                                Text(who.joinToString(", "), fontSize = 13.sp)
                            }
                        }
                    }
                    val missing = names.filterKeys { id -> option.eventVotes.none { it.userId == id } }.values.sorted()
                    if (missing.isNotEmpty()) Text("Ikke svart: " + missing.joinToString(", "), fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (locked) {
                myAnswer?.let { Text("Du svarte «${it.label}»", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    VoteAnswer.entries.forEach { a ->
                        val selected = myAnswer == a
                        Row(
                            Modifier.weight(1f).heightIn(min = 44.dp).clip(RoundedCornerShape(10.dp))
                                .background(if (selected) answerColor(a) else MaterialTheme.colorScheme.surfaceVariant)
                                .clickable {
                                    haptics.performHapticFeedback(HapticFeedbackType.SegmentTick)
                                    onVote(a)
                                }
                                .semantics { role = Role.RadioButton; this.selected = selected }
                                .padding(horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center,
                        ) {
                            val fg = if (selected) Color.White else MaterialTheme.colorScheme.onSurface
                            Icon(answerIcon(a), null, Modifier.size(16.dp), tint = fg)
                            Spacer(Modifier.width(4.dp))
                            Text(a.label, color = fg, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultBar(yes: Int, maybe: Int, no: Int) {
    val total = maxOf(yes + maybe + no, 1).toFloat()
    Row(
        Modifier.fillMaxWidth().height(6.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        if (yes > 0) Box(Modifier.weight(yes / total).fillMaxSize().background(Green))
        if (maybe > 0) Box(Modifier.weight(maybe / total).fillMaxSize().background(Amber))
        if (no > 0) Box(Modifier.weight(no / total).fillMaxSize().background(Color(0xFFA1A1AA)))
        val rest = 1f - (yes + maybe + no) / total
        if (rest > 0f) Spacer(Modifier.weight(rest))
    }
}
