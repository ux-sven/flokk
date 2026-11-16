package no.innafor.flokk

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/** Endre tittel, beskrivelse og sted for et arrangement (arrangør eller admin). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditEventSheet(event: EventDetail, onSave: suspend (JsonObject) -> Boolean, onDismiss: () -> Unit) {
    var title by remember { mutableStateOf(event.title) }
    var description by remember { mutableStateOf(event.description) }
    var location by remember { mutableStateOf(event.location ?: "") }
    var place by remember {
        mutableStateOf(
            if (event.location != null && event.locationLat != null && event.locationLng != null)
                Place(event.location, "", true, event.locationLat, event.locationLng) else null,
        )
    }
    var suggestions by remember { mutableStateOf<List<Place>>(emptyList()) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(location, place) {
        if (place != null || location == event.location) { suggestions = emptyList(); return@LaunchedEffect }
        delay(250)
        suggestions = Places.search(location)
    }

    fun save() {
        busy = true
        error = null
        scope.launch {
            val loc = location.trim().take(200)
            val ok = onSave(buildJsonObject {
                put("title", title.trim().take(120))
                put("description", description.trim())
                if (loc.isEmpty()) put("location", JsonNull) else put("location", loc)
                val p = place.takeIf { loc.isNotEmpty() }
                if (p == null) { put("location_lat", JsonNull); put("location_lng", JsonNull) }
                else { put("location_lat", p.lat); put("location_lng", p.lng) }
            })
            busy = false
            if (ok) onDismiss() else error = "Kunne ikke lagre endringene."
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Rediger arrangement", fontWeight = FontWeight.Bold, fontSize = 20.sp)
            OutlinedTextField(title, { title = it }, label = { Text("Tittel") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(description, { description = it }, label = { Text("Beskrivelse") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                location, { location = it; if (it != place?.label) place = null },
                label = { Text("Sted") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                leadingIcon = { Icon(Icons.Default.Place, null) },
                supportingText = { if (place != null) Text("Lenker til kart", color = Green) },
            )
            suggestions.forEach { s ->
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable { place = s; location = s.label }
                        .padding(vertical = 8.dp, horizontal = 4.dp),
                ) {
                    Text(s.label)
                    Text(s.detail, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Text(
                "Tidspunkt endrer du på arrangementet: foreslå nye tider eller velg et annet forslag.",
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(onClick = ::save, enabled = !busy && title.trim().length >= 2, modifier = Modifier.fillMaxWidth()) {
                Text(if (busy) "Lagrer …" else "Lagre endringer")
            }
        }
    }
}

/**
 * Innstillinger for en flokk: navn, ikon, beskrivelse og synlighet (admin),
 * roller, overføring av eierskap og sletting (eier).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupSettingsSheet(
    group: FlokkGroup,
    members: List<Member>,
    me: String?,
    isOwner: Boolean,
    onSaved: (FlokkGroup) -> Unit,
    onMembersChanged: suspend () -> Unit,
    onDeleted: () -> Unit,
    onDismiss: () -> Unit,
) {
    var name by remember { mutableStateOf(group.name) }
    var emoji by remember { mutableStateOf(group.emoji ?: "") }
    var description by remember { mutableStateOf(group.description ?: "") }
    var visibility by remember { mutableStateOf(group.visibility) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var newOwner by remember { mutableStateOf<Member?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val others = members.filter { it.userId != me }

    fun save() {
        busy = true
        error = null
        scope.launch {
            runCatching {
                supabase.from("groups").update(buildJsonObject {
                    put("name", name.trim().take(80))
                    put("description", description.trim().take(500))
                    put("visibility", visibility)
                    val icon = emoji.trim().take(8)
                    if (icon.isEmpty()) put("emoji", JsonNull) else put("emoji", icon)
                }) {
                    select(Columns.raw(GROUP_COLUMNS))
                    filter { eq("id", group.id) }
                }.decodeList<FlokkGroup>()
            }.onSuccess { rows ->
                rows.firstOrNull()?.let { onSaved(it); onDismiss() } ?: run { error = "Bare admins kan endre flokken." }
            }.onFailure { error = "Kunne ikke lagre endringene." }
            busy = false
        }
    }

    fun setRole(m: Member, admin: Boolean) {
        busy = true
        scope.launch {
            val rows = runCatching {
                supabase.from("group_members").update(buildJsonObject { put("role", if (admin) "admin" else "member") }) {
                    select(Columns.raw("user_id"))
                    filter { eq("group_id", group.id); eq("user_id", m.userId) }
                }.decodeList<UserIdRow>()
            }.getOrNull()
            if (rows.isNullOrEmpty()) error = "Kunne ikke endre rollen."
            onMembersChanged()
            busy = false
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Innstillinger", fontWeight = FontWeight.Bold, fontSize = 20.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    emoji, { emoji = it.take(8) }, label = { Text("Ikon") }, singleLine = true,
                    textStyle = MaterialTheme.typography.titleLarge.copy(textAlign = TextAlign.Center),
                    modifier = Modifier.width(84.dp),
                )
                OutlinedTextField(name, { name = it }, label = { Text("Navn") }, singleLine = true, modifier = Modifier.weight(1f))
            }
            OutlinedTextField(description, { description = it }, label = { Text("Beskrivelse") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            Text("Hvem kan bli med?", fontWeight = FontWeight.SemiBold)
            listOf("invite_only" to "Kun inviterte", "open" to "Åpen for alle").forEach { (key, label) ->
                Row(Modifier.fillMaxWidth().clickable { visibility = key }, verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(visibility == key, onClick = { visibility = key })
                    Text(label)
                }
            }
            Text(
                "Adressen (/${group.slug}) endres ikke, så delte lenker fortsetter å virke.",
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = ::save, enabled = !busy && name.trim().length >= 2, modifier = Modifier.fillMaxWidth()) {
                Text(if (busy) "Lagrer …" else "Lagre endringer")
            }

            if (isOwner) {
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                Text("Admins", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                Text(
                    "Admins kan invitere, endre flokken og arrangementene, og fjerne vanlige medlemmer.",
                    fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (others.isEmpty()) Text("Ingen andre medlemmer ennå.", color = MaterialTheme.colorScheme.onSurfaceVariant)
                others.forEach { m ->
                    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Text(m.name, Modifier.weight(1f))
                        Switch(m.role == "admin", { setRole(m, it) }, enabled = !busy)
                    }
                }

                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                Text("Eier", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                Text(
                    "Eieren kan ikke melde seg ut. Overfør eierskapet først – du blir da admin.",
                    fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                others.forEach { m ->
                    OutlinedButton(onClick = { newOwner = m }, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Default.WorkspacePremium, null)
                        Text("  Gjør ${m.name} til eier")
                    }
                }
                TextButton(onClick = { confirmDelete = true }, enabled = !busy) {
                    Icon(Icons.Default.Delete, null, tint = MaterialTheme.colorScheme.error)
                    Text("  Slett flokken", color = MaterialTheme.colorScheme.error)
                }
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }

    newOwner?.let { m ->
        ConfirmDialog(
            "Gjøre ${m.name} til eier?",
            "Du blir admin, og bare den nye eieren kan gi eierskapet tilbake.",
            "Overfør eierskap",
            onConfirm = {
                scope.launch {
                    runCatching {
                        supabase.postgrest.rpc("transfer_group_ownership", buildJsonObject {
                            put("gid", group.id); put("new_owner", m.userId)
                        })
                    }.onSuccess { onMembersChanged(); onDismiss() }
                        .onFailure { error = "Kunne ikke overføre eierskapet." }
                }
            },
            onDismiss = { newOwner = null },
        )
    }

    if (confirmDelete) {
        var typed by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Slette ${group.name}?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Alle arrangementer, stemmer, oppgaver og chat slettes for godt. Skriv navnet på flokken for å bekrefte.")
                    OutlinedTextField(typed, { typed = it }, singleLine = true, placeholder = { Text(group.name) })
                }
            },
            confirmButton = {
                TextButton(
                    enabled = typed.trim() == group.name,
                    onClick = {
                        confirmDelete = false
                        scope.launch {
                            val rows = runCatching {
                                supabase.from("groups").delete {
                                    select(Columns.raw("id"))
                                    filter { eq("id", group.id) }
                                }.decodeList<IdRow>()
                            }.getOrNull()
                            if (rows.isNullOrEmpty()) error = "Bare eieren kan slette flokken." else { onDismiss(); onDeleted() }
                        }
                    },
                ) { Text("Slett for godt", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { OutlinedButton(onClick = { confirmDelete = false }) { Text("Avbryt") } },
        )
    }
}
