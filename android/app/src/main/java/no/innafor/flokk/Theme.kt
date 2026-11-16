package no.innafor.flokk

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage

private val Light = lightColorScheme(
    primary = Color(0xFF26292E),
    onPrimary = Color.White,
    background = Color(0xFFF3F4F7),
    surface = Color.White,
    surfaceVariant = Color(0xFFEDEEF2),
    secondaryContainer = Color(0xFFA3E4D1),
)
private val Dark = darkColorScheme(
    primary = Color(0xFFF2F2F5),
    onPrimary = Color(0xFF15171B),
    background = Color(0xFF15171B),
    surface = Color(0xFF1F2227),
    surfaceVariant = Color(0xFF2A2D33),
    secondaryContainer = Color(0xFF1D5246),
)

@Composable
fun FlokkTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}

/** Samme pastellfarger som webappen (konvertert fra OKLCH). */
@Composable
fun tintColor(name: String?): Color {
    val dark = isSystemInDarkTheme()
    return when (name) {
        "lime" -> if (dark) Color(0xFF43541F) else Color(0xFFD7F5A3)
        "sky" -> if (dark) Color(0xFF234D63) else Color(0xFFAFDBF6)
        "lilac" -> if (dark) Color(0xFF523C6A) else Color(0xFFD2B6F4)
        "mauve" -> if (dark) Color(0xFF47445C) else Color(0xFFC6C4E0)
        "peach" -> if (dark) Color(0xFF66442C) else Color(0xFFFFCFAF)
        else -> if (dark) Color(0xFF1D5246) else Color(0xFFA3E4D1)
    }
}

val backdropDrawables = mapOf(
    "var" to R.drawable.backdrop_var, "sommer" to R.drawable.backdrop_sommer,
    "host" to R.drawable.backdrop_host, "vinter" to R.drawable.backdrop_vinter,
    "fotball" to R.drawable.backdrop_fotball, "ski" to R.drawable.backdrop_ski,
    "sykkel" to R.drawable.backdrop_sykkel, "noter" to R.drawable.backdrop_noter,
    "piano" to R.drawable.backdrop_piano, "lydbolger" to R.drawable.backdrop_lydbolger,
    "kaffe" to R.drawable.backdrop_kaffe, "sitrus" to R.drawable.backdrop_sitrus,
    "urter" to R.drawable.backdrop_urter, "friluftsliv" to R.drawable.backdrop_friluftsliv,
    "boker" to R.drawable.backdrop_boker, "reise" to R.drawable.backdrop_reise,
)

/** Bakgrunn for flokk/arrangement: bilde hvis valgt, ellers pastellfarge. Legges bak innholdet. */
@Composable
fun SurfaceBox(
    backdrop: String?,
    tint: String?,
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit,
) {
    val res = backdrop?.let { backdropDrawables[it] }
    Box(modifier.background(tintColor(tint))) {
        if (res != null) {
            Image(
                painterResource(res), contentDescription = null,
                contentScale = ContentScale.Crop,
                alignment = BiasAlignment(0.5f, 0f),
                modifier = Modifier.matchParentSize(),
            )
            if (isSystemInDarkTheme()) Box(Modifier.matchParentSize().background(Color.Black.copy(alpha = 0.55f)))
        }
        content()
    }
}

/** Kort med samme myke skygge som webappen. */
@Composable
fun Card(modifier: Modifier = Modifier, radius: Dp = 24.dp, content: @Composable () -> Unit) {
    Surface(
        modifier = modifier.shadow(8.dp, RoundedCornerShape(radius), ambientColor = Color.Black.copy(alpha = 0.08f), spotColor = Color.Black.copy(alpha = 0.12f)),
        shape = RoundedCornerShape(radius),
        color = MaterialTheme.colorScheme.surface,
        content = content,
    )
}

@Composable
fun Avatar(name: String, url: String? = null, size: Dp = 36.dp, online: Boolean = false) {
    Box {
        Box(
            Modifier.size(size).clip(CircleShape).background(tintColor("mint")),
            contentAlignment = Alignment.Center,
        ) {
            if (url != null) {
                AsyncImage(model = url, contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.matchParentSize())
            } else {
                Text(initials(name), fontWeight = FontWeight.SemiBold, fontSize = (size.value * 0.36f).sp, color = Color(0xFF26292E))
            }
        }
        if (online) {
            Box(
                Modifier.align(Alignment.BottomEnd).size(size * 0.32f).clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surface)
            ) {
                Box(Modifier.align(Alignment.Center).size(size * 0.32f - 4.dp).clip(CircleShape).background(Color(0xFF22C55E)))
            }
        }
    }
}

val Green = Color(0xFF22C55E)
val Amber = Color(0xFFF59E0B)
