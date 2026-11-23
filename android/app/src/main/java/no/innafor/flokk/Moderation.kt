package no.innafor.flokk

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Rapportering og blokkering (migrasjon 16, 20261123120000_reports_and_blocks.sql).
// Blokkering skjuler meldinger på serveren (RLS) og stopper varsler fra brukeren.

private val REPORT_REASONS = listOf(
    "inappropriate" to "Upassende eller støtende innhold",
    "harassment" to "Trakassering eller mobbing",
    "spam" to "Spam eller svindel",
    "other" to "Noe annet",
)

@Serializable
private data class NewBlock(@SerialName("blocked_id") val blockedId: String)

object Moderation {
    suspend fun block(userId: String) {
        runCatching { supabase.from("user_blocks").insert(NewBlock(userId)) }
            .onFailure { if (it.message?.contains("23505") != true && it.message?.contains("duplicate") != true) throw it }
    }

    suspend fun unblock(userId: String) {
        supabase.from("user_blocks").delete { filter { eq("blocked_id", userId) } }
    }

    suspend fun report(kind: String, target: String, groupId: String, reason: String, details: String) {
        supabase.postgrest.rpc(
            "report_content",
            buildJsonObject {
                put("report_kind", kind)
                put("target", target)
                put("gid", groupId)
                put("report_reason", reason)
                put("report_details", details.trim().ifBlank { null })
            },
        )
    }
}

/**
 * Meny for å rapportere en melding eller bruker, eller blokkere brukeren.
 * [messageId] er satt når menyen hører til en melding.
 */
@Composable
fun SafetyMenu(
    expanded: Boolean,
    onDismiss: () -> Unit,
    groupId: String,
    userId: String,
    name: String,
    messageId: String? = null,
    onBlocked: (String) -> Unit = {},
) {
    val scope = rememberCoroutineScope()
    var reporting by remember { mutableStateOf(false) }
    var confirmBlock by remember { mutableStateOf(false) }
    var notice by remember { mutableStateOf<String?>(null) }

    DropdownMenu(expanded = expanded, onDismissRequest = onDismiss) {
        DropdownMenuItem(
            text = { Text(if (messageId != null) "Rapporter meldingen" else "Rapporter $name") },
            leadingIcon = { Icon(Icons.Outlined.Flag, null) },
            onClick = { onDismiss(); reporting = true },
        )
        DropdownMenuItem(
            text = { Text("Blokker $name", color = MaterialTheme.colorScheme.error) },
            leadingIcon = { Icon(Icons.Outlined.Block, null, tint = MaterialTheme.colorScheme.error) },
            onClick = { onDismiss(); confirmBlock = true },
        )
    }

    if (confirmBlock) {
        AlertDialog(
            onDismissRequest = { confirmBlock = false },
            title = { Text("Blokkere $name?") },
            text = { Text("Du ser ikke lenger meldingene til $name og får ikke varsler om det $name gjør. $name får ikke vite det. Du kan oppheve det under Profil.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmBlock = false
                    scope.launch {
                        runCatching { Moderation.block(userId) }
                            .onSuccess { onBlocked(userId); notice = "$name er blokkert." }
                            .onFailure { notice = "Kunne ikke blokkere. Prøv igjen." }
                    }
                }) { Text("Blokker", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { confirmBlock = false }) { Text("Avbryt") } },
        )
    }

    if (reporting) {
        ReportDialog(
            title = if (messageId != null) "Rapporter meldingen" else "Rapporter $name",
            name = name,
            onDismiss = { reporting = false },
        ) { reason, details ->
            scope.launch {
                runCatching { Moderation.report(if (messageId != null) "message" else "user", messageId ?: userId, groupId, reason, details) }
                    .onSuccess { reporting = false; notice = "Takk! Rapporten er sendt, og vi ser på den innen et døgn." }
                    .onFailure { notice = "Kunne ikke sende rapporten. Prøv igjen." }
            }
        }
    }

    notice?.let {
        AlertDialog(
            onDismissRequest = { notice = null },
            text = { Text(it) },
            confirmButton = { TextButton(onClick = { notice = null }) { Text("OK") } },
        )
    }
}

@Composable
private fun ReportDialog(title: String, name: String, onDismiss: () -> Unit, onSend: (String, String) -> Unit) {
    var reason by remember { mutableStateOf("inappropriate") }
    var details by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Hva er galt?", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                REPORT_REASONS.forEach { (value, label) ->
                    Row(
                        Modifier.fillMaxWidth().clickable { reason = value },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = reason == value, onClick = { reason = value })
                        Text(label, fontSize = 14.sp)
                    }
                }
                OutlinedTextField(
                    details, { details = it.take(1000) },
                    label = { Text("Fortell gjerne mer (valgfritt)") },
                    minLines = 2, modifier = Modifier.fillMaxWidth(),
                )
                Text("Rapporten går til Flokk, ikke til $name.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        },
        confirmButton = { TextButton(onClick = { onSend(reason, details) }) { Text("Send rapport") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Avbryt") } },
    )
}

@Serializable
private data class BlockRow(
    @SerialName("blocked_id") val blockedId: String,
    val profiles: Profile? = null,
) {
    val name: String get() = profiles?.displayName?.takeIf { it.isNotBlank() } ?: "Bruker"
}

/** Brukere du har blokkert (på profilen), med mulighet til å oppheve. */
@Composable
fun BlockedUsersCard() {
    val scope = rememberCoroutineScope()
    var rows by remember { mutableStateOf<List<BlockRow>>(emptyList()) }
    LaunchedEffect(Unit) {
        rows = runCatching {
            supabase.from("user_blocks")
                .select(Columns.raw("blocked_id, profiles!user_blocks_blocked_id_fkey(id, display_name, avatar_url)"))
                .decodeList<BlockRow>()
        }.getOrDefault(emptyList())
    }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Blokkerte brukere", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
            if (rows.isEmpty()) {
                Text(
                    "Du har ikke blokkert noen. Hold fingeren på en melding, eller trykk ⋮ i medlemslisten for å rapportere eller blokkere.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp,
                )
            }
            rows.forEach { r ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(r.name, modifier = Modifier.weight(1f))
                    OutlinedButton(onClick = {
                        scope.launch { runCatching { Moderation.unblock(r.blockedId) }.onSuccess { rows = rows - r } }
                    }) { Text("Opphev") }
                }
            }
        }
    }
}
