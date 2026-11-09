import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Group, Member, Role } from "@/lib/types";

/** Henter gruppe + innlogget brukers rolle. 404 hvis gruppen ikke er synlig. */
export const loadGroup = cache(async (slug: string) => {
  const supabase = await createClient();
  const [{ data: group }, { data: auth }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, slug, name, description, visibility, tint, emoji")
      .eq("slug", slug)
      .maybeSingle<Group>(),
    supabase.auth.getUser(),
  ]);
  if (!group) notFound();

  const user = auth.user;
  let role: Role | null = null;
  if (user) {
    const { data } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", group.id)
      .eq("user_id", user.id)
      .maybeSingle<{ role: Role }>();
    role = data?.role ?? null;
  }

  return {
    supabase,
    group,
    user,
    role,
    isMember: role !== null,
    isAdmin: role === "owner" || role === "admin",
  };
});

export async function loadMembers(groupId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("group_members")
    .select("user_id, role, profiles(id, display_name, avatar_url)")
    .eq("group_id", groupId)
    .order("joined_at");
  return (data ?? []) as unknown as Member[];
}
