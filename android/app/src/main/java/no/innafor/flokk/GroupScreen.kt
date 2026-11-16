package no.innafor.flokk

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Palette
import androidx.compose.material.icons.filled.PersonAdd
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.runtime.rememberCoroutineScope
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun GroupScreen(
    groupId: String,
    onBack: () -> Unit,
    onEvent: (String) -> Unit,
    onChat: (String) -> Unit,
    onCreateEvent: (String) -> Unit,
) {
    val me = supabase.auth.currentUserOrNull()?.id
    var group by remember { mutableStateOf<FlokkGroup?>(null) }
    var events by remember { mutableStateOf<List<EventSummary>>(emptyList()) }
    var members by remember { mutableStateOf<List<Member>>(emptyList()) }
    val online = rememberOnline(groupId, me)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var menuOpen by remember { mutableStateOf(false) }
    var inviting by remember { mutableStateOf(false) }
    var editingLook by remember { mutableStateOf(false) }
    var confirmLeave by remember { mutableStateOf(false) }
    var memberToRemove by remember { mutableStateOf<Member?>(null) }
    var notifyLevel by remember { mutableStateOf("all") }
    var error by remember { mutableStateOf<String?>(null) }
    val myRole = members.firstOrNull { it.userId == me }?.role
    val isAdmin = myRole == "owner" || myRole == "admin"

    fun canRemove(m: Member) = m.userId != me && (myRole == "owner" || (myRole == "admin" && m.role == "member"))

    fun setNotify(level: String) {
        val before = notifyLevel
        notifyLevel = level
        scope.launch {
            runCatching {
                supabase.postgrest.rpc("set_notify_level", buildJsonObject { put("gid", groupId); put("level", level) })
            }.onFailure { notifyLevel = before; error = "Kunne ikke endre varslingsnivået." }
        }
    }

    fun setLook(tint: String, backdrop: String?) {
        val before = group
        group = group?.copy(tint = tint, backdrop = backdrop)
        scope.launch {
            runCatching {
                supabase.from("groups").update({
                    set("tint", tint)
                    set("backdrop", backdrop)
                }) {
                    select(Columns.raw("id"))
                    filter { eq("id", groupId) }
                }.decodeList<IdRow>()
            }.onSuccess { if (it.isEmpty()) { group = before; error = "Bare admins kan endre utseendet." } else AppRouter.groupsVersion.value++ }
                .onFailure { group = before; error = "Kunne ikke lagre utseendet." }
        }
    }

    LaunchedEffect(groupId) {
        runCatching {
            group = supabase.from("groups").select(Columns.raw(GROUP_COLUMNS)) { filter { eq("id", groupId) } }
                .decodeSingle<FlokkGroup>()
        }
        runCatching {
            events = supabase.from("events")
                .select(Columns.raw("id, title, status, location, backdrop, chosen:event_time_options!events_chosen_option_fk(starts_at)")) {
                    filter {
                        eq("group_id", groupId)
                        neq("status", "cancelled")
                        exact("archived_at", null)
                    }
                    order("created_at", Order.DESCENDING)
                }.decodeList<EventSummary>()
        }
        runCatching { members = loadMembers(groupId) }
        me?.let { uid ->
            runCatching {
                notifyLevel = supabase.from("group_members").select(Columns.raw("notify_level")) {
                    filter { eq("group_id", groupId); eq("user_id", uid) }
                }.decodeSingle<LevelRow>().notifyLevel
            }
        }
    }

    group?.let { g ->
        if (inviting) InviteDialog(g) { inviting = false }
        if (editingLook) AppearanceSheet(g.tint ?: "mint", g.backdrop, ::setLook) { editingLook = false }
    }
    if (confirmLeave) ConfirmDialog(
        "Melde deg ut av ${group?.name}?",
        "Du mister tilgang til arrangementer og chat, og oppgavene dine blir ledige igjen.",
        "Meld meg ut",
        onConfirm = {
            scope.launch {
                runCatching { supabase.from("group_members").delete { filter { eq("group_id", groupId); eq("user_id", me!!) } } }
                    .onSuccess { AppRouter.groupsVersion.value++; onBack() }
                    .onFailure { error = "Kunne ikke melde deg ut." }
            }
        },
        onDismiss = { confirmLeave = false },
    )
    memberToRemove?.let { m ->
        ConfirmDialog(
            "Fjerne ${m.name}?",
            "Personen mister tilgang til arrangementer og chat, og oppgavene blir ledige igjen.",
            "Fjern fra flokken",
            onConfirm = {
                scope.launch {
                    val rows = runCatching {
                        supabase.from("group_members").delete {
                            select(Columns.raw("user_id"))
                            filter { eq("group_id", groupId); eq("user_id", m.userId) }
                        }.decodeList<UserIdRow>()
                    }.getOrNull()
                    if (rows.isNullOrEmpty()) error = "Du har ikke lov til å fjerne dette medlemmet."
                    members = runCatching { loadMembers(groupId) }.getOrDefault(members)
                }
            },
            onDismiss = { memberToRemove = null },
        )
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            BackBar(group?.name ?: "", onBack) {
                group?.let { g ->
                    Box {
                        IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, contentDescription = "Valg for flokken") }
                        DropdownMenu(menuOpen, { menuOpen = false }) {
                            DropdownMenuItem(
                                text = { Text("Del lenke til flokken") }, leadingIcon = { Icon(Icons.Default.Share, null) },
                                onClick = { menuOpen = false; shareText(context, siteUrl("/${g.slug}"), "Del lenke til flokken") },
                            )
                            if (isAdmin) {
                                DropdownMenuItem(
                                    text = { Text("Inviter folk") }, leadingIcon = { Icon(Icons.Default.PersonAdd, null) },
                                    onClick = { menuOpen = false; inviting = true },
                                )
                                DropdownMenuItem(
                                    text = { Text("Utseende") }, leadingIcon = { Icon(Icons.Default.Palette, null) },
                                    onClick = { menuOpen = false; editingLook = true },
                                )
                            }
                            HorizontalDivider()
                            Text("Varsler fra flokken", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
                            listOf("all" to "Alt", "important" to "Det viktigste", "none" to "Ingenting").forEach { (key, label) ->
                                DropdownMenuItem(
                                    text = { Text(label) },
                                    leadingIcon = { RadioButton(notifyLevel == key, onClick = null) },
                                    onClick = { menuOpen = false; setNotify(key) },
                                )
                            }
                            if (myRole != null && myRole != "owner") {
                                HorizontalDivider()
                                DropdownMenuItem(
                                    text = { Text("Meld meg ut av flokken", color = MaterialTheme.colorScheme.error) },
                                    leadingIcon = { Icon(Icons.AutoMirrored.Filled.Logout, null, tint = MaterialTheme.colorScheme.error) },
                                    onClick = { menuOpen = false; confirmLeave = true },
                                )
                            }
                        }
                    }
                }
            }
        },
    ) { padding ->
        val g = group ?: return@Scaffold
        val others = members.filter { it.userId != me && it.userId in online }
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item { GroupHeader(g) }
            if (others.isNotEmpty()) item { OnlineNowRow(others) }
            item {
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Arrangementer", fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                    Button(onClick = { onCreateEvent(g.id) }) {
                        Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Nytt")
                    }
                }
            }
            if (events.isEmpty()) {
                item {
                    Card(Modifier.fillMaxWidth()) {
                        Text("Ingen arrangementer ennå.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(20.dp))
                    }
                }
            }
            items(events, key = { it.id }) { e -> EventCard(e) { onEvent(e.id) } }
            item {
                Card(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).clickable { onChat(g.id) }) {
                    Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.AutoMirrored.Filled.Chat, null)
                        Spacer(Modifier.width(12.dp))
                        Text("Gruppechat", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                    }
                }
            }
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text("Medlemmer · ${members.size}", fontSize = 20.sp, fontWeight = FontWeight.Bold)
                        members.forEach { m ->
                            Row(
                                Modifier.fillMaxWidth().combinedClickable(
                                    onClick = {},
                                    onLongClick = { if (canRemove(m)) memberToRemove = m },
                                    onLongClickLabel = if (canRemove(m)) "Fjern fra flokken" else null,
                                ),
                                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
                            ) {
                                Avatar(m.name, m.profiles?.avatarUrl, online = m.userId in online)
                                Text(m.name + if (m.userId == me) " (deg)" else "", fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                                roleLabel(m.role)?.let {
                                    Text(
                                        it, fontSize = 12.sp, fontWeight = FontWeight.Medium,
                                        modifier = Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant)
                                            .padding(horizontal = 8.dp, vertical = 3.dp),
                                    )
                                }
                            }
                        }
                        if (isAdmin) {
                            OutlinedButton(onClick = { inviting = true }, modifier = Modifier.fillMaxWidth()) {
                                Icon(Icons.Default.PersonAdd, null, Modifier.size(18.dp))
                                Spacer(Modifier.width(6.dp))
                                Text("Inviter folk")
                            }
                            Text("Hold inne på et medlem for å fjerne det.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    }
                }
            }
        }
    }
}

