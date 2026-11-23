import { Suspense } from "react";
import Loading from "@/app/loading";
import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { createClient, requireUser } from "@/lib/supabase/server";
import type { MyPlan } from "@/lib/plan";
import { getSiteOrigin } from "@/lib/site-url";
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
  // Gratisgrensen sjekkes før skjemaet, så ingen fyller ut en flokk som ikke kan lagres
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_plan");
  const plan = data as MyPlan | null;
  if (plan && !plan.plus && plan.owned_groups >= plan.max_groups) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <div className="space-y-4 rounded-3xl bg-card p-6 shadow-card sm:p-8">
          <span className="grid size-11 place-items-center rounded-2xl bg-accent text-gold-text">
            <Lock className="size-5" />
          </span>
          <h1 className="text-2xl font-bold">Du har nådd grensen for flokker</h1>
          <p className="text-muted-foreground">
            Du eier allerede {plan.owned_groups} flokker, som er grensen i gratisversjonen. Med Flokk Pluss kan du lage så
            mange du vil. Flokk Pluss kjøpes i Flokk-appen på iPhone, under Profil.
          </p>
          <Link href="/konto" className={buttonVariants({ size: "lg", className: "h-11 px-5" })}>
            Se planen din
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">Opprett en ny flokk</h1>
        <CreateGroupForm siteUrl={await getSiteOrigin()} />
      </div>
    </main>
  );
}
