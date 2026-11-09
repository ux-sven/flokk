import { Suspense } from "react";
import Loading from "@/app/loading";
import type { Metadata } from "next";
import { requireUser } from "@/lib/supabase/server";
import { CreateGroupForm } from "./create-group-form";

export const metadata: Metadata = { title: "Ny flokk" };

export default function NewGroupPage() {
  return (
    <Suspense fallback={<Loading />}>
      <NewGroupPageContent />
    </Suspense>
  );
}

async function NewGroupPageContent() {
  await requireUser("/grupper/ny");
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="rounded-3xl bg-card p-6 shadow-sm sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">Opprett en ny flokk</h1>
        <CreateGroupForm siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "flokk.no"} />
      </div>
    </main>
  );
}
