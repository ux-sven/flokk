package no.innafor.flokk

import android.app.Application

class FlokkApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        PushManager.createChannel(this)
    }
}
