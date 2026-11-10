import { Suspense } from "react";
import Loading from "@/app/loading";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadGroup } from "@/lib/groups";
import { groupSurface } from "@/lib/tints";
import { NewEventForm } from "./new-event-form";

export const metadata: Metadata = { title: "Nytt arrangement" };

export default function NewEventPage(props: PageProps<"/[gruppe]/arrangement/ny">) {
  return (
    <Suspense fallback={<Loading />}>
      <NewEventPageContent {...props} />
    </Suspense>
  );
}

async function NewEventPageContent({ params }: PageProps<"/[gruppe]/arrangement/ny">) {
  const { gruppe } = await params;
  const { group, user, isMember } = await loadGroup(gruppe);
  if (!user) redirect(`/login?next=/${gruppe}/arrangement/ny`);
  if (!isMember) redirect(`/${gruppe}`);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link href={`/${group.slug}`} className="text-sm text-muted-foreground hover:underline">
        ← {group.name}
      </Link>
      <div className="mt-3 rounded-3xl bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">Nytt arrangement</h1>
        <NewEventForm groupId={group.id} slug={group.slug} groupSurfaceClass={groupSurface(group)} />
      </div>
    </main>
  );
}
