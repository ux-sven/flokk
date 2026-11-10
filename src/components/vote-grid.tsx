"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownUp, CalendarCheck, Check, ChevronDown, CircleHelp, Crown, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient } from "@/lib/supabase/client";
import { dateParts, formatDateTime } from "@/lib/format";
import type { VoteAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { chooseTime, removeTimeOption } from "@/app/[gruppe]/actions";

type Option = { id: string; starts_at: string; created_by: string | null };
type Vote = { option_id: string; user_id: string; answer: VoteAnswer };
type Person = { id: string; name: string; avatar?: string | null };

const ANSWERS: { value: VoteAnswer; label: string; icon: typeof Check; on: string; bar: string; dot: string }[] = [
  {
    value: "yes",
    label: "Passer",
    icon: Check,
    on: "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    value: "maybe",
    label: "Kanskje",
    icon: CircleHelp,
    on: "bg-amber-400 text-amber-950 shadow-sm",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
  },
  {
    value: "no",
    label: "Passer ikke",
    icon: X,
    on: "bg-zinc-700 text-white shadow-sm dark:bg-zinc-300 dark:text-zinc-900",
    bar: "bg-zinc-300 dark:bg-zinc-600",
    dot: "bg-zinc-400",
  },
];
const answerInfo = Object.fromEntries(ANSWERS.map((a) => [a.value, a])) as Record<VoteAnswer, (typeof ANSWERS)[number]>;

/** Stemmegivning: ett kort per tidspunkt med tre tydelige valg og resultat. */
export function VoteGrid({
  slug,
  eventId,
  eventCreatorId,
  options,
  initialVotes,
  people,
  currentUserId,
  canManage,
  chosenOptionId,
}: {
  slug: string;
  eventId: string;
  eventCreatorId: string;
  options: Option[];
  initialVotes: Vote[];
  people: Person[];
  currentUserId: string;
  canManage: boolean;
  chosenOptionId: string | null;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [votes, setVotes] = useState(initialVotes);
  const [syncedFrom, setSyncedFrom] = useState(initialVotes);
  const [sortBy, setSortBy] = useState<"date" | "popular">("date");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Ta inn ferske stemmer fra serveren etter router.refresh()
  if (syncedFrom !== initialVotes) {
    setSyncedFrom(initialVotes);
    setVotes(initialVotes);
  }

  // Oppdater når andre stemmer eller foreslår/fjerner tidspunkt
  useEffect(() => {
    const ids = options.map((o) => o.id).join(",");
    const channel = supabase
      .channel(`event:${eventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_time_options", filter: `event_id=eq.${eventId}` },
        () => router.refresh(),
      );
    if (ids) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_votes", filter: `option_id=in.(${ids})` },
        () => router.refresh(),
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, options, router]);

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Ingen tidspunkt er foreslått ennå.
      </div>
    );
  }

  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const memberIds = new Set(people.map((p) => p.id));
  const voteOf = (optionId: string, userId: string) =>
    votes.find((v) => v.option_id === optionId && v.user_id === userId)?.answer;
  const votesFor = (optionId: string) => votes.filter((v) => v.option_id === optionId && memberIds.has(v.user_id));
  const score = (optionId: string) =>
    votesFor(optionId).reduce((s, v) => s + (v.answer === "yes" ? 1 : v.answer === "maybe" ? 0.5 : 0), 0);
  const best = Math.max(0, ...options.map((o) => score(o.id)));
  const locked = Boolean(chosenOptionId);

  const myAnswered = options.filter((o) => voteOf(o.id, currentUserId)).length;
  const respondents = new Set(votes.filter((v) => memberIds.has(v.user_id)).map((v) => v.user_id)).size;

  async function vote(optionId: string, answer: VoteAnswer) {
    const current = voteOf(optionId, currentUserId);
    const prev = votes;
    setError(null);
    // Trykk på valgt svar igjen = fjern svaret
    if (current === answer) {
      setVotes((v) => v.filter((x) => !(x.option_id === optionId && x.user_id === currentUserId)));
      const { error } = await supabase
        .from("event_votes")
        .delete()
        .eq("option_id", optionId)
        .eq("user_id", currentUserId);
      if (error) {
        setVotes(prev);
        setError("Kunne ikke fjerne svaret. Prøv igjen.");
      }
      return;
    }
    setVotes((v) => [
      ...v.filter((x) => !(x.option_id === optionId && x.user_id === currentUserId)),
      { option_id: optionId, user_id: currentUserId, answer },
    ]);
    const { error } = await supabase
      .from("event_votes")
      .upsert({ option_id: optionId, user_id: currentUserId, answer, updated_at: new Date().toISOString() });
    if (error) {
      setVotes(prev);
      setError("Kunne ikke lagre svaret. Sjekk nettet og prøv igjen.");
    }
  }

  const ordered =
    sortBy === "date"
      ? options
      : [...options].sort((a, b) => score(b.id) - score(a.id) || a.starts_at.localeCompare(b.starts_at));

  return (
    <div className={cn("space-y-4", pending && "opacity-70")}>
      {/* Status */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {locked ? (
          <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
            <CalendarCheck className="size-4" /> Tidspunktet er bestemt
          </p>
        ) : (
          <div className="flex min-w-48 flex-1 items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
                style={{ width: `${(myAnswered / options.length) * 100}%` }}
              />
            </div>
            <span className={cn("shrink-0", myAnswered === options.length && "font-medium text-emerald-700 dark:text-emerald-400")}>
              {myAnswered === options.length
                ? "Du har svart på alle"
                : `Du har svart på ${myAnswered} av ${options.length}`}
            </span>
          </div>
        )}
        <span className="text-muted-foreground">
          {respondents} av {people.length} har svart
        </span>
        {options.length > 2 && (
          <button
            type="button"
            onClick={() => setSortBy((s) => (s === "date" ? "popular" : "date"))}
            className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowDownUp className="size-3.5" />
            {sortBy === "date" ? "Sortert etter dato" : "Sortert etter flest ja"}
          </button>
        )}
      </div>

      {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <ul className="space-y-3">
        {ordered.map((o) => {
          const chosen = o.id === chosenOptionId;
          const mine = voteOf(o.id, currentUserId);
          const list = votesFor(o.id);
          const count = (a: VoteAnswer) => list.filter((v) => v.answer === a).length;
          const isBest = !locked && best > 0 && score(o.id) === best;
          const suggestedBy = o.created_by && o.created_by !== eventCreatorId ? o.created_by : null;
          const canRemove = !chosen && (canManage || o.created_by === currentUserId);
          const d = dateParts(o.starts_at);
          const yesPeople = list.filter((v) => v.answer === "yes").map((v) => people.find((p) => p.id === v.user_id)!);
          const unanswered = people.filter((p) => !list.some((v) => v.user_id === p.id));

          return (
            <li
              key={o.id}
              className={cn(
                "relative rounded-2xl border bg-card p-4 transition-shadow",
                chosen && "border-emerald-500 ring-2 ring-emerald-500/30",
                locked && !chosen && "opacity-60",
                isBest && "border-emerald-300 dark:border-emerald-800",
              )}
            >
              <div className="flex gap-4">
                {/* Kalenderflis */}
                <div
                  className={cn(
                    "flex w-14 shrink-0 flex-col items-center self-start overflow-hidden rounded-xl border text-center",
                    chosen ? "border-emerald-500" : "border-border",
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "w-full py-0.5 text-[10px] font-semibold tracking-wide uppercase",
                      chosen ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {d.month}
                  </span>
                  <span className="pt-0.5 text-xl leading-tight font-bold">{d.day}</span>
                  <span className="pb-1 text-[10px] text-muted-foreground uppercase">{d.weekday}</span>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  {/* Tittel */}
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1 pr-6">
                    <div className="min-w-0">
                      <p className="font-semibold first-letter:uppercase">
                        {d.long} <span className="text-muted-foreground">kl. {d.time}</span>
                      </p>
                      {suggestedBy && (
                        <p className="text-xs text-muted-foreground">
                          Forslag fra {suggestedBy === currentUserId ? "deg" : (names[suggestedBy] ?? "medlem")}
                        </p>
                      )}
                    </div>
                    {chosen && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                        <CalendarCheck className="size-3" /> Valgt
                      </span>
                    )}
                    {isBest && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <Crown className="size-3" /> Flest ja
                      </span>
                    )}
                  </div>

                  {/* Resultat */}
                  <div className="space-y-1.5">
                    <div
                      className="flex h-2 overflow-hidden rounded-full bg-muted"
                      role="img"
                      aria-label={`${count("yes")} passer, ${count("maybe")} kanskje, ${count("no")} passer ikke`}
                    >
                      {ANSWERS.map((a) => (
                        <div
                          key={a.value}
                          className={cn("h-full transition-[width] duration-500", a.bar)}
                          style={{ width: `${(count(a.value) / Math.max(people.length, 1)) * 100}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {ANSWERS.map((a) => (
                        <span key={a.value} className="flex items-center gap-1">
                          <span className={cn("size-2 rounded-full", a.dot)} />
                          {count(a.value)} {a.label.toLowerCase()}
                        </span>
                      ))}
                      {yesPeople.length > 0 && (
                        <span className="ml-auto flex -space-x-1" title={yesPeople.map((p) => p.name).join(", ")}>
                          {yesPeople.slice(0, 5).map((p) => (
                            <MemberAvatar key={p.id} name={p.name} src={p.avatar} className="size-7 ring-2 ring-card [&_[data-slot=avatar-fallback]]:text-[10px]" />
                          ))}
                          {yesPeople.length > 5 && (
                            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold ring-2 ring-card">
                              +{yesPeople.length - 5}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {/* Mitt svar */}
                {!locked && (
                  <div
                    role="radiogroup"
                    aria-label={`Ditt svar for ${formatDateTime(o.starts_at)}`}
                    className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
                  >
                    {ANSWERS.map((a) => {
                      const on = mine === a.value;
                      const I = a.icon;
                      return (
                        <button
                          key={a.value}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => vote(o.id, a.value)}
                          title={on ? "Trykk igjen for å fjerne svaret" : undefined}
                          className={cn(
                            "flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-xs font-medium transition active:scale-[0.97] sm:h-10 sm:flex-row sm:gap-1.5 sm:text-sm",
                            on ? a.on : "text-muted-foreground hover:bg-background hover:text-foreground",
                          )}
                        >
                          <I className="size-4 shrink-0" />
                          <span className="truncate">{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {locked && mine && (
                  <p className="text-xs text-muted-foreground">
                    Du svarte «{answerInfo[mine].label.toLowerCase()}»
                  </p>
                )}

                {/* Detaljer og arrangørvalg */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <details className="group/who text-sm">
                    <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                      Se hvem som har svart
                      <ChevronDown className="size-3.5 transition-transform group-open/who:rotate-180" />
                    </summary>
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                      {ANSWERS.map((a) => {
                        const who = list
                              .filter((v) => v.answer === a.value)
                              .map((v) => (v.user_id === currentUserId ? "Du" : (names[v.user_id] ?? "Medlem")));
                        return (
                          <div key={a.value}>
                            <dt className="flex items-center gap-1 text-xs font-semibold">
                              <span className={cn("size-2 rounded-full", a.dot)} /> {a.label}
                            </dt>
                            <dd className="text-xs text-muted-foreground">{who.length ? who.join(", ") : "–"}</dd>
                          </div>
                        );
                      })}
                      <div>
                        <dt className="text-xs font-semibold">Ikke svart</dt>
                        <dd className="text-xs text-muted-foreground">
                          {unanswered.length
                            ? unanswered.map((p) => (p.id === currentUserId ? "Du" : p.name)).join(", ")
                            : "Alle har svart 🎉"}
                        </dd>
                      </div>
                    </dl>
                  </details>
                  {canManage && (
                    <Button
                      type="button"
                      size="sm"
                      variant={chosen ? "outline" : isBest ? "default" : "outline"}
                      disabled={pending}
                      onClick={() => {
                        if (!chosen && !confirm(`Velge ${formatDateTime(o.starts_at)}? Medlemmene får beskjed.`)) return;
                        startTransition(() => chooseTime(slug, eventId, chosen ? null : o.id));
                      }}
                    >
                      {chosen ? (
                        <>
                          <Undo2 /> Angre valget
                        </>
                      ) : (
                        <>
                          <CalendarCheck /> Velg dette
                        </>
                      )}
                    </Button>
                  )}
              </div>
              </div>

              {canRemove && (
                <button
                  type="button"
                  aria-label={`Fjern forslaget ${formatDateTime(o.starts_at)}`}
                  title="Fjern forslaget"
                  onClick={() => {
                    if (confirm("Fjerne dette tidspunktet? Stemmene på det forsvinner også.")) {
                      startTransition(() => removeTimeOption(slug, eventId, o.id));
                    }
                  }}
                  className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!locked && (
        <p className="text-xs text-muted-foreground">
          Svar på hvert tidspunkt. Trykk på et valgt svar igjen for å fjerne det.
        </p>
      )}
    </div>
  );
}
