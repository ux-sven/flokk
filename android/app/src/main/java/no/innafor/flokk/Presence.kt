package no.innafor.flokk

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.realtime
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant

/**
 * Hvem i flokken som har appen åpen nå. Samme kanal som webappen og iOS-appen
 * («presence:group:<id>», nøkkel = bruker-id), så alle ser hverandre.
 * Bare mens skjermen er synlig (STARTED) regnes man som «inne».
 */
@Composable
fun rememberOnline(groupId: String, userId: String?): Set<String> {
    var online by remember(groupId) { mutableStateOf(setOfNotNull(userId)) }
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    LaunchedEffect(groupId, userId) {
        if (userId == null) return@LaunchedEffect
        lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            val channel = supabase.channel("presence:group:$groupId") { presence { key = userId } }
            val changes = channel.presenceChangeFlow()
            try {
                channel.subscribe(blockUntilSubscribed = true)
                channel.track(buildJsonObject { put("since", Instant.now().toString()) })
                changes.collect { action ->
                    online = (online + action.joins.keys) - (action.leaves.keys - userId)
                }
            } finally {
                withContext(NonCancellable) { supabase.realtime.removeChannel(channel) }
            }
        }
    }
    return online
}
