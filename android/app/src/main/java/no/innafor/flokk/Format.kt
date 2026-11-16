package no.innafor.flokk

import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

object Fmt {
    private val oslo: ZoneId = ZoneId.of("Europe/Oslo")
    private val nb = Locale.forLanguageTag("nb-NO")
    private val dateTimeF = DateTimeFormatter.ofPattern("EEEE d. MMMM 'kl.' HH:mm", nb)
    private val dateTimeYearF = DateTimeFormatter.ofPattern("EEEE d. MMMM yyyy 'kl.' HH:mm", nb)
    private val shortF = DateTimeFormatter.ofPattern("d. MMM HH:mm", nb)
    private val timeF = DateTimeFormatter.ofPattern("HH:mm", nb)
    private val weekdayF = DateTimeFormatter.ofPattern("EEE", nb)
    private val monthF = DateTimeFormatter.ofPattern("MMM", nb)

    fun parse(iso: String): ZonedDateTime? =
        runCatching { OffsetDateTime.parse(iso).atZoneSameInstant(oslo) }.getOrNull()

    /** «lørdag 5. desember kl. 17:00» – med årstall når datoen ikke er i år. */
    fun dateTime(iso: String): String {
        val d = parse(iso) ?: return iso
        return d.format(if (d.year == LocalDate.now(oslo).year) dateTimeF else dateTimeYearF)
    }

    /** Klokkeslett i dag, ellers «11. nov. 14:55». */
    fun messageTime(iso: String): String {
        val d = parse(iso) ?: return ""
        return if (d.toLocalDate() == LocalDate.now(oslo)) d.format(timeF) else d.format(shortF)
    }

    data class Parts(val weekday: String, val day: String, val month: String, val time: String)

    fun parts(iso: String): Parts {
        val d = parse(iso) ?: return Parts("", "", "", "")
        return Parts(
            d.format(weekdayF).replaceFirstChar { it.uppercase() },
            d.dayOfMonth.toString() + ".",
            d.format(monthF),
            d.format(timeF),
        )
    }
}

fun initials(name: String): String =
    name.split(" ").filter { it.isNotBlank() }.take(2).mapNotNull { it.firstOrNull()?.uppercase() }
        .joinToString("").ifEmpty { "?" }
