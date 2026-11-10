import { Suspense } from "react";
import Loading from "@/app/loading";
import Link from "next/link";
import { CalendarCheck, ListChecks, MessagesSquare, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, getUser } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";
import { asTint, tintBg } from "@/lib/tints";
import type { Group } from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardEvent = {
  id: string;
  title: string;
  location: string | null;
  groups: { slug: string; name: string; tint: string } | null;
  chosen: { starts_at: string } | null;
};

export default function Home() {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  const user = await getUser();
  if (!user) return <Landing />;
  return <Dashboard userId={user.id} />;
}

async function Dashboard({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: memberships }, { data: events }] = await Promise.all([
    supabase
      .from("group_members")
      .select("role, groups(id, slug, name, description, tint, emoji, visibility)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, title, status, location, groups(slug, name, tint), chosen:event_time_options!events_chosen_option_fk(starts_at)")
      .neq("status", "cancelled")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(9),
  ]);

  const groups = ((memberships ?? []) as unknown as { groups: Group | null }[]).flatMap((m) =>
    m.groups ? [m.groups] : [],
  );
  const upcoming = (events ?? []) as unknown as DashboardEvent[];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8">
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Mine flokker</h1>
          <Link href="/grupper/ny" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Opprett flokk
          </Link>
        </div>
        {groups.length === 0 ? (
          <div className="rounded-3xl bg-card p-8 text-muted-foreground">
            Du er ikke med i noen flokk ennå. Opprett en, eller åpne en invitasjonslenke du har fått.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/${g.slug}`}
                className={cn(
                  "flex aspect-[5/4] flex-col items-center justify-center gap-2 rounded-3xl p-4 text-center transition-transform hover:-translate-y-0.5",
                  tintBg[asTint(g.tint)],
                )}
              >
                <span className="text-3xl" aria-hidden>
                  {g.emoji ?? "🪺"}
                </span>
                <span className="text-lg font-semibold leading-tight">{g.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Kommende arrangementer</h2>
        {!upcoming.length ? (
          <p className="text-muted-foreground">Ingen arrangementer ennå.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <Link
                key={e.id}
                href={`/${e.groups?.slug}/arrangement/${e.id}`}
                className="group overflow-hidden rounded-3xl bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div className={cn("h-24", tintBg[asTint(e.groups?.tint)])} />
                <div className="space-y-1 p-5">
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {e.chosen?.starts_at ? formatDateTime(e.chosen.starts_at) : "Stemming pågår"}
                  </p>
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.groups?.name}
                    {e.location ? ` · ${e.location}` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function Landing() {
  const features = [
    { icon: Users, title: "Egne grupper", text: "Åpne for alle eller kun for inviterte – med egen, delbar adresse." },
    { icon: CalendarCheck, title: "Stem på tidspunkt", text: "Foreslå tider, la flokken stemme, og velg det som passer flest." },
    { icon: ListChecks, title: "Fordel oppgaver", text: "Hvem tar med hva? Oppgaver knyttet til hvert arrangement." },
    { icon: MessagesSquare, title: "Snakk sammen", text: "Chat for hele gruppen, eller bare for ett arrangement." },
  ];
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight">Samle flokken.</h1>
        <p className="text-lg text-muted-foreground">
          Opprett en gruppe, inviter folk, og planlegg treff der alle får si sitt om når det passer.
        </p>
        <Link href="/login" className={buttonVariants({ size: "lg", className: "h-11 px-5" })}>
          Kom i gang
        </Link>
      </div>
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {features.map(({ icon: Icon, title, text }, i) => (
          <div
            key={title}
            className={cn("rounded-3xl p-6", tintBg[(["lime", "mint", "sky", "lilac"] as const)[i]])}
          >
            <Icon className="size-6" />
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-1 text-sm opacity-80">{text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

function SetupNotice() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-16">
      <div className="space-y-3 rounded-3xl bg-card p-8">
        <h1 className="text-2xl font-bold">Supabase er ikke koblet til ennå</h1>
        <p className="text-muted-foreground">
          Kopier <code>.env.example</code> til <code>.env.local</code> og fyll inn URL og publishable key
          fra Supabase-prosjektet. Kjør deretter migrasjonen i <code>supabase/migrations</code>.
        </p>
      </div>
    </main>
  );
}
