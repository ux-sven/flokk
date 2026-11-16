"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, requireUser } from "@/lib/supabase/server";

export type ProfileState = { error?: string; saved?: boolean };

export async function updateDisplayName(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await requireUser("/konto");
  const name = String(formData.get("display_name") ?? "").trim().replace(/\s+/g, " ");
  if (!name) return { error: "Skriv inn et navn." };
  if (name.length > 50) return { error: "Navnet kan være maks 50 tegn." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "Kunne ikke lagre navnet. Prøv igjen." };

  revalidatePath("/", "layout");
  return { saved: true };
}

export async function deleteAccount() {
  await requireUser("/konto");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_account");
  if (error) {
    if (error.message.startsWith("Overfør eierskapet")) return { error: `${error.message}.` };
    return { error: "Kunne ikke slette kontoen. Prøv igjen, eller ta kontakt." };
  }
  // Brukeren finnes ikke lenger; fjern økten i nettleseren
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/?konto=slettet");
}
