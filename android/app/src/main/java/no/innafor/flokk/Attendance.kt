package no.innafor.flokk

import android.content.Context
import android.content.Intent
import android.provider.CalendarContract
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Event
import androidx.compose.material.icons.filled.QuestionMark
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val VoteAnswer.attendanceLabel: String
    get() = when (this) {
        VoteAnswer.YES -> "Kommer"
        VoteAnswer.MAYBE -> "Kanskje"
        VoteAnswer.NO -> "Kommer ikke"
    }

/** Åpner kalenderappen med arrangementet ferdig utfylt. Krever ingen tillatelse. */
fun addToCalendar(context: Context, event: EventDetail, startsAt: String, url: String) {
    val start = Fmt.parse(startsAt)?.toInstant()?.toEpochMilli() ?: return
    val notes = listOfNotNull(event.description.takeIf { it.isNotBlank() }, url).joinToString("\n\n")
    val intent = Intent(Intent.ACTION_INSERT)
        .setData(CalendarContract.Events.CONTENT_URI)
        .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
        .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, start + 2 * 60 * 60 * 1000)
        .putExtra(CalendarContract.Events.TITLE, event.title)
        .putExtra(CalendarContract.Events.DESCRIPTION, notes)
        .putExtra(CalendarContract.Events.EVENT_LOCATION, event.location ?: "")
    runCatching { context.startActivity(intent) }
}

/**
 * «Kommer du?» når tidspunktet er valgt. Svaret lagres som stemmen på det
 * valgte tidspunktet, så de som svarte «Passer» står allerede som påmeldt.
 */
@Composable
fun AttendanceCard(
    option: TimeOption,
    members: List<Member>,
    me: String?,
    onAnswer: (VoteAnswer) -> Unit,
    onAddToCalendar: () -> Unit,
) {
    val mine = option.eventVotes.firstOrNull { it.userId == me }?.answer?.let(VoteAnswer::of)
    fun people(a: VoteAnswer?) = members.filter { m ->
        option.eventVotes.firstOrNull { it.userId == m.userId }?.answer?.let(VoteAnswer::of) == a
    }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f)) {
                    Text("Kommer du?", fontSize = 22.sp, fontWeight = FontWeight.Bold)
                    Text(Fmt.dateTime(option.startsAt), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                OutlinedButton(onClick = onAddToCalendar) {
                    Icon(Icons.Default.Event, null, Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Kalender")
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                VoteAnswer.entries.forEach { a ->
                    val on = mine == a
                    val bg = when {
                        !on -> MaterialTheme.colorScheme.surfaceVariant
                        a == VoteAnswer.YES -> Color(0xFF059669)
                        a == VoteAnswer.MAYBE -> Amber
                        else -> Color(0xFF3F3F46)
                    }
                    val fg = when {
                        !on -> MaterialTheme.colorScheme.onSurfaceVariant
                        a == VoteAnswer.MAYBE -> Color(0xFF451A03)
                        else -> Color.White
                    }
                    Row(
                        Modifier.weight(1f).height(46.dp).clip(RoundedCornerShape(14.dp)).background(bg)
                            .selectable(selected = on, role = Role.RadioButton) { onAnswer(a) }
                            .padding(horizontal = 6.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            when (a) { VoteAnswer.YES -> Icons.Default.Check; VoteAnswer.MAYBE -> Icons.Default.QuestionMark; VoteAnswer.NO -> Icons.Default.Close },
                            null, Modifier.size(16.dp), tint = fg,
                        )
                        Spacer(Modifier.width(4.dp))
                        Text(a.attendanceLabel, color = fg, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            (VoteAnswer.entries.map { it as VoteAnswer? } + null).forEach { a ->
                val list = people(a)
                if (list.isNotEmpty()) {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(
                            "${a?.attendanceLabel ?: "Ikke svart"} · ${list.size}",
                            fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            list.forEach { m ->
                                Row(
                                    Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant)
                                        .padding(start = 3.dp, end = 10.dp, top = 3.dp, bottom = 3.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Avatar(m.name, m.profiles?.avatarUrl, size = 22.dp)
                                    Spacer(Modifier.width(6.dp))
                                    Text(if (m.userId == me) "Du" else m.name, fontSize = 14.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
