package no.innafor.flokk

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.TextButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
private data class NameRow(@SerialName("display_name") val displayName: String)

@Composable
fun ProfileScreen() {
    val user = supabase.auth.currentUserOrNull()
    var name by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val pushRegistered by PushManager.registered.collectAsState()
    val pushError by PushManager.lastError.collectAsState()
    var testResult by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(user?.id) {
        val uid = user?.id ?: return@LaunchedEffect
        runCatching {
            name = supabase.from("profiles").select(Columns.raw("display_name")) { filter { eq("id", uid) } }
                .decodeSingle<NameRow>().displayName
        }
    }

    Column(
        Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Min profil", fontSize = 34.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 24.dp))
        Card(Modifier.fillMaxWidth()) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Avatar(name.ifBlank { "?" }, size = 56.dp)
                Column {
                    Text(name.ifBlank { "Uten navn" }, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                    Text(user?.email ?: "", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(name, { name = it; status = null }, label = { Text("Visningsnavn") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Text("Dette er navnet de andre i flokkene dine ser.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Button(
                    enabled = !busy && name.isNotBlank(),
                    onClick = {
                        val clean = name.trim().split(Regex("\\s+")).joinToString(" ")
                        if (clean.length > 50) { status = "Navnet kan være maks 50 tegn."; return@Button }
                        busy = true
                        scope.launch {
                            status = runCatching {
                                supabase.from("profiles").update({ set("display_name", clean) }) { filter { eq("id", user!!.id) } }
                            }.fold({ name = clean; "Lagret ✓" }, { "Kunne ikke lagre navnet." })
                            busy = false
                        }
                    },
                ) { Text(if (busy) "Lagrer …" else "Lagre navn") }
                status?.let { Text(it, fontSize = 13.sp) }
            }
        }
        Card(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Varsler", fontWeight = FontWeight.SemiBold, fontSize = 17.sp)
                Text(
                    if (pushRegistered) "Varsler er på for denne telefonen." else pushError ?: "Varsler er ikke slått på ennå.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (pushRegistered) {
                    OutlinedButton(onClick = { scope.launch { testResult = "Sender …"; testResult = PushManager.sendTest() } }) {
                        Text("Send testvarsel")
                    }
                    testResult?.let { Text(it, fontSize = 13.sp) }
                }
            }
        }
        if (!pushRegistered) PushPrompt()
        OutlinedButton(
            onClick = {
                scope.launch {
                    PushManager.unregister()
                    NotificationCenter.clear()
                    runCatching { supabase.auth.signOut() }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Logg ut", color = MaterialTheme.colorScheme.error) }
        DeleteAccountSection()
    }
}

@Composable
private fun DeleteAccountSection() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var confirming by remember { mutableStateOf(false) }
    var typed by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = {
                context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(siteUrl("/personvern"))))
            }) { Text("Personvernerklæring") }
            TextButton(onClick = { confirming = true }) {
                Text("Slett kontoen", color = MaterialTheme.colorScheme.error)
            }
            Text(
                error ?: "Profilen, medlemskapene, stemmene og meldingene dine slettes for godt. Er du eier av en flokk med andre medlemmer, må du overføre eierskapet først.",
                fontSize = 13.sp,
                color = if (error != null) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }

    if (confirming) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { confirming = false; typed = "" },
            title = { Text("Slette kontoen?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Dette kan ikke angres. Skriv SLETT for å bekrefte.")
                    OutlinedTextField(typed, { typed = it }, singleLine = true, placeholder = { Text("SLETT") })
                }
            },
            confirmButton = {
                TextButton(
                    enabled = !busy && typed.trim().uppercase() == "SLETT",
                    onClick = {
                        busy = true
                        scope.launch {
                            runCatching { supabase.postgrest.rpc("delete_account") }
                                .onSuccess {
                                    NotificationCenter.clear()
                                    runCatching { supabase.auth.signOut(io.github.jan.supabase.auth.SignOutScope.LOCAL) }
                                }
                                .onFailure { e ->
                                    val msg = (e as? io.github.jan.supabase.postgrest.exception.PostgrestRestException)?.error
                                    error = if (msg?.startsWith("Overfør eierskapet") == true) "$msg." else "Kunne ikke slette kontoen. Prøv igjen."
                                }
                            busy = false
                            confirming = false
                            typed = ""
                        }
                    },
                ) { Text("Slett for godt", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { OutlinedButton(onClick = { confirming = false; typed = "" }) { Text("Avbryt") } },
        )
    }
}
