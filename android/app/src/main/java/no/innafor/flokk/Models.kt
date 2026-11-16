package no.innafor.flokk

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class FlokkGroup(
    val id: String,
    val slug: String,
    val name: String,
    val description: String? = null,
    val visibility: String = "invite_only",
    val tint: String? = null,
    val backdrop: String? = null,
    val emoji: String? = null,
)

@Serializable
data class Membership(val role: String, val groups: FlokkGroup? = null)

@Serializable
data class Profile(
    val id: String,
    @SerialName("display_name") val displayName: String = "",
    @SerialName("avatar_url") val avatarUrl: String? = null,
)

@Serializable
data class Member(
    @SerialName("user_id") val userId: String,
    val role: String,
    val profiles: Profile? = null,
) {
    val name: String get() = profiles?.displayName?.takeIf { it.isNotBlank() } ?: "Medlem"
}

@Serializable
data class EventSummary(
    val id: String,
    val title: String,
    val status: String,
    val location: String? = null,
    val backdrop: String? = null,
    val chosen: Chosen? = null,
) {
    @Serializable
    data class Chosen(@SerialName("starts_at") val startsAt: String)
}

@Serializable
data class EventDetail(
    val id: String,
    val title: String,
    val description: String = "",
    val location: String? = null,
    @SerialName("location_lat") val locationLat: Double? = null,
    @SerialName("location_lng") val locationLng: Double? = null,
    val backdrop: String? = null,
    val status: String,
    @SerialName("chosen_option_id") val chosenOptionId: String? = null,
    @SerialName("created_by") val createdBy: String,
    @SerialName("group_id") val groupId: String,
    val groups: GroupLook? = null,
) {
    @Serializable
    data class GroupLook(val tint: String? = null, val backdrop: String? = null)
}

enum class VoteAnswer(val value: String, val label: String) {
    YES("yes", "Passer"), MAYBE("maybe", "Kanskje"), NO("no", "Passer ikke");

    companion object {
        fun of(v: String) = entries.first { it.value == v }
    }
}

@Serializable
data class Vote(
    @SerialName("option_id") val optionId: String,
    @SerialName("user_id") val userId: String,
    val answer: String,
)

@Serializable
data class TimeOption(
    val id: String,
    @SerialName("starts_at") val startsAt: String,
    @SerialName("created_by") val createdBy: String? = null,
    @SerialName("event_votes") val eventVotes: List<Vote> = emptyList(),
)

@Serializable
data class Message(
    val id: String,
    @SerialName("group_id") val groupId: String,
    @SerialName("event_id") val eventId: String? = null,
    @SerialName("author_id") val authorId: String,
    val body: String,
    @SerialName("created_at") val createdAt: String,
)
