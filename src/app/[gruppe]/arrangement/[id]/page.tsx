import { Suspense } from "react";
import Loading from "@/app/loading";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Archive, CalendarCheck, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Chat } from "@/components/chat";
import { EventAdminActions } from "@/components/event-admin-actions";
import { MarkRead } from "@/components/mark-read";
import { CopyLink } from "@/components/copy-link";
import { TaskList } from "@/components/task-list";
import { SuggestTime } from "@/components/suggest-time";
import { SuggestionsToggle } from "@/components/suggestions-toggle";
import { VoteGrid } from "@/components/vote-grid";
import { loadGroup, loadMembers } from "@/lib/groups";
import { formatDateTime } from "@/lib/format";
import { asTint, tintBg } from "@/lib/tints";
import type { Message, VoteAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";

type Params = PageProps<"/[gruppe]/arrangement/[id]">;
const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { gruppe } = await params;
  const { group } = await loadGroup(gruppe);
  return { title: group.name };
}

export default function EventPage(props: Params) {
  return (
    <Suspense fallback={<Loading />}>
      <EventPageContent {...props} />
    </Suspense>
  );
}

async function EventPageContent({ params }: Params) {
  const { gruppe, id } = await params;
  if (!UUID.test(id)) notFound();
  const { supabase, group, user, isAdmin, isMember } = await loadGroup(gruppe);
  if (!user) redirect(`/login?next=/${gruppe}/arrangement/${id}`);
  if (!isMember) redirect(`/${gruppe}`);

  const { data: event } = await supabase
    .from("events")
    .select("id, title, description, location, status, chosen_option_id, created_by, allow_time_suggestions, archived_at")
    .eq("id", id)
    .eq("group_id", group.id)
    .maybeSingle();
  if (!event) notFound();

  const [members, { data: options }, { data: tasks }, { data: messages }] = await Promise.all([
    loadMembers(group.id),
    supabase
      .from("event_time_options")
      .select("id, starts_at, created_by, event_votes(option_id, user_id, answer)")
      .eq("event_id", id)
      .order("starts_at"),
    supabase
      .from("event_tasks")
      .select("id, title, status, assignee_id")
      .eq("event_id", id)
      .order("created_at"),
    supabase
      .from("messages")
      .select("id, group_id, event_id, author_id, body, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const people = members.map((m) => ({
    id: m.user_id,
    name: m.profiles?.display_name || "Medlem",
    avatar: m.profiles?.avatar_url,
  }));
  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const opts = (options ?? []) as { id: string; starts_at: string; created_by: string | null; event_votes: { option_id: string; user_id: string; answer: VoteAnswer }[] }[];
  const votes = opts.flatMap((o) => o.event_votes);
  const chosen = opts.find((o) => o.id === event.chosen_option_id);
  const canManage = isAdmin || event.created_by === user.id;
  const isArchived = Boolean(event.archived_at);
  const canSuggest = !isArchived && (canManage || (event.allow_time_suggestions && event.status === "planning"));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/${group.slug}`} className="text-sm text-muted-foreground hover:underline">
          ← {group.name}
        </Link>
        {canManage && (
          <EventAdminActions slug={group.slug} eventId={event.id} title={event.title} archived={isArchived} />
        )}
      </div>

      {isArchived && (
        <p className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          <Archive className="size-4 shrink-0" />
          Arrangementet er arkivert {formatDateTime(event.archived_at as string)} og vises ikke lenger i flokkens liste.
        </p>
      )}

      <header className={cn("space-y-3 rounded-3xl p-6 sm:p-8", tintBg[asTint(group.tint)])}>
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="flex-1 text-3xl font-bold tracking-tight">{event.title}</h1>
          <CopyLink path={`/${group.slug}/arrangement/${event.id}`} />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {chosen ? (
            <Badge className="gap-1">
              <CalendarCheck /> {formatDateTime(chosen.starts_at)}
            </Badge>
          ) : (
            <Badge variant="secondary">Stemming pågår</Badge>
          )}
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="size-4" /> {event.location}
            </span>
          )}
        </div>
        {event.description && <p className="max-w-3xl whitespace-pre-wrap opacity-80">{event.description}</p>}
      </header>

      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Når passer det?</h2>
          {canManage && (
            <SuggestionsToggle slug={group.slug} eventId={event.id} allowed={event.allow_time_suggestions} />
          )}
        </div>
        <VoteGrid
          slug={group.slug}
          eventId={event.id}
          eventCreatorId={event.created_by}
          options={opts.map(({ id, starts_at, created_by }) => ({ id, starts_at, created_by }))}
          initialVotes={votes}
          people={people}
          currentUserId={user.id}
          canManage={canManage}
          chosenOptionId={event.chosen_option_id}
        />
        {canSuggest ? (
          <SuggestTime slug={group.slug} eventId={event.id} isOrganizer={canManage} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {isArchived
              ? "Arrangementet er arkivert, så nye forslag er stengt."
              : event.status === "planning"
              ? "Arrangøren har stengt for nye forslag."
              : "Tidspunktet er valgt, så nye forslag er stengt."}
          </p>
        )}
      </section>

      <MarkRead groupId={group.id} eventId={event.id} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TaskList
          slug={group.slug}
          eventId={event.id}
          tasks={tasks ?? []}
          people={people}
          currentUserId={user.id}
        />
        <Chat
          title="Chat for arrangementet"
          groupId={group.id}
          eventId={event.id}
          currentUserId={user.id}
          names={names}
          initialMessages={((messages ?? []) as Message[]).reverse()}
        />
      </div>
    </main>
  );
}
