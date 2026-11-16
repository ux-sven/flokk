import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Push (FCM) krever google-services.json fra Firebase-konsollen. Uten filen bygger
// appen fortsatt, men push er slått av (se docs/push-varsler.md).
val hasFirebase = file("google-services.json").exists()
if (hasFirebase) apply(plugin = "com.google.gms.google-services")

// Supabase-nøklene hentes fra webappens .env.local (samme prosjekt), så de aldri sjekkes inn.
fun envLocal(key: String): String {
    val file = File(rootDir, "../.env.local")
    if (!file.exists()) return ""
    return file.readLines()
        .firstOrNull { it.startsWith("$key=") }
        ?.substringAfter("=")?.trim()?.trim('"') ?: ""
}

android {
    namespace = "no.innafor.flokk"
    compileSdk = 37

    defaultConfig {
        applicationId = "no.innafor.flokk"
        minSdk = 28
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        buildConfigField("String", "SUPABASE_URL", "\"${envLocal("NEXT_PUBLIC_SUPABASE_URL")}\"")
        buildConfigField("String", "SUPABASE_KEY", "\"${envLocal("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")}\"")
        buildConfigField("String", "SITE_URL", "\"${envLocal("NEXT_PUBLIC_SITE_URL")}\"")
        buildConfigField("boolean", "HAS_FIREBASE", hasFirebase.toString())
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    debugImplementation(libs.compose.ui.tooling)

    implementation(platform(libs.supabase.bom))
    implementation(libs.supabase.auth)
    implementation(libs.supabase.postgrest)
    implementation(libs.supabase.realtime)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.kotlinx.serialization.json)

    implementation(libs.coil.compose)
    implementation(libs.coil.network)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    implementation(libs.coroutines.play.services)
}
