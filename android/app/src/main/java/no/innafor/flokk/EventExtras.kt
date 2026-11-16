package no.innafor.flokk

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.ZonedDateTime

/** Foreslå et nytt tidspunkt; onSubmit returnerer en feilmelding eller null. */
@Composable
fun SuggestTimeDialog(onDismiss: () -> Unit, onSubmit: suspend (ZonedDateTime) -> String?) {
    var date by remember { mutableStateOf(defaultStart()) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Foreslå tidspunkt") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DateTimeField(date, { date = it }, Modifier.fillMaxWidth())
                Text("Du stemmer automatisk «Passer» på forslaget ditt.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            }
        },
        confirmButton = {
            TextButton(enabled = !busy, onClick = {
                busy = true
                scope.launch {
                    error = onSubmit(date)
                    busy = false
                    if (error == null) onDismiss()
                }
            }) { Text(if (busy) "Legger til …" else "Foreslå") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Avbryt") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BackdropSheet(selection: String?, inherit: Pair<String?, String?>, onSelect: (String?) -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Bakgrunn", fontWeight = FontWeight.Bold, fontSize = 20.sp)
            BackdropPicker(selection, onSelect, inherit = inherit)
        }
    }
}

/** Oppgaver for et arrangement: hvem tar med hva. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TaskList(eventId: String, tasks: List<EventTask>, members: List<Member>, me: String?, onChange: () -> Unit) {
    var newTitle by remember { mutableStateOf("") }
    var newAssignee by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var toDelete by remember { mutableStateOf<EventTask?>(null) }
    val scope = rememberCoroutineScope()

    fun name(id: String?) = when (id) {
        null -> null
        me -> "Deg"
        else -> members.firstOrNull { it.userId == id }?.name
    }

    fun update(t: EventTask, patch: kotlinx.serialization.json.JsonObject) {
        scope.launch {
            runCatching { supabase.from("event_tasks").update(patch) { filter { eq("id", t.id) } } }
            onChange()
        }
    }

    fun add() {
        val title = newTitle.trim().take(200)
        if (title.isEmpty()) return
        scope.launch {
            runCatching {
                supabase.from("event_tasks").insert(buildJsonObject {
                    put("event_id", eventId)
                    put("title", title)
                    if (newAssignee == null) put("assignee_id", JsonNull) else put("assignee_id", newAssignee)
                })
            }.onSuccess { newTitle = ""; newAssignee = null; error = null; onChange() }
                .onFailure { error = "Kunne ikke legge til oppgaven." }
        }
    }

    toDelete?.let { t ->
        ConfirmDialog("Slette «${t.title}»?", "Oppgaven fjernes for alle.", "Slett", onConfirm = {
            scope.launch { runCatching { supabase.from("event_tasks").delete { filter { eq("id", t.id) } } }; onChange() }
        }, onDismiss = { toDelete = null })
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("Oppgaver", fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
            if (tasks.isNotEmpty()) Text("${tasks.count { it.isDone }} av ${tasks.size} ferdig", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Card(Modifier.fillMaxWidth()) {
            Column {
                tasks.forEach { t ->
                    Row(
                        Modifier.fillMaxWidth().combinedClickable(onClick = {}, onLongClick = { toDelete = t }, onLongClickLabel = "Slett oppgaven")
                            .padding(horizontal = 6.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconButton(onClick = { update(t, buildJsonObject { put("status", if (t.isDone) "todo" else "done") }) }) {
                            Icon(
                                if (t.isDone) Icons.Default.CheckCircle else Icons.Default.RadioButtonUnchecked,
                                contentDescription = if (t.isDone) "Merk som ikke ferdig" else "Merk som ferdig",
                                tint = if (t.isDone) Green else MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Text(
                            t.title, Modifier.weight(1f),
                            textDecoration = if (t.isDone) TextDecoration.LineThrough else null,
                            color = if (t.isDone) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                        )
                        AssigneeChip(name(t.assigneeId), members, me) { id ->
                            update(t, buildJsonObject { if (id == null) put("assignee_id", JsonNull) else put("assignee_id", id) })
                        }
                    }
                    HorizontalDivider(Modifier.padding(start = 54.dp))
                }
                Row(Modifier.fillMaxWidth().padding(horizontal = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = ::add, enabled = newTitle.isNotBlank()) { Icon(Icons.Default.AddCircle, contentDescription = "Legg til oppgave") }
                    TextField(
                        newTitle, { newTitle = it }, placeholder = { Text("Ny oppgave, f.eks. «Ta med kake»") },
                        singleLine = true, modifier = Modifier.weight(1f),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        keyboardActions = KeyboardActions(onDone = { add() }),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent,
                            focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                        ),
                    )
                    AssigneeChip(name(newAssignee), members, me) { newAssignee = it }
                }
            }
        }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        if (tasks.isNotEmpty()) Text("Hold inne på en oppgave for å slette den.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun AssigneeChip(label: String?, members: List<Member>, me: String?, onPick: (String?) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        Text(
            label ?: "Ledig", fontSize = 12.sp, fontWeight = FontWeight.Medium,
            modifier = Modifier.clip(CircleShape)
                .background(if (label == null) MaterialTheme.colorScheme.surfaceVariant else tintColor("mint"))
                .clickable(onClickLabel = "Velg ansvarlig") { open = true }
                .padding(horizontal = 10.dp, vertical = 6.dp),
        )
        DropdownMenu(open, { open = false }) {
            DropdownMenuItem(text = { Text("Ingen") }, onClick = { open = false; onPick(null) })
            me?.let { DropdownMenuItem(text = { Text("Meg") }, onClick = { open = false; onPick(it) }) }
            HorizontalDivider()
            members.filter { it.userId != me }.forEach { m ->
                DropdownMenuItem(text = { Text(m.name) }, onClick = { open = false; onPick(m.userId) })
            }
        }
    }
}
