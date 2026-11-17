package no.innafor.flokk

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.RemoveCircle
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.exceptions.RestException
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import java.text.Normalizer

fun slugify(input: String): String {
    val s = Normalizer.normalize(
        input.lowercase().replace("æ", "ae").replace("ø", "o").replace("å", "a"), Normalizer.Form.NFD,
    ).replace(Regex("\\p{M}"), "")
    return s.replace(Regex("[^a-z0-9]+"), "-").trim('-').take(40)
}

@Serializable
private data class NewGroup(
    val name: String, val slug: String, val description: String, val visibility: String,
    val tint: String, val emoji: String?, val backdrop: String?,
)

@Composable
private fun Section(title: String, hint: String? = null, content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, fontWeight = FontWeight.SemiBold)
            content()
            hint?.let { Text(it, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}

@Composable
fun CreateGroupScreen(onClose: () -> Unit, onCreated: (FlokkGroup) -> Unit) {
    var name by remember { mutableStateOf("") }
    var slug by remember { mutableStateOf("") }
    var slugEdited by remember { mutableStateOf(false) }
    var description by remember { mutableStateOf("") }
    var emoji by remember { mutableStateOf("") }
    var open by remember { mutableStateOf(false) }
    var tint by remember { mutableStateOf("mint") }
    var backdrop by remember { mutableStateOf<String?>("sommer") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    fun create() {
        val clean = name.trim()
        val s = slugify(slug.ifBlank { clean })
        if (clean.length < 2) { error = "Gi flokken et navn på minst to tegn."; return }
        if (s.length < 3) { error = "Adressen må ha minst tre tegn (a–z, 0–9 og bindestrek)."; return }
        busy = true
        error = null
        scope.launch {
            try {
                val g = supabase.from("groups").insert(
                    NewGroup(clean, s, description.trim(), if (open) "open" else "invite_only", tint, emoji.ifBlank { null }, backdrop),
                ) { select(Columns.raw(GROUP_COLUMNS)) }.decodeSingle<FlokkGroup>()
                AppRouter.groupsVersion.value++
                onCreated(g)
            } catch (e: RestException) {
                error = when {
                    e.message?.contains("23505") == true || e.message?.contains("duplicate") == true -> "Adressen «$s» er allerede i bruk."
                    e.message?.contains("23514") == true || e.message?.contains("check") == true -> "Adressen «$s» kan ikke brukes. Velg en annen."
                    else -> planLimitMessage(e) ?: "Noe gikk galt. Prøv igjen."
                }
            } catch (e: Exception) {
                error = "Noe gikk galt. Prøv igjen."
            }
            busy = false
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            BackBar("Ny flokk", onClose) {
                TextButton(onClick = ::create, enabled = !busy && name.trim().length >= 2) { Text(if (busy) "Lager …" else "Lag") }
            }
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Section("Navn") {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(emoji, { emoji = it.take(4) }, placeholder = { Text("🪺") }, singleLine = true, modifier = Modifier.width(72.dp), label = { Text("Ikon") })
                    OutlinedTextField(name, {
                        name = it
                        if (!slugEdited) slug = slugify(it)
                    }, label = { Text("Navn på flokken") }, singleLine = true, modifier = Modifier.weight(1f))
                }
                OutlinedTextField(description, { description = it }, label = { Text("Beskrivelse (valgfritt)") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            }
            Section("Adresse", "Lenken du deler med andre. Bokstaver a–z, tall og bindestrek.") {
                OutlinedTextField(
                    slug, { slug = it; slugEdited = it.isNotBlank() && it != slugify(name) },
                    prefix = { Text(siteUrl("/").removePrefix("https://").removePrefix("http://")) },
                    singleLine = true, modifier = Modifier.fillMaxWidth(),
                )
            }
            Section("Hvem kan bli med?") {
                listOf(false to "Kun inviterte", true to "Alle med lenken").forEach { (value, label) ->
                    Row(
                        Modifier.fillMaxWidth().selectable(open == value, role = Role.RadioButton) { open = value },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(open == value, onClick = null)
                        Text(label, Modifier.padding(start = 8.dp))
                    }
                }
            }
            Section("Utseende") {
                SurfaceBox(backdrop, tint, Modifier.fillMaxWidth().height(90.dp).clip(RoundedCornerShape(16.dp))) {
                    Text("${emoji.ifBlank { "🪺" }} ${name.ifBlank { "Flokken" }}", fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(16.dp))
                }
                TintPicker(tint) { tint = it }
                BackdropPicker(backdrop, { backdrop = it }, tint = tint)
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }
}

@Serializable
private data class NewEvent(
    @SerialName("group_id") val groupId: String,
    val title: String,
    val description: String,
    val location: String?,
    @SerialName("location_lat") val locationLat: Double?,
    @SerialName("location_lng") val locationLng: Double?,
    @SerialName("allow_time_suggestions") val allowTimeSuggestions: Boolean,
    val backdrop: String?,
)

@Serializable
private data class NewOption(@SerialName("event_id") val eventId: String, @SerialName("starts_at") val startsAt: String)

@Composable
fun CreateEventScreen(groupId: String, onClose: () -> Unit, onCreated: (String) -> Unit) {
    var group by remember { mutableStateOf<FlokkGroup?>(null) }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var place by remember { mutableStateOf<Place?>(null) }
    var suggestions by remember { mutableStateOf<List<Place>>(emptyList()) }
    val options = remember { mutableStateListOf(defaultStart()) }
    var allowSuggestions by remember { mutableStateOf(true) }
    var backdrop by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(groupId) {
        group = runCatching {
            supabase.from("groups").select(Columns.raw(GROUP_COLUMNS)) { filter { eq("id", groupId) } }.decodeSingle<FlokkGroup>()
        }.getOrNull()
    }
    // Adressesøk med litt forsinkelse mens man skriver
    LaunchedEffect(location, place) {
        if (place != null) { suggestions = emptyList(); return@LaunchedEffect }
        delay(250)
        suggestions = Places.search(location)
    }

    fun create() {
        val t = title.trim()
        if (t.length < 2) { error = "Gi arrangementet en tittel."; return }
        val starts = options.map { it.withSecond(0).withNano(0).toInstant().toString() }.distinct().sorted()
        busy = true
        error = null
        scope.launch {
            try {
                val loc = location.trim().take(200).ifBlank { null }
                val created = supabase.from("events").insert(
                    NewEvent(groupId, t, description.trim(), loc, loc?.let { place?.lat }, loc?.let { place?.lng }, allowSuggestions, backdrop),
                ) { select(Columns.raw("id")) }.decodeSingle<IdRow>()
                runCatching { supabase.from("event_time_options").insert(starts.map { NewOption(created.id, it) }) }
                    .onFailure { error = "Arrangementet ble opprettet, men tidsforslagene feilet." }
                onCreated(created.id)
            } catch (e: Exception) {
                error = planLimitMessage(e) ?: "Kunne ikke opprette arrangementet."
            }
            busy = false
        }
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            BackBar("Nytt arrangement", onClose) {
                TextButton(onClick = ::create, enabled = !busy && title.trim().length >= 2) { Text(if (busy) "Lager …" else "Lag") }
            }
        },
    ) { padding ->
        Column(
            Modifier.fillMaxSize().padding(padding).imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Section("Hva skal skje?") {
                OutlinedTextField(title, { title = it }, label = { Text("Tittel") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(description, { description = it }, label = { Text("Beskrivelse (valgfritt)") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            }
            Section("Sted", "Velg et forslag for å lenke til kart, eller skriv hva du vil.") {
                OutlinedTextField(
                    location, { location = it; if (it != place?.label) place = null },
                    label = { Text("Adresse, sted eller fritekst") }, singleLine = true, modifier = Modifier.fillMaxWidth(),
                    leadingIcon = { Icon(Icons.Default.Place, null) },
                    supportingText = { if (place != null) Text("Lenker til kart", color = Green) },
                )
                suggestions.forEach { s ->
                    Column(
                        Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).clickable {
                            place = s
                            location = s.label
                        }.padding(vertical = 8.dp, horizontal = 4.dp),
                    ) {
                        Text(s.label)
                        Text(s.detail, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Section("Forslag til tidspunkt", "Flokken stemmer på forslagene. Du velger det endelige tidspunktet.") {
                options.forEachIndexed { i, value ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        DateTimeField(value, { options[i] = it }, Modifier.weight(1f))
                        if (options.size > 1) {
                            IconButton(onClick = { options.removeAt(i) }) { Icon(Icons.Default.RemoveCircle, "Fjern forslag ${i + 1}", tint = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
                TextButton(onClick = { options.add((options.lastOrNull() ?: defaultStart()).plusDays(1)) }) {
                    Icon(Icons.Default.Add, null)
                    Text("Legg til tidspunkt")
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Andre kan foreslå tidspunkt", Modifier.weight(1f))
                    Switch(allowSuggestions, { allowSuggestions = it })
                }
            }
            Section("Bakgrunn") {
                BackdropPicker(backdrop, { backdrop = it }, inherit = group?.backdrop to group?.tint)
            }
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(onClick = ::create, enabled = !busy && title.trim().length >= 2, modifier = Modifier.fillMaxWidth().height(52.dp)) {
                Text(if (busy) "Lager …" else "Lag arrangement")
            }
        }
    }
}
