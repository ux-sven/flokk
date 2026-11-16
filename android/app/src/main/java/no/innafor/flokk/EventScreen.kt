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
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import java.time.Instant
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Archive
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.Unarchive
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch

private const val EVENT_COLUMNS =
    "id, title, description, location, location_lat, location_lng, backdrop, status, chosen_option_id, created_by, group_id, groups(tint, backdrop, slug), allow_time_suggestions, archived_at"

@Composable
fun EventScreen(eventId: String, onBack: () -> Unit, onChat: (String, String) -> Unit) {
    val me = supabase.auth.currentUserOrNull()?.id
    var event by remember { mutableStateOf<EventDetail?>(null) }
    var options by remember { mutableStateOf<List<TimeOption>>(emptyList()) }
    var members by remember { mutableStateOf<List<Member>>(emptyList()) }
    var tasks by remember { mutableStateOf<List<EventTask>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var menuOpen by remember { mutableStateOf(false) }
    var suggesting by remember { mutableStateOf(false) }
    var editingBackdrop by remember { mutableStateOf(false) }
    var editingDetails by remember { mutableStateOf(false) }
    val context = androidx.compose.ui.platform.LocalContext.current
    var confirmChoose by remember { mutableStateOf<TimeOption?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val myRole = members.firstOrNull { it.userId == me }?.role
    val canManage = myRole == "owner" || myRole == "admin" || event?.createdBy == me
    val isArchived = event?.archivedAt != null
    val canSuggest = event?.let { e -> !isArchived && e.chosenOptionId == null && (canManage || (e.allowTimeSuggestions && e.status == "planning")) } ?: false

    suspend fun loadTasks() {
        runCatching {
            supabase.from("event_tasks").select(Columns.raw("id, title, assignee_id, status, created_by")) {
                filter { eq("event_id", eventId) }
                order("created_at", Order.ASCENDING)
            }.decodeList<EventTask>()
        }.onSuccess { tasks = it }
    }

    /** Oppdaterer arrangementet; tom liste betyr at RLS nektet. */
    suspend fun save(patch: JsonObject): Boolean {
        val rows = runCatching {
            supabase.from("events").update(patch) {
                select(Columns.raw(EVENT_COLUMNS))
                filter { eq("id", eventId) }
            }.decodeList<EventDetail>()
        }.getOrElse { error = "Kunne ikke lagre endringen."; return false }
        val e = rows.firstOrNull() ?: run { error = "Bare arrangøren eller en admin kan endre dette."; return false }
        event = e
        return true
    }

    fun update(patch: JsonObject) {
        scope.launch { save(patch) }
    }

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
            loadTasks()
        } catch (e: Exception) {
            if (event == null) error = "Kunne ikke hente arrangementet."
        }
    }

    // Stemmer oppdateres i sanntid
    LaunchedEffect(eventId) {
        load()
        val channel = supabase.channel("event:$eventId")
        val votes = channel.postgresChangeFlow<PostgresAction>(schema = "public") { table = "event_votes" }
        val opts = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "event_time_options"
            filter("event_id", FilterOperator.EQ, eventId)
        }
        val taskChanges = channel.postgresChangeFlow<PostgresAction>(schema = "public") {
            table = "event_tasks"
            filter("event_id", FilterOperator.EQ, eventId)
        }
        try {
            channel.subscribe()
            merge(votes, opts).collectLatestWith(taskChanges, onMain = { load() }, onTasks = { loadTasks() })
        } finally {
            withContext(NonCancellable) { supabase.realtime.removeChannel(channel) }
        }
    }

    /** Trykk på valgt svar igjen fjerner stemmen (som på web og iOS). */
    fun vote(optionId: String, answer: VoteAnswer, toggle: Boolean = true) {
        val uid = me ?: return
        val before = options
        val current = options.firstOrNull { it.id == optionId }?.eventVotes?.firstOrNull { it.userId == uid }?.answer
        if (!toggle && current == answer.value) return
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

    if (suggesting) SuggestTimeDialog(onDismiss = { suggesting = false }) { date ->
        val uid = me ?: return@SuggestTimeDialog "Du må være innlogget."
        if (date.toInstant().isBefore(Instant.now())) return@SuggestTimeDialog "Tidspunktet har allerede vært."
        try {
            val created = supabase.from("event_time_options").insert(
                buildJsonObject { put("event_id", eventId); put("starts_at", date.withSecond(0).withNano(0).toInstant().toString()) },
            ) { select(Columns.raw("id")) }.decodeSingle<IdRow>()
            runCatching { supabase.from("event_votes").upsert(Vote(created.id, uid, "yes")) }
            load()
            null
        } catch (e: Exception) {
            when {
                e.message?.contains("23505") == true || e.message?.contains("duplicate") == true -> "Det tidspunktet er allerede foreslått."
                e.message?.contains("42501") == true || e.message?.contains("row-level") == true -> "Forslag er stengt for dette arrangementet."
                else -> "Kunne ikke legge til forslaget."
            }
        }
    }
    confirmChoose?.let { o ->
        ConfirmDialog(
            "Velge ${Fmt.dateTime(o.startsAt)}?", "Alle i flokken får beskjed, og stemmingen stenges.", "Velg tidspunktet",
            onConfirm = { update(buildJsonObject { put("chosen_option_id", o.id); put("status", "scheduled") }) },
            onDismiss = { confirmChoose = null },
        )
    }
    if (confirmDelete) ConfirmDialog(
        "Slette arrangementet?",
        "Tidspunkter, stemmer, oppgaver og chat slettes for godt. Vil du bare skjule det, kan du arkivere i stedet.",
        "Slett for alle",
        onConfirm = {
            scope.launch {
                val rows = runCatching {
                    supabase.from("events").delete { select(Columns.raw("id")); filter { eq("id", eventId) } }.decodeList<IdRow>()
                }.getOrNull()
                if (rows.isNullOrEmpty()) error = "Bare arrangøren eller en admin kan slette." else onBack()
            }
        },
        onDismiss = { confirmDelete = false },
    )
    if (editingDetails) event?.let { e ->
        EditEventSheet(e, ::save) { editingDetails = false }
    }
    if (editingBackdrop) event?.let { e ->
        BackdropSheet(e.backdrop?.takeIf { it in backdropDrawables }, e.groups?.backdrop to e.groups?.tint, { b ->
            update(buildJsonObject { if (b == null) put("backdrop", JsonNull) else put("backdrop", b) })
        }) { editingBackdrop = false }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            BackBar(event?.title ?: "", onBack) {
                if (canManage && event != null) {
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, contentDescription = "Administrer arrangementet") }
                        DropdownMenu(menuOpen, { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Andre kan foreslå tidspunkt") },
                                trailingIcon = { Switch(event?.allowTimeSuggestions == true, onCheckedChange = null) },
                                onClick = { update(buildJsonObject { put("allow_time_suggestions", event?.allowTimeSuggestions != true) }) },
                            )
                            if (!isArchived) DropdownMenuItem(
                                text = { Text("Rediger") }, leadingIcon = { Icon(Icons.Default.Edit, null) },
                                onClick = { menuOpen = false; editingDetails = true },
                            )
                            DropdownMenuItem(
                                text = { Text("Bakgrunn") }, leadingIcon = { Icon(Icons.Default.Palette, null) },
                                onClick = { menuOpen = false; editingBackdrop = true },
                            )
                            HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text(if (isArchived) "Hent tilbake fra arkivet" else "Arkiver") },
                                leadingIcon = { Icon(if (isArchived) Icons.Default.Unarchive else Icons.Default.Archive, null) },
                                onClick = {
                                    menuOpen = false
                                    update(buildJsonObject { if (isArchived) put("archived_at", JsonNull) else put("archived_at", Instant.now().toString()) })
                                },
                            )
                            DropdownMenuItem(
                                text = { Text("Slett arrangementet", color = MaterialTheme.colorScheme.error) },
                                leadingIcon = { Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error) },
                                onClick = { menuOpen = false; confirmDelete = true },
                            )
                        }
                    }
                }
            }
        },
    ) { padding ->
        val e = event ?: return@Scaffold
        val names = members.associate { it.userId to it.name }
        val locked = e.chosenOptionId != null
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            if (isArchived) item {
                Text(
                    "Arrangementet er arkivert og vises ikke i flokkens liste.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(MaterialTheme.colorScheme.surfaceVariant).padding(14.dp),
                )
            }
            item { EventHeader(e, options.firstOrNull { it.id == e.chosenOptionId }) }
            options.firstOrNull { it.id == e.chosenOptionId }?.takeIf { !isArchived }?.let { c ->
                item(key = "attendance") {
                    AttendanceCard(
                        c, members, me,
                        onAnswer = { vote(c.id, it, toggle = false) },
                        onAddToCalendar = { addToCalendar(context, e, c.startsAt, siteUrl("/${e.groups?.slug ?: ""}/arrangement/${e.id}")) },
                    )
                }
            }
            item {
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (e.chosenOptionId == null) "Tidspunkter" else "Tidspunkt", fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    if (canSuggest) OutlinedButton(onClick = { suggesting = true }) {
                        Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Foreslå")
                    }
                }
            }
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
                    locked = locked || isArchived,
                    names = names,
                    onVote = { vote(o.id, it) },
                    actions = if (isArchived) null else fun(): List<Pair<String, () -> Unit>> {
                        val list = mutableListOf<Pair<String, () -> Unit>>()
                        if (canManage) {
                            if (o.id == e.chosenOptionId) list += "Angre valget" to {
                                update(buildJsonObject { put("chosen_option_id", JsonNull); put("status", "planning") })
                            } else if (e.chosenOptionId == null) list += "Velg dette tidspunktet" to { confirmChoose = o }
                        }
                        if ((canManage || o.createdBy == me) && o.id != e.chosenOptionId) list += "Fjern tidspunktet" to {
                            scope.launch {
                                runCatching { supabase.from("event_time_options").delete { filter { eq("id", o.id) } } }
                                load()
                            }
                        }
                        return list
                    },
                )
            }
            error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
            item { TaskList(eventId, tasks, members, me) { scope.launch { loadTasks() } } }
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
    actions: (() -> List<Pair<String, () -> Unit>>)? = null,
) {
    val p = Fmt.parts(option.startsAt)
    var actionsOpen by remember { mutableStateOf(false) }
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
                        Spacer(Modifier.weight(1f))
                        val list = actions?.invoke().orEmpty()
                        if (list.isNotEmpty()) Box {
                            IconButton(onClick = { actionsOpen = true }, modifier = Modifier.size(32.dp)) {
                                Icon(Icons.Default.MoreHoriz, contentDescription = "Valg for tidspunktet")
                            }
                            DropdownMenu(actionsOpen, { actionsOpen = false }) {
                                list.forEach { (label, act) ->
                                    DropdownMenuItem(text = { Text(label) }, onClick = { actionsOpen = false; act() })
                                }
                            }
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


/** Lytter på to strømmer samtidig: endringer som krever full lasting, og oppgaver. */
private suspend fun Flow<PostgresAction>.collectLatestWith(
    tasks: Flow<PostgresAction>,
    onMain: suspend () -> Unit,
    onTasks: suspend () -> Unit,
) = coroutineScope {
    launch { tasks.collect { onTasks() } }
    collect { onMain() }
}
