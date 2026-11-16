package no.innafor.flokk

import android.content.Intent
import android.os.Bundle
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.serialization.Serializable

@Serializable object GroupsRoute
@Serializable data class GroupRoute(val groupId: String)
@Serializable data class EventRoute(val eventId: String)
@Serializable data class ChatRoute(val groupId: String, val eventId: String? = null)
@Serializable object CreateGroupRoute
@Serializable data class CreateEventRoute(val groupId: String)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { FlokkTheme { Root() } }
        lifecycleScope.launch { AppRouter.handle(intent) }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        lifecycleScope.launch { AppRouter.handle(intent) }
    }
}

@Composable
private fun Root() {
    val status by supabase.auth.sessionStatus.collectAsStateWithLifecycle()
    when (status) {
        is SessionStatus.Authenticated -> MainTabs()
        is SessionStatus.Initializing -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        else -> LoginScreen()
    }
}

@Composable
private fun MainTabs() {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val nav = rememberNavController()
    val entry by nav.currentBackStackEntryAsState()
    // Chatten har eget skrivefelt nederst, så menylinjen skjules der
    val inChat = tab == 0 && entry?.destination?.hasRoute<ChatRoute>() == true
    val notifications by NotificationCenter.items.collectAsState()
    val unread = notifications.orEmpty().count { it.unread }
    val pending by AppRouter.pending.collectAsState()
    val invitation by AppRouter.invitationToken.collectAsState()
    SessionEffects()

    // Varsel, varselliste eller lenke: åpne flokken (og ev. arrangement/chat)
    LaunchedEffect(pending) {
        val t = pending ?: return@LaunchedEffect
        AppRouter.pending.value = null
        tab = 0
        nav.popBackStack(GroupsRoute, inclusive = false)
        nav.navigate(GroupRoute(t.groupId))
        t.eventId?.let { nav.navigate(EventRoute(it)) }
        if (t.isMessage) nav.navigate(ChatRoute(t.groupId, t.eventId))
    }
    invitation?.let { token -> InvitationDialog(token) { AppRouter.invitationToken.value = null } }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            if (!inChat) NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                NavigationBarItem(
                    selected = tab == 0, onClick = { tab = 0 },
                    icon = { Icon(Icons.Default.Groups, null) }, label = { Text("Flokker") },
                )
                NavigationBarItem(
                    selected = tab == 1, onClick = { tab = 1 },
                    icon = {
                        BadgedBox(badge = { if (unread > 0) Badge { Text(unread.toString()) } }) {
                            Icon(Icons.Default.Notifications, null)
                        }
                    },
                    label = { Text("Varsler") },
                )
                NavigationBarItem(
                    selected = tab == 2, onClick = { tab = 2 },
                    icon = { Icon(Icons.Default.AccountCircle, null) }, label = { Text("Profil") },
                )
            }
        },
    ) { padding ->
        Box(Modifier.padding(bottom = padding.calculateBottomPadding())) {
            if (tab == 0) {
                NavHost(nav, startDestination = GroupsRoute) {
                    composable<GroupsRoute> {
                        GroupsScreen(onOpen = { nav.navigate(GroupRoute(it.id)) }, onCreate = { nav.navigate(CreateGroupRoute) })
                    }
                    composable<CreateGroupRoute> {
                        CreateGroupScreen(onClose = { nav.popBackStack() }) { g ->
                            nav.popBackStack()
                            nav.navigate(GroupRoute(g.id))
                        }
                    }
                    composable<CreateEventRoute> { entry ->
                        CreateEventScreen(entry.toRoute<CreateEventRoute>().groupId, onClose = { nav.popBackStack() }) { id ->
                            nav.popBackStack()
                            nav.navigate(EventRoute(id))
                        }
                    }
                    composable<GroupRoute> { entry ->
                        GroupScreen(
                            groupId = entry.toRoute<GroupRoute>().groupId,
                            onBack = { nav.popBackStack() },
                            onEvent = { nav.navigate(EventRoute(it)) },
                            onChat = { g -> nav.navigate(ChatRoute(g)) },
                            onCreateEvent = { nav.navigate(CreateEventRoute(it)) },
                        )
                    }
                    composable<EventRoute> { entry ->
                        EventScreen(
                            eventId = entry.toRoute<EventRoute>().eventId,
                            onBack = { nav.popBackStack() },
                            onChat = { g, e -> nav.navigate(ChatRoute(g, e)) },
                        )
                    }
                    composable<ChatRoute> { entry ->
                        val r = entry.toRoute<ChatRoute>()
                        ChatScreen(groupId = r.groupId, eventId = r.eventId, onBack = { nav.popBackStack() })
                    }
                }
            } else if (tab == 1) {
                NotificationsScreen()
            } else {
                ProfileScreen()
            }
        }
    }
}
