package no.innafor.flokk

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

@Serializable
private data class InvitationInfo(
    @SerialName("group_id") val groupId: String,
    @SerialName("group_name") val groupName: String,
    @SerialName("group_description") val groupDescription: String? = null,
    val valid: Boolean,
)

/** Godta en invitasjon fra en flokk://invitasjon/<token>-lenke. */
@Composable
fun InvitationDialog(token: String, onDismiss: () -> Unit) {
    var info by remember { mutableStateOf<InvitationInfo?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val params = buildJsonObject { put("invite_token", token) }

    LaunchedEffect(token) {
        info = runCatching { supabase.postgrest.rpc("get_invitation", params).decodeList<InvitationInfo>().firstOrNull() }.getOrNull()
        loaded = true
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(info?.let { "Bli med i ${it.groupName}?" } ?: if (loaded) "Fant ikke invitasjonen" else "Henter invitasjon …") },
        text = {
            Text(
                error ?: info?.let { i ->
                    if (!i.valid) "Invitasjonen er utløpt. Be om en ny lenke." else i.groupDescription?.ifBlank { null } ?: "Du er invitert til flokken."
                } ?: if (loaded) "Lenken kan være feil eller slettet." else "",
            )
        },
        confirmButton = {
            val i = info
            if (i != null && i.valid) {
                Button(enabled = !busy, onClick = {
                    busy = true
                    scope.launch {
                        runCatching { supabase.postgrest.rpc("accept_invitation", params) }
                            .onSuccess {
                                AppRouter.groupsVersion.value++
                                onDismiss()
                                AppRouter.open(PushTarget(i.groupId, null, false))
                            }
                            .onFailure {
                                error = planLimitMessage(it)
                                    ?: "Kunne ikke bli med. Invitasjonen kan være utløpt eller gjelde en annen e-postadresse."
                            }
                        busy = false
                    }
                }) { Text(if (busy) "Blir med …" else "Bli med") }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Lukk") } },
    )
}
