package no.innafor.flokk

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

val OSLO: ZoneId = ZoneId.of("Europe/Oslo")

val BACKDROP_GROUPS = listOf(
    "Årstider" to listOf("var" to "Vår", "sommer" to "Sommer", "host" to "Høst", "vinter" to "Vinter"),
    "Sport" to listOf("fotball" to "Fotball", "ski" to "Ski", "sykkel" to "Sykkel"),
    "Musikk" to listOf("noter" to "Noter", "piano" to "Piano", "lydbolger" to "Lydbølger"),
    "Mat og drikke" to listOf("kaffe" to "Kaffe", "sitrus" to "Sitrus", "urter" to "Urter"),
    "Aktiviteter" to listOf("friluftsliv" to "Friluftsliv", "boker" to "Bøker", "reise" to "Reise"),
)
val TINTS = listOf("mint" to "Mint", "lime" to "Lime", "sky" to "Himmel", "lilac" to "Syrin", "mauve" to "Lyng", "peach" to "Fersken")

/** Rutenett med bakgrunner. `inherit` gir en første flis «Som flokken» (verdi null). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BackdropPicker(selection: String?, onSelect: (String?) -> Unit, tint: String? = null, inherit: Pair<String?, String?>? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Tile(if (inherit != null) "Som flokken" else "Bare farge", selection == null, { onSelect(null) }) {
            SurfaceBox(inherit?.first, inherit?.second ?: tint, Modifier.fillMaxWidth().height(52.dp)) {}
        }
        BACKDROP_GROUPS.forEach { (label, items) ->
            Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items.forEach { (key, name) ->
                    Tile(name, selection == key, { onSelect(key) }) {
                        SurfaceBox(key, null, Modifier.fillMaxWidth().height(52.dp)) {}
                    }
                }
            }
        }
    }
}

@Composable
private fun Tile(label: String, selected: Boolean, onClick: () -> Unit, preview: @Composable () -> Unit) {
    Column(
        Modifier.width(96.dp).clickable(onClick = onClick).semantics { contentDescription = label; this.selected = selected },
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(
            Modifier.clip(RoundedCornerShape(12.dp))
                .border(if (selected) BorderStroke(2.5.dp, MaterialTheme.colorScheme.primary) else BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant), RoundedCornerShape(12.dp)),
        ) { preview() }
        Text(label, fontSize = 11.sp, color = if (selected) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun TintPicker(selection: String, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        TINTS.forEach { (key, label) ->
            Box(
                Modifier.size(38.dp).clip(CircleShape)
                    .border(if (selection == key) BorderStroke(2.5.dp, MaterialTheme.colorScheme.primary) else BorderStroke(0.dp, Color.Transparent), CircleShape)
                    .padding(4.dp).clip(CircleShape).background(tintColor(key))
                    .clickable { onSelect(key) }
                    .semantics { contentDescription = label; selected = selection == key },
            )
        }
    }
}

private val pickerFormat = DateTimeFormatter.ofPattern("EEE d. MMM yyyy 'kl.' HH:mm", Locale.forLanguageTag("nb-NO"))

fun defaultStart(): ZonedDateTime = ZonedDateTime.now(OSLO).plusDays(1).withHour(18).withMinute(0).withSecond(0).withNano(0)

/** Knapp som åpner dato- og deretter tidsvelger. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateTimeField(value: ZonedDateTime, onChange: (ZonedDateTime) -> Unit, modifier: Modifier = Modifier) {
    var step by remember { mutableStateOf(0) } // 0 = lukket, 1 = dato, 2 = tid
    var date by remember { mutableStateOf(value.toLocalDate()) }
    OutlinedButton(onClick = { step = 1 }, modifier = modifier) {
        Text(value.format(pickerFormat).replaceFirstChar(Char::uppercase))
    }
    if (step == 1) {
        val today = LocalDate.now(OSLO)
        val state = rememberDatePickerState(
            initialSelectedDateMillis = value.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli(),
            selectableDates = object : SelectableDates {
                override fun isSelectableDate(utcTimeMillis: Long) =
                    !Instant.ofEpochMilli(utcTimeMillis).atZone(ZoneOffset.UTC).toLocalDate().isBefore(today)
            },
        )
        DatePickerDialog(
            onDismissRequest = { step = 0 },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { date = Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate() }
                    step = 2
                }) { Text("Neste") }
            },
            dismissButton = { TextButton(onClick = { step = 0 }) { Text("Avbryt") } },
        ) { DatePicker(state) }
    }
    if (step == 2) {
        val state = rememberTimePickerState(value.hour, value.minute, is24Hour = true)
        AlertDialog(
            onDismissRequest = { step = 0 },
            title = { Text("Klokkeslett") },
            text = { TimePicker(state) },
            confirmButton = {
                TextButton(onClick = {
                    onChange(date.atTime(state.hour, state.minute).atZone(OSLO))
                    step = 0
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { step = 0 }) { Text("Avbryt") } },
        )
    }
}
