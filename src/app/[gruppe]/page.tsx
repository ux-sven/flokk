import { Suspense } from "react";
import Loading from "@/app/loading";
import type { Metadata } from "next";
import Link from "next/link";
import { Archive, CalendarPlus, ChevronDown, Globe, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chat } from "@/components/chat";
import { CopyLink } from "@/components/copy-link";
import { GroupAppearanceButton } from "@/components/group-appearance-button";
import { InvitePanel } from "@/components/invite-panel";
import { MarkRead } from "@/components/mark-read";
import { OnlineNow, PresenceAvatar, PresenceProvider } from "@/components/presence";
import { NotifyLevelPicker } from "@/components/notify-level-picker";
import { LeaveGroupButton } from "@/components/leave-group-button";
import { RemoveMemberButton } from "@/components/remove-member-button";
import { loadGroup, loadMembers } from "@/lib/groups";
import { formatDateTime } from "@/lib/format";
import { asBackdrop, asTint, eventSurface, groupSurface } from "@/lib/tints";
import type { NotifyLevel } from "@/lib/notifications";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { joinGroup } from "./actions";

const roleLabel = { owner: "Eier", admin: "Admin", member: "" } as const;

export async function generateMetadata({ params }: PageProps<"/[gruppe]">): Promise<Metadata> {
  const { group } = await loadGroup((await params).gruppe);
  return { title: group.name, description: group.description || undefined };
}

export default function GroupPage(props: PageProps<"/[gruppe]">) {
  return (
    <Suspense fallback={<Loading />}>
      <GroupPageContent {...props} />
    </Suspense>
  );
}

