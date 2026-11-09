import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, supabaseKey, supabaseUrl } from "./env";

export async function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase er ikke konfigurert: sett NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY i .env.local (se docs/supabase-oppsett.md).",
    );
  }
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Kalt fra en Server Component – proxy.ts oppdaterer sesjonen.
        }
      },
    },
  });
}

/** Henter innlogget bruker, eller null. */
export async function getUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Krever innlogging; sender til /login med retur-URL ellers. */
export async function requireUser(next = "/") {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}
