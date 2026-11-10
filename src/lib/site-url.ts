import "server-only";
import { headers } from "next/headers";

/**
 * Adressen brukeren faktisk er på (f.eks. https://flokk.vercel.app eller
 * http://localhost:3000). Brukes i lenker i e-post, så de alltid peker
 * tilbake til samme nettsted – uansett miljø.
 *
 * Trygt fordi Supabase bare godtar adresser i «Redirect URLs»-listen;
 * en forfalsket header gir derfor ingen lenke til et fremmed nettsted.
 * NEXT_PUBLIC_SITE_URL er bare reserve (den bakes inn ved bygg).
 */
export async function getSiteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, "");

  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
