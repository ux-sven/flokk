"use server";

import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";
import { asTint } from "@/lib/tints";

export type CreateGroupState = { error?: string };

export async function createGroup(_prev: CreateGroupState, formData: FormData): Promise<CreateGroupState> {
  await requireUser("/grupper/ny");

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "") || name);
  const description = String(formData.get("description") ?? "").trim();
  const visibility = formData.get("visibility") === "open" ? "open" : "invite_only";
  const tint = asTint(String(formData.get("tint") ?? ""));
  const emoji = String(formData.get("emoji") ?? "").trim().slice(0, 8) || null;

  if (name.length < 2) return { error: "Gi flokken et navn på minst to tegn." };
  if (slug.length < 3) return { error: "Adressen må ha minst tre tegn (a–z, 0–9 og bindestrek)." };

  const supabase = await createClient();
  const { error } = await supabase.from("groups").insert({ name, slug, description, visibility, tint, emoji });

  if (error) {
    if (error.code === "23505") return { error: `Adressen «${slug}» er allerede i bruk.` };
    if (error.code === "23514") return { error: `Adressen «${slug}» kan ikke brukes. Velg en annen.` };
    return { error: "Noe gikk galt. Prøv igjen." };
  }

  redirect(`/${slug}`);
}
