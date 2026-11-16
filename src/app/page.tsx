import { Suspense } from "react";
import Loading from "@/app/loading";
import Link from "next/link";
import { CalendarCheck, ListChecks, MessagesSquare, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient, getUser } from "@/lib/supabase/server";
import { splitEvents } from "@/lib/events";
import { formatDateTime } from "@/lib/format";
import { eventSurface, groupSurface, tintBg } from "@/lib/tints";
import type { Group } from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardEvent = {
  id: string;
  created_at: string;
  title: string;
  location: string | null;
  backdrop: string | null;
  groups: { slug: string; name: string; tint: string; backdrop: string | null } | null;
  chosen: { starts_at: string } | null;
};

export default function Home(props: PageProps<"/">) {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent {...props} />
    </Suspense>
  );
}

async function HomeContent({ searchParams }: PageProps<"/">) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  const user = await getUser();
  if (!user) return <Landing deleted={(await searchParams).konto === "slettet"} />;
  return <Dashboard userId={user.id} />;
}

async function Dashboard({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: memberships }, { data: events }] = await Promise.all([
    supabase
      .from("group_members")
      .select("role, groups(id, slug, name, description, tint, backdrop, emoji, visibility)")
      .eq("user_id", userId)
      .order("joined_at", { ascending: false }),
    supabase
      .from("events")
      .select("id, title, status, location, backdrop, created_at, groups(slug, name, tint, backdrop), chosen:event_time_options!events_chosen_option_fk(starts_at)")
      .neq("status", "cancelled")
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const groups = ((memberships ?? []) as unknown as { groups: Group | null }[]).flatMap((m) =>
    m.groups ? [m.groups] : [],
  );
  const { voting, upcoming } = splitEvents((events ?? []) as unknown as DashboardEvent[]);

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
          <div className="rounded-3xl bg-card p-8 text-muted-foreground shadow-card">
            Du er ikke med i noen flokk ennå. Opprett en, eller åpne en invitasjonslenke du har fått.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {groups.map((g) => (
              <Link
                key={g.id}
                href={`/${g.slug}`}
                className={cn(
                  "flex aspect-[5/4] flex-col items-center justify-center gap-2 rounded-3xl p-4 text-center shadow-card transition-[translate,box-shadow] hover:-translate-y-0.5 hover:shadow-card-hover",
                  groupSurface(g),
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
          <p className="text-muted-foreground">
            {voting.length ? "Ingen arrangementer har fått tidspunkt ennå." : "Ingen kommende arrangementer."}
          </p>
        ) : (
          <EventGrid events={upcoming.slice(0, 9)} />
        )}
        {upcoming.length > 9 && (
          <p className="text-sm text-muted-foreground">
            Og {upcoming.length - 9} til – se flokkene for alle arrangementer.
          </p>
        )}
      </section>

      {!!voting.length && (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight">Stemming pågår</h2>
          <EventGrid events={voting.slice(0, 6)} />
          {voting.length > 6 && (
            <p className="text-sm text-muted-foreground">Og {voting.length - 6} til – se flokkene for alle.</p>
          )}
        </section>
      )}
    </main>
  );
}

function EventGrid({ events }: { events: DashboardEvent[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => (
        <Link
          key={e.id}
          href={`/${e.groups?.slug}/arrangement/${e.id}`}
          className="group overflow-hidden rounded-3xl bg-card shadow-card transition-shadow hover:shadow-card-hover"
        >
          <div className={cn("h-24", eventSurface(e, e.groups))} />
          <div className="space-y-1 p-5">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
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
  );
}

function Landing({ deleted = false }: { deleted?: boolean }) {
  const features = [
    { icon: Users, title: "Egne grupper", text: "Åpne for alle eller kun for inviterte – med egen, delbar adresse." },
    { icon: CalendarCheck, title: "Stem på tidspunkt", text: "Foreslå tider, la flokken stemme, og velg det som passer flest." },
    { icon: ListChecks, title: "Fordel oppgaver", text: "Hvem tar med hva? Oppgaver knyttet til hvert arrangement." },
    { icon: MessagesSquare, title: "Snakk sammen", text: "Chat for hele gruppen, eller bare for ett arrangement." },
  ];
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-16">
      {deleted && (
        <p role="status" className="mb-10 rounded-2xl bg-card px-5 py-4 text-sm shadow-card">
          Kontoen din er slettet. Takk for at du brukte Flokk.
        </p>
      )}
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
            className={cn("rounded-3xl p-6 shadow-card", tintBg[(["lime", "mint", "sky", "lilac"] as const)[i]])}
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
      <div className="space-y-3 rounded-3xl bg-card p-8 shadow-card">
        <h1 className="text-2xl font-bold">Supabase er ikke koblet til ennå</h1>
        <p className="text-muted-foreground">
          Kopier <code>.env.example</code> til <code>.env.local</code> og fyll inn URL og publishable key
          fra Supabase-prosjektet. Kjør deretter migrasjonen i <code>supabase/migrations</code>.
        </p>
      </div>
    </main>
  );
}
