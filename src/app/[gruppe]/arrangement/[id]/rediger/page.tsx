import { Suspense } from "react";
import Loading from "@/app/loading";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadGroup } from "@/lib/groups";
import { EditEventForm } from "./edit-event-form";

export const metadata: Metadata = { title: "Rediger arrangement" };

type Params = PageProps<"/[gruppe]/arrangement/[id]/rediger">;
const UUID = /^[0-9a-f-]{36}$/i;

export default function EditEventPage(props: Params) {
  return (
    <Suspense fallback={<Loading />}>
      <EditEventPageContent {...props} />
    </Suspense>
  );
}

async function EditEventPageContent({ params }: Params) {
  const { gruppe, id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, group, user, isAdmin, isMember } = await loadGroup(gruppe);
  if (!user) redirect(`/login?next=/${gruppe}/arrangement/${id}/rediger`);
  if (!isMember) redirect(`/${gruppe}`);

  const { data: event } = await supabase
    .from("events")
    .select("id, title, description, location, location_lat, location_lng, created_by")
    .eq("id", id)
    .eq("group_id", group.id)
    .maybeSingle();
  if (!event) notFound();
  const back = `/${group.slug}/arrangement/${event.id}`;
  if (!isAdmin && event.created_by !== user.id) redirect(back);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href={back} className="text-sm text-muted-foreground hover:underline">
        ← {event.title}
      </Link>
      <div className="mt-3 rounded-3xl bg-card p-6 shadow-card sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">Rediger arrangement</h1>
        <EditEventForm
          slug={group.slug}
          eventId={event.id}
          cancelHref={back}
          initial={{
            title: event.title,
            description: event.description ?? "",
            location: event.location ?? "",
            coords:
              event.location_lat != null && event.location_lng != null
                ? { lat: event.location_lat, lng: event.location_lng }
                : null,
          }}
        />
      </div>
    </main>
  );
}
