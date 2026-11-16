package no.innafor.flokk

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

const val CHANNEL_ID = "flokk"

/**
 * Push via Firebase Cloud Messaging. Tokenet lagres i device_tokens (samme tabell
 * som iOS), og Edge Function «send-push» sender til det.
 */
object PushManager {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var token: String? = null

    /** Telefonen er registrert hos Flokk og kan få push */
    val registered = MutableStateFlow(false)
    val lastError = MutableStateFlow<String?>(null)

    fun isConfigured(context: Context) = BuildConfig.HAS_FIREBASE && FirebaseApp.getApps(context).isNotEmpty()

    fun hasPermission(context: Context) =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    fun createChannel(context: Context) {
        val channel = NotificationChannel(CHANNEL_ID, "Flokk", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Nye arrangementer, stemmer, valgt tidspunkt og meldinger"
        }
        context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    /** Henter tokenet og sender det til Supabase (etter innlogging og når det endres). */
    fun refresh(context: Context) {
        if (!isConfigured(context)) {
            lastError.value = "Push er ikke satt opp i denne versjonen av appen."
            return
        }
        scope.launch {
            runCatching { FirebaseMessaging.getInstance().token.await() }
                .onSuccess { upload(it) }
                .onFailure { lastError.value = "Kunne ikke hente push-token." }
        }
    }

    suspend fun upload(newToken: String) {
        token = newToken
        if (supabase.auth.currentUserOrNull() == null) return
        runCatching {
            supabase.postgrest.rpc("register_device_token", buildJsonObject {
                put("device_token", newToken)
                put("device_platform", "android")
                put("device_environment", "production")
                put("device_app_version", BuildConfig.VERSION_NAME)
            })
        }.onSuccess {
            registered.value = true
            lastError.value = null
        }.onFailure { lastError.value = "Kunne ikke registrere telefonen for varsler." }
    }

    /** Ved utlogging skal ikke telefonen få flere varsler for denne brukeren. */
    suspend fun unregister() {
        registered.value = false
        val t = token ?: return
        runCatching { supabase.from("device_tokens").delete { filter { eq("token", t) } } }
    }

    fun launch(block: suspend () -> Unit) = scope.launch { block() }
}

class FlokkMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        PushManager.launch { PushManager.upload(token) }
    }

    /** Send-push sender rene data-meldinger, så varselet bygges her med riktig mål. */
    override fun onMessageReceived(message: RemoteMessage) {
        val d = message.data
        val title = d["title"] ?: return
        val body = d["body"] ?: ""
        val groupId = d["group_id"]
        val eventId = d["event_id"]
        val kind = d["kind"]
        val target = groupId?.let { PushTarget(it, eventId, kind == "message") }

        NotificationCenter.refreshSoon()
        // Ikke vis banner for chatten man allerede ser på
        if (target != null && AppRouter.isViewing(target)) return
        if (!PushManager.hasPermission(this)) return

        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            groupId?.let { putExtra("group_id", it) }
            eventId?.let { putExtra("event_id", it) }
            kind?.let { putExtra("kind", it) }
        }
        val tag = d["tag"] ?: message.messageId ?: title
        val pending = PendingIntent.getActivity(
            this, tag.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pending)
            .setGroup(groupId)
            .setNumber(d["unread"]?.toIntOrNull() ?: 0)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        // Samme tag erstatter forrige varsel for samme tråd (som på web og iOS)
        runCatching { NotificationManagerCompat.from(this).notify(tag, 0, notification) }
    }
}
