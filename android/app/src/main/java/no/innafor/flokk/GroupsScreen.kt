package no.innafor.flokk

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.launch

const val GROUP_COLUMNS = "id, slug, name, description, visibility, tint, backdrop, emoji"

@Composable
fun GroupsScreen(onOpen: (FlokkGroup) -> Unit) {
    var groups by remember { mutableStateOf<List<FlokkGroup>?>(null) }
    var refreshing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        val uid = supabase.auth.currentUserOrNull()?.id ?: return
        try {
            groups = supabase.from("group_members")
                .select(Columns.raw("role, groups($GROUP_COLUMNS)")) {
                    filter { eq("user_id", uid) }
                    order("joined_at", Order.ASCENDING)
                }
                .decodeList<Membership>().mapNotNull { it.groups }
            error = null
        } catch (e: Exception) {
            error = "Kunne ikke hente flokkene."
            if (groups == null) groups = emptyList()
        }
    }
    LaunchedEffect(Unit) { load() }

    PullToRefreshBox(
        isRefreshing = refreshing,
        onRefresh = { scope.launch { refreshing = true; load(); refreshing = false } },
        modifier = Modifier.fillMaxSize().statusBarsPadding(),
    ) {
        LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            item {
                Text("Mine flokker", fontSize = 34.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 24.dp, bottom = 8.dp))
            }
            val list = groups
            if (list == null) {
                item { Box(Modifier.fillMaxWidth().padding(48.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() } }
            } else if (list.isEmpty()) {
                item {
                    Text(
                        "Ingen flokker ennå. Lag en flokk eller bli med via en invitasjonslenke.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 32.dp),
                    )
                }
            }
            items(list.orEmpty(), key = { it.id }) { g -> GroupTile(g) { onOpen(g) } }
            error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }
        }
    }
}

@Composable
fun GroupTile(group: FlokkGroup, onClick: () -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    SurfaceBox(
        group.backdrop, group.tint,
        Modifier.fillMaxWidth().shadow(8.dp, shape, ambientColor = Color.Black.copy(0.08f), spotColor = Color.Black.copy(0.12f))
            .clip(shape).clickable(onClick = onClick).heightIn(min = 100.dp),
    ) {
        Row(Modifier.padding(20.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(group.emoji ?: "🪺", fontSize = 38.sp)
            Column(Modifier.weight(1f)) {
                Text(group.name, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                group.description?.takeIf { it.isNotBlank() }?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
            Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
