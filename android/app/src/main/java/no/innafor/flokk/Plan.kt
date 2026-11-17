package no.innafor.flokk

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.postgrest.exception.PostgrestRestException
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Flokk Pluss: gratisgrenser og status. Grensene håndheves i databasen
// (supabase/migrations/20261117120000_plans.sql); her brukes de bare til visning.

/** Din plan, fra rpc("my_plan"). */
@Serializable
data class MyPlan(
    val plus: Boolean,
    @SerialName("expires_at") val expiresAt: String? = null,
    @SerialName("owned_groups") val ownedGroups: Int,
    @SerialName("max_groups") val maxGroups: Int,
)

/** En flokks grenser, fra rpc("group_plan"). max* er null når eieren har Pluss. */
@Serializable
data class GroupPlan(
    val plus: Boolean,
    val members: Int,
    @SerialName("max_members") val maxMembers: Int? = null,
    @SerialName("upcoming_events") val upcomingEvents: Int,
    @SerialName("max_upcoming_events") val maxUpcomingEvents: Int? = null,
) {
    val eventsFull get() = maxUpcomingEvents?.let { upcomingEvents >= it } ?: false
    val membersFull get() = maxMembers?.let { members >= it } ?: false
}

/** Meldingen fra databasen når en gratisgrense er nådd (hint «plan_limit:…»), ellers null. */
fun planLimitMessage(e: Throwable): String? =
    (e as? PostgrestRestException)?.takeIf { it.hint?.startsWith("plan_limit:") == true }?.error

/** null hvis migrasjon 15 ikke er kjørt – da vises ingen grenser. */
suspend fun loadMyPlan(): MyPlan? = runCatching { supabase.postgrest.rpc("my_plan").decodeAs<MyPlan>() }.getOrNull()

suspend fun loadGroupPlan(groupId: String): GroupPlan? = runCatching {
    supabase.postgrest.rpc("group_plan", buildJsonObject { put("gid", groupId) }).decodeAs<GroupPlan>()
}.getOrNull()

@Composable
fun PlanCard(plan: MyPlan) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (plan.plus) "Flokk Pluss" else "Gratisversjonen",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 17.sp,
                    modifier = Modifier.weight(1f),
                )
                if (!plan.plus) Text("${plan.ownedGroups} av ${plan.maxGroups} flokker", fontSize = 13.sp)
            }
            val muted = MaterialTheme.colorScheme.onSurfaceVariant
            if (plan.plus) {
                Text("Ingen grenser på flokker, medlemmer eller arrangementer i flokkene du eier.", color = muted)
            } else {
                Text("Eie inntil ${plan.maxGroups} flokker", color = muted, fontSize = 14.sp)
                Text("Inntil 8 medlemmer i hver flokk", color = muted, fontSize = 14.sp)
                Text("Ett kommende arrangement om gangen i hver flokk", color = muted, fontSize = 14.sp)
                Text("Med Flokk Pluss forsvinner grensene for alle flokkene du eier. Kommer snart.", fontSize = 14.sp)
            }
        }
    }
}
