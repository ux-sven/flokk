"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import type { NotifyLevel } from "@/lib/notifications";
import { asBackdrop, asTint } from "@/lib/tints";
import { parseCoords } from "@/lib/places";

export async function joinGroup(groupId: string, slug: string) {
  const user = await requireUser(`/${slug}`);
  const supabase = await createClient();
  await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
  revalidatePath(`/${slug}`);
}

export async function leaveGroup(groupId: string, slug: string) {
  const user = await requireUser(`/${slug}`);
  const supabase = await createClient();
  await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
  redirect("/");
}

export async function createInviteLink(groupId: string, slug: string) {
  await requireUser(`/${slug}`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_invitations")
    .insert({ group_id: groupId })
    .select("token")
    .single();
  if (error || !data) return { error: "Kunne ikke lage invitasjon." };
  return { token: data.token as string };
}

export type CreateEventState = { error?: string };

export async function createEvent(
  groupId: string,
  slug: string,
  _prev: CreateEventState,
  formData: FormData,
): Promise<CreateEventState> {
  await requireUser(`/${slug}/arrangement/ny`);
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim().slice(0, 200) || null;
  const coords = location ? parseCoords(formData.get("location_lat"), formData.get("location_lng")) : null;
  const allowSuggestions = formData.get("allow_time_suggestions") === "on";
  const backdrop = asBackdrop(String(formData.get("backdrop") ?? ""));
  const options = formData
    .getAll("option")
    .map(String)
    .filter((v) => v && !Number.isNaN(Date.parse(v)));

  if (title.length < 2) return { error: "Gi arrangementet en tittel." };
  if (options.length === 0) return { error: "Legg til minst ett forslag til tidspunkt." };

  const supabase = await createClient();
  const { data: event, error } = await supabase
    .from("events")
    .insert({
      group_id: groupId,
      title,
      description,
      location,
      ...(coords ? { location_lat: coords.lat, location_lng: coords.lng } : {}),
      allow_time_suggestions: allowSuggestions,
      ...(backdrop ? { backdrop } : {}),
    })
    .select("id")
    .single();
  if (error || !event) return { error: "Kunne ikke opprette arrangementet." };

  const unique = [...new Set(options)].sort();
  const { error: optError } = await supabase
    .from("event_time_options")
    .insert(unique.map((starts_at) => ({ event_id: event.id, starts_at })));
  if (optError) return { error: "Arrangementet ble opprettet, men tidsforslagene feilet." };

  redirect(`/${slug}/arrangement/${event.id}`);
}

export async function chooseTime(slug: string, eventId: string, optionId: string | null) {
  const supabase = await createClient();
  await supabase
    .from("events")
    .update({ chosen_option_id: optionId, status: optionId ? "scheduled" : "planning" })
    .eq("id", eventId);
  revalidatePath(`/${slug}/arrangement/${eventId}`);
}

export async function addTask(slug: string, eventId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const assignee = String(formData.get("assignee") ?? "") || null;
  if (!title) return;
  const supabase = await createClient();
  await supabase.from("event_tasks").insert({ event_id: eventId, title, assignee_id: assignee });
  revalidatePath(`/${slug}/arrangement/${eventId}`);
}

export async function updateTask(
  slug: string,
  eventId: string,
  taskId: string,
  patch: { status?: "todo" | "done"; assignee_id?: string | null },
) {
  const supabase = await createClient();
  await supabase.from("event_tasks").update(patch).eq("id", taskId);
  revalidatePath(`/${slug}/arrangement/${eventId}`);
}

export async function deleteTask(slug: string, eventId: string, taskId: string) {
  const supabase = await createClient();
  await supabase.from("event_tasks").delete().eq("id", taskId);
  revalidatePath(`/${slug}/arrangement/${eventId}`);
}

export type SuggestTimeState = { error?: string; ok?: number };

/** Et medlem foreslår et nytt tidspunkt, og stemmer automatisk «ja» på det. */
export async function suggestTime(
  slug: string,
  eventId: string,
  prev: SuggestTimeState,
  formData: FormData,
): Promise<SuggestTimeState> {
  const user = await requireUser(`/${slug}/arrangement/${eventId}`);
  const startsAt = String(formData.get("starts_at") ?? "");
  if (Number.isNaN(Date.parse(startsAt))) return { error: "Velg dato og klokkeslett." };
  if (Date.parse(startsAt) < Date.now()) return { error: "Tidspunktet har allerede vært." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("event_time_options")
    .insert({ event_id: eventId, starts_at: startsAt })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { error: "Det tidspunktet er allerede foreslått." };
    if (error?.code === "42501") return { error: "Forslag er stengt for dette arrangementet." };
    return { error: "Kunne ikke legge til forslaget." };
  }

  await supabase.from("event_votes").upsert({ option_id: data.id, user_id: user.id, answer: "yes" });
  revalidatePath(`/${slug}/arrangement/${eventId}`);
  return { ok: (prev.ok ?? 0) + 1 };
}

export async function removeTimeOption(slug: string, eventId: string, optionId: string) {
  const supabase = await createClient();
  await supabase.from("event_time_options").delete().eq("id", optionId);
  revalidatePath(`/${slug}/arrangement/${eventId}`);
}

export async function setAllowTimeSuggestions(slug: string, eventId: string, allow: boolean) {
  const supabase = await createClient();
  await supabase.from("events").update({ allow_time_suggestions: allow }).eq("id", eventId);
  revalidatePath(`/${slug}/arrangement/${eventId}`);
}

export async function setNotifyLevel(groupId: string, slug: string, level: NotifyLevel) {
  await requireUser(`/${slug}`);
  if (!["all", "important", "none"].includes(level)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_notify_level", { gid: groupId, level });
  if (error) console.error("[notify-level]", error.message);
  revalidatePath(`/${slug}`);
}

export async function removeMember(groupId: string, slug: string, memberId: string) {
  const user = await requireUser(`/${slug}`);
  if (memberId === user.id) return { error: "Bruk «Forlat flokken» for å melde deg ut." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", memberId)
    .select("user_id");
  if (error) return { error: "Kunne ikke fjerne medlemmet." };
  // RLS gir ingen feil, bare ingen rader, når man ikke har lov
  if (!data?.length) return { error: "Du har ikke lov til å fjerne dette medlemmet." };
  revalidatePath(`/${slug}`);
  return { ok: true };
}

export async function setEventArchived(slug: string, eventId: string, archived: boolean) {
  await requireUser(`/${slug}/arrangement/${eventId}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", eventId)
    .select("id");
  if (!data?.length) return { error: "Bare arrangøren eller en admin kan arkivere." };
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/arrangement/${eventId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function deleteEvent(slug: string, eventId: string) {
  await requireUser(`/${slug}/arrangement/${eventId}`);
  const supabase = await createClient();
  const { data } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (!data?.length) return { error: "Bare arrangøren eller en admin kan slette." };
  revalidatePath(`/${slug}`);
  revalidatePath("/");
  redirect(`/${slug}`);
}

export async function setGroupAppearance(groupId: string, slug: string, tint: string, backdrop: string | null) {
  await requireUser(`/${slug}`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("groups")
    .update({ tint: asTint(tint), backdrop: asBackdrop(backdrop) })
    .eq("id", groupId)
    .select("id");
  if (error) return { error: "Kunne ikke lagre utseendet. Er databasen oppdatert?" };
  if (!data?.length) return { error: "Bare admins kan endre utseendet på flokken." };
  revalidatePath(`/${slug}`, "layout");
  revalidatePath("/");
  return {};
}

export async function setEventBackdrop(slug: string, eventId: string, backdrop: string | null) {
  await requireUser(`/${slug}/arrangement/${eventId}`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ backdrop: asBackdrop(backdrop) })
    .eq("id", eventId)
    .select("id");
  if (error) return { error: "Kunne ikke lagre bakgrunnen. Er databasen oppdatert?" };
  if (!data?.length) return { error: "Bare arrangøren eller en admin kan endre bakgrunnen." };
  revalidatePath(`/${slug}`, "layout");
  revalidatePath("/");
  return {};
}
