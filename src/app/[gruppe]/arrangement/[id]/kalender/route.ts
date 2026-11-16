import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";
import { eventIcs } from "@/lib/ics";

const UUID = /^[0-9a-f-]{36}$/i;

/** Kalenderfil for et arrangement med valgt tidspunkt. Bare for medlemmer (RLS). */
export async function GET(_req: Request, ctx: RouteContext<"/[gruppe]/arrangement/[id]/kalender">) {
  const { gruppe, id } = await ctx.params;
  if (!UUID.test(id)) return new NextResponse("Ikke funnet", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const origin = await getSiteOrigin();
  if (!auth.user) {
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(`/${gruppe}/arrangement/${id}/kalender`)}`);
  }

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, description, location, location_lat, location_lng, groups!inner(slug, name), chosen:event_time_options!events_chosen_option_fk(starts_at)",
    )
    .eq("id", id)
    .eq("groups.slug", gruppe)
    .maybeSingle();
  const e = event as unknown as {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    location_lat: number | null;
    location_lng: number | null;
    groups: { slug: string; name: string };
    chosen: { starts_at: string } | null;
  } | null;
  if (!e) return new NextResponse("Ikke funnet", { status: 404 });
  if (!e.chosen) return new NextResponse("Tidspunktet er ikke valgt ennå.", { status: 409 });

  const body = eventIcs({
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    lat: e.location_lat,
    lng: e.location_lng,
    startsAt: e.chosen.starts_at,
    url: `${origin}/${e.groups.slug}/arrangement/${e.id}`,
    groupName: e.groups.name,
  });
  const filename = (e.title.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-") || "arrangement").slice(0, 60);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