async function GroupPageContent({ params }: PageProps<"/[gruppe]">) {
  const { gruppe } = await params;
  const { supabase, group, user, role, isMember, isAdmin } = await loadGroup(gruppe);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-8">
      <header className={cn("relative rounded-3xl p-6 shadow-card sm:p-8", groupSurface(group))}>
        <div className="absolute top-3 right-3 flex gap-1.5 sm:top-4 sm:right-4">
          <CopyLink path={`/${group.slug}`} iconOnly />
          {isAdmin && (
            <GroupAppearanceButton
              key={`${group.tint}:${group.backdrop}`}
              groupId={group.id}
              slug={group.slug}
              initial={{ tint: asTint(group.tint), backdrop: asBackdrop(group.backdrop) }}
            />
          )}
        </div>
        <div className={cn("flex flex-wrap items-start gap-4", isAdmin ? "pr-20" : "pr-10")}>
          <span className="text-5xl" aria-hidden>
            {group.emoji ?? "🪺"}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 text-3xl font-bold tracking-tight break-words hyphens-auto">{group.name}</h1>
              <Badge variant="secondary" className="gap-1">
                {group.visibility === "open" ? <Globe /> : <Lock />}
                {group.visibility === "open" ? "Åpen" : "Kun inviterte"}
              </Badge>
            </div>
            {group.description && <p className="max-w-2xl opacity-80">{group.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2 empty:hidden">
            {!user && (
              <Link href={`/login?next=/${group.slug}`} className={buttonVariants({ size: "lg" })}>
                Logg inn for å bli med
              </Link>
            )}
            {user && !isMember && (
              <form action={joinGroup.bind(null, group.id, group.slug)}>
                <Button type="submit" size="lg">
                  Bli med
                </Button>
              </form>
            )}
          </div>
        </div>
      </header>

      {isMember && user ? (
        <MemberView
          supabase={supabase}
          groupId={group.id}
          groupName={group.name}
          slug={group.slug}
          userId={user.id}
          isAdmin={isAdmin}
          isOwner={role === "owner"}
        />
      ) : (
        <p className="text-muted-foreground">Bli med i flokken for å se arrangementer, medlemmer og chat.</p>
      )}
    </main>
  );
}

async function MemberView({
  supabase,
  groupId,
  groupName,
  slug,
  userId,
  isAdmin,
  isOwner,
}: {
  supabase: Awaited<ReturnType<typeof loadGroup>>["supabase"];
  groupId: string;
  groupName: string;
  slug: string;
  userId: string;
  isAdmin: boolean;
  isOwner: boolean;
}) {
  const [members, { data: events }, { data: messages }, { data: me }, { data: archived }] = await Promise.all([
    loadMembers(groupId),
    supabase
      .from("events")
      .select("id, title, status, location, backdrop, chosen:event_time_options!events_chosen_option_fk(starts_at), event_time_options!event_time_options_event_id_fkey(count)")
      .eq("group_id", groupId)
      .neq("status", "cancelled")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("id, group_id, event_id, author_id, body, created_at")
      .eq("group_id", groupId)
      .is("event_id", null)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("group_members")
      .select("notify_level")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle<{ notify_level: NotifyLevel }>(),
    supabase
      .from("events")
      .select("id, title, archived_at")
      .eq("group_id", groupId)
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .limit(50),
  ]);

  const eventList = (events ?? []) as unknown as {
    id: string;
    title: string;
    location: string | null;
    backdrop: string | null;
    chosen: { starts_at: string } | null;
    event_time_options: { count: number }[];
  }[];
  const names = Object.fromEntries(members.map((m) => [m.user_id, m.profiles?.display_name || "Medlem"]));

  const people = members.map((m) => ({ id: m.user_id, name: names[m.user_id], avatar: m.profiles?.avatar_url }));

  return (
    <PresenceProvider groupId={groupId} userId={userId}>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-bold tracking-tight">Arrangementer</h2>
              <Link href={`/${slug}/arrangement/ny`} className={buttonVariants({ size: "lg" })}>
                <CalendarPlus /> Nytt arrangement
              </Link>
            </div>
            {!eventList.length ? (
              <div className="rounded-3xl bg-card p-6 text-muted-foreground shadow-card">
                Ingen arrangementer ennå. Foreslå noen tidspunkter og la flokken stemme!
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {eventList.map((e) => (
                  <Link
                    key={e.id}
                    href={`/${slug}/arrangement/${e.id}`}
                    className="overflow-hidden rounded-3xl bg-card shadow-card transition-shadow hover:shadow-card-hover"
                  >
                    {asBackdrop(e.backdrop) && <div className={cn("h-16", eventSurface(e, null))} />}
                    <div className="space-y-1 p-5">
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {e.chosen?.starts_at
                          ? formatDateTime(e.chosen.starts_at)
                          : `Stemming pågår · ${e.event_time_options?.[0]?.count ?? 0} forslag`}
                      </p>
                      <p className="font-semibold">{e.title}</p>
                      {e.location && <p className="text-xs text-muted-foreground">{e.location}</p>}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {!!archived?.length && (
              <details className="group rounded-3xl bg-card/60 px-5 py-3 shadow-card">
                <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Archive className="size-4" /> Arkiverte arrangementer · {archived.length}
                  <ChevronDown className="ml-auto size-4 transition-transform group-open:rotate-180" />
                </summary>
                <ul className="mt-3 space-y-1">
                  {archived.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/${slug}/arrangement/${e.id}`}
                        className="flex justify-between gap-3 rounded-xl px-2 py-1.5 text-sm hover:bg-muted"
                      >
                        <span className="truncate">{e.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          arkivert {formatDateTime(e.archived_at as string)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <MarkRead groupId={groupId} />
          <div id="chat" className="scroll-mt-20">
            <Chat
              title="Gruppechat"
              groupId={groupId}
              currentUserId={userId}
              names={names}
              initialMessages={((messages ?? []) as Message[]).reverse()}
            />
          </div>
        </div>

        <aside className="space-y-6">
          <section className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
            <h2 className="text-xl font-semibold">Medlemmer · {members.length}</h2>
            <OnlineNow people={people} currentUserId={userId} className="rounded-2xl bg-emerald-500/10 px-3 py-2" />
            <ul className="space-y-3">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <PresenceAvatar userId={m.user_id} name={names[m.user_id]} src={m.profiles?.avatar_url} className="size-9" />
                  <span className="flex-1 truncate text-sm font-medium">
                    {names[m.user_id]}
                    {m.user_id === userId && <span className="text-muted-foreground"> (deg)</span>}
                  </span>
                  {roleLabel[m.role] && <Badge variant="secondary">{roleLabel[m.role]}</Badge>}
                  {m.user_id !== userId && (isOwner || (isAdmin && m.role === "member")) && (
                    <RemoveMemberButton groupId={groupId} slug={slug} memberId={m.user_id} name={names[m.user_id]} />
                  )}
                </li>
              ))}
            </ul>
            {isAdmin && <InvitePanel groupId={groupId} slug={slug} />}
          </section>
          <NotifyLevelPicker groupId={groupId} slug={slug} level={me?.notify_level ?? "all"} />
          {isOwner ? (
            <p className="px-2 text-center text-xs text-muted-foreground">Du er eier av flokken og kan derfor ikke melde deg ut.</p>
          ) : (
            <LeaveGroupButton groupId={groupId} slug={slug} name={groupName} />
          )}
        </aside>
      </div>
    </PresenceProvider>
  );
}