@Serializable private data class LevelRow(@SerialName("notify_level") val notifyLevel: String)
@Serializable private data class UserIdRow(@SerialName("user_id") val userId: String)

suspend fun loadMembers(groupId: String): List<Member> =
    supabase.from("group_members").select(Columns.raw("user_id, role, profiles(id, display_name, avatar_url)")) {
        filter { eq("group_id", groupId) }
        order("joined_at", Order.ASCENDING)
    }.decodeList()

fun roleLabel(role: String) = when (role) {
    "owner" -> "Eier"
    "admin" -> "Admin"
    else -> null
}

@Composable
private fun GroupHeader(g: FlokkGroup) {
    val shape = RoundedCornerShape(24.dp)
    SurfaceBox(
        g.backdrop, g.tint,
        Modifier.fillMaxWidth().shadow(8.dp, shape, ambientColor = Color.Black.copy(0.08f), spotColor = Color.Black.copy(0.12f)).clip(shape),
    ) {
        Column(Modifier.padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(g.emoji ?: "🪺", fontSize = 46.sp)
            Text(g.name, fontSize = 32.sp, fontWeight = FontWeight.Bold, lineHeight = 36.sp)
            Row(
                Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.surface.copy(alpha = 0.7f))
                    .padding(horizontal = 10.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(if (g.visibility == "open") Icons.Default.Public else Icons.Default.Lock, null, Modifier.size(14.dp))
                Spacer(Modifier.width(4.dp))
                Text(if (g.visibility == "open") "Åpen" else "Kun inviterte", fontSize = 12.sp, fontWeight = FontWeight.Medium)
            }
            g.description?.takeIf { it.isNotBlank() }?.let { Text(it, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)) }
        }
    }
}

@Composable
private fun EventCard(e: EventSummary, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).clickable(onClick = onClick)) {
        Column {
            if (e.backdrop != null && e.backdrop in backdropDrawables) {
                SurfaceBox(e.backdrop, null, Modifier.fillMaxWidth().height(64.dp)) {}
            }
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    e.chosen?.let { Fmt.dateTime(it.startsAt) } ?: "Stemming pågår",
                    color = Green, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
                )
                Text(e.title, fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                e.location?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
    }
}

@Composable
private fun OnlineNowRow(people: List<Member>) {
    val label = when (people.size) {
        1 -> "${people[0].name} er også inne nå"
        2 -> "${people[0].name} og ${people[1].name} er også inne nå"
        else -> "${people[0].name} og ${people.size - 1} andre er også inne nå"
    }
    Row(
        Modifier.clip(CircleShape).background(Green.copy(alpha = 0.12f)).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Box(Modifier.size(9.dp).clip(CircleShape).background(Green))
        Row(horizontalArrangement = Arrangement.spacedBy((-8).dp)) {
            people.take(5).forEach { Avatar(it.name, it.profiles?.avatarUrl, size = 26.dp) }
        }
        Text(label, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}
