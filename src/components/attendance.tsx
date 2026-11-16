"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, CircleHelp, X } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { VoteAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";

type Person = { id: string; name: string; avatar?: string | null };
type Vote = { option_id: string; user_id: string; answer: VoteAnswer };

const CHOICES: { value: VoteAnswer; label: string; icon: typeof Check; on: string }[] = [
  { value: "yes", label: "Kommer", icon: Check, on: "bg-emerald-600 text-white dark:bg-emerald-500" },
  { value: "maybe", label: "Kanskje", icon: CircleHelp, on: "bg-amber-400 text-amber-950" },
  { value: "no", label: "Kommer ikke", icon: X, on: "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900" },
];

/**
 * «Kommer du?» når tidspunktet er valgt. Svaret lagres som stemmen på det
 * valgte tidspunktet, så de som svarte «Passer» står allerede som påmeldt.
 */
export function Attendance({
  optionId,
  startsAt,
  initialVotes,
  people,
  currentUserId,
  calendarHref,
}: {
  optionId: string;
  startsAt: string;
  initialVotes: Vote[];
  people: Person[];
  currentUserId: string;
  calendarHref: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [votes, setVotes] = useState(() => initialVotes.filter((v) => v.option_id === optionId));
  const [syncedFrom, setSyncedFrom] = useState(initialVotes);
  const [error, setError] = useState<string | null>(null);

  if (syncedFrom !== initialVotes) {
    setSyncedFrom(initialVotes);
    setVotes(initialVotes.filter((v) => v.option_id === optionId));
  }

  useEffect(() => {
    const channel = supabase
      .channel(`attendance:${optionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_votes", filter: `option_id=eq.${optionId}` },
        () => router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, optionId, router]);

  const mine = votes.find((v) => v.user_id === currentUserId)?.answer;
  const by = (a: VoteAnswer) => people.filter((p) => votes.some((v) => v.user_id === p.id && v.answer === a));
  const unanswered = people.filter((p) => !votes.some((v) => v.user_id === p.id));
  const groups = [
    { label: "Kommer", people: by("yes") },
    { label: "Kanskje", people: by("maybe") },
    { label: "Kommer ikke", people: by("no") },
    { label: "Ikke svart", people: unanswered },
  ].filter((g) => g.people.length);

  async function answer(a: VoteAnswer) {
    const prev = votes;
    setError(null);
    setVotes((v) => [...v.filter((x) => x.user_id !== currentUserId), { option_id: optionId, user_id: currentUserId, answer: a }]);
    const { error } = await supabase
      .from("event_votes")
      .upsert({ option_id: optionId, user_id: currentUserId, answer: a, updated_at: new Date().toISOString() });
    if (error) {
      setVotes(prev);
      setError("Kunne ikke lagre svaret. Prøv igjen.");
    }
  }

  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Kommer du?</h2>
          <p className="text-sm text-muted-foreground">{formatDateTime(startsAt)}</p>
        </div>
        <a
          href={calendarHref}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-background px-3.5 text-sm font-medium hover:bg-muted"
        >
          <CalendarPlus className="size-4" /> Legg i kalender
        </a>
      </div>

      <div role="radiogroup" aria-label="Kommer du?" className="grid grid-cols-3 gap-2">
        {CHOICES.map(({ value, label, icon: Icon, on }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mine === value}
            onClick={() => answer(value)}
            className={cn(
              "flex h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-semibold transition-colors",
              mine === value ? on : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g.label} className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">
              {g.label} · {g.people.length}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {g.people.map((p) => (
                <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-sm">
                  <MemberAvatar name={p.name} src={p.avatar} className="size-6" />
                  {p.id === currentUserId ? "Du" : p.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
