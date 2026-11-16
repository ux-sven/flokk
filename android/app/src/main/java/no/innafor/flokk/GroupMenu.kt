package no.innafor.flokk

import android.content.ClipData
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ClipEntry
import androidx.compose.ui.platform.LocalClipboard
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

fun shareText(context: Context, text: String, title: String) {
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    context.startActivity(Intent.createChooser(send, title))
}

@Serializable private data class TokenRow(val token: String)
@Serializable private data class NewInvite(@SerialName("group_id") val groupId: String)

/** Lager en invitasjonslenke (gyldig i 14 dager) som kan deles eller kopieres. */
@Composable
fun InviteDialog(group: FlokkGroup, onDismiss: () -> Unit) {
    var url by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var copied by remember { mutableStateOf(false) }
    val context = LocalContext.current
    val clipboard = LocalClipboard.current
    val scope = rememberCoroutineScope()
    LaunchedEffect(group.id) {
        runCatching {
            supabase.from("group_invitations").insert(NewInvite(group.id)) { select(Columns.raw("token")) }.decodeSingle<TokenRow>()
        }.onSuccess { url = siteUrl("/invitasjon/${it.token}") }.onFailure { error = "Kunne ikke lage invitasjon." }
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Inviter til ${group.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(url ?: error ?: "Lager lenke …", fontFamily = if (url != null) FontFamily.Monospace else null, fontSize = 13.sp)
                if (url != null) Text("Lenken er gyldig i 14 dager.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (copied) Text("Lenken er kopiert.", color = Green, fontSize = 13.sp)
            }
        },
        confirmButton = {
            url?.let { u ->
                Button(onClick = { shareText(context, "Bli med i ${group.name} på Flokk: $u", "Del invitasjon") }) { Text("Del") }
            }
        },
        dismissButton = {
            Row {
                url?.let { u ->
                    TextButton(onClick = {
                        scope.launch { clipboard.setClipEntry(ClipEntry(ClipData.newPlainText("Invitasjon", u))) }
                        copied = true
                    }) { Text("Kopier") }
                }
                TextButton(onClick = onDismiss) { Text("Lukk") }
            }
        },
    )
}

/** Admin: bytt farge og bakgrunn på flokken. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppearanceSheet(tint: String, backdrop: String?, onChange: (String, String?) -> Unit, onDismiss: () -> Unit) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).padding(bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text("Utseende", fontWeight = FontWeight.Bold, fontSize = 20.sp)
            TintPicker(tint) { onChange(it, backdrop) }
            BackdropPicker(backdrop, { onChange(tint, it) }, tint = tint)
        }
    }
}

@Composable
fun ConfirmDialog(title: String, text: String, confirm: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = { Text(text) },
        confirmButton = {
            TextButton(onClick = { onConfirm(); onDismiss() }) { Text(confirm, color = MaterialTheme.colorScheme.error) }
        },
        dismissButton = { OutlinedButton(onClick = onDismiss) { Text("Avbryt") } },
    )
}
