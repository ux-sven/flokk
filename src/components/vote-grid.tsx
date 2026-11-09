"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { VoteAnswer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { chooseTime } from "@/app/[gruppe]/actions";

type Option = { id: string; starts_at: string };
type Vote = { option_id: string; user_id: string; answer: VoteAnswer };
type Person = { id: string; name: string; avatar?: string | null };

const next: Record<VoteAnswer | "none", VoteAnswer> = { none: "yes", yes: "maybe", maybe: "no", no: "yes" };
const style: Record<VoteAnswer, string> = {
  yes: "bg-tint-lime text-foreground",
  maybe: "bg-tint-peach text-foreground",
  no: "bg-muted text-muted-foreground",
};
const Icon = { yes: Check, maybe: CircleHelp, no: X };
const label = { yes: "Ja", maybe: "Kanskje", no: "Nei" };

export function VoteGrid({
  slug,
  eventId,
  options,
  initialVotes,
  people,
  currentUserId,
  canManage,
  chosenOptionId,
}: {
  slug: string;
  eventId: string;
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
  const [pending, startTransition] = useTransition();

  // Ta inn ferske stemmer fra serveren etter router.refresh()
  if (syncedFrom !== initialVotes) {
    setSyncedFrom(initialVotes);
    setVotes(initialVotes);
  }

  useEffect(() => {
    const ids = options.map((o) => o.id).join(",");
    if (!ids) return;
    const channel = supabase
      .channel(`votes:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_votes", filter: `option_id=in.(${ids})` }, () =>
        router.refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, options, router]);

  const voteOf = (optionId: string, userId: string) =>
    votes.find((v) => v.option_id === optionId && v.user_id === userId)?.answer;

  async function toggle(optionId: string) {
    const answer = next[voteOf(optionId, currentUserId) ?? "none"];
    setVotes((prev) => [
      ...prev.filter((v) => !(v.option_id === optionId && v.user_id === currentUserId)),
      { option_id: optionId, user_id: currentUserId, answer },
    ]);
    await supabase
      .from("event_votes")
      .upsert({ option_id: optionId, user_id: currentUserId, answer, updated_at: new Date().toISOString() });
  }

  const score = (optionId: string) =>
    votes.reduce((s, v) => (v.option_id !== optionId ? s : s + (v.answer === "yes" ? 1 : v.answer === "maybe" ? 0.5 : 0)), 0);
  const best = Math.max(0, ...options.map((o) => score(o.id)));
  const ordered = [...people].sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th className="min-w-36 text-left font-medium text-muted-foreground">Klikk din rad for å stemme</th>
            {options.map((o) => (
              <th
                key={o.id}
                className={cn(
                  "min-w-28 rounded-xl px-2 py-2 text-center font-semibold",
                  o.id === chosenOptionId ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {formatDateTime(o.starts_at)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((p) => (
            <tr key={p.id}>
              <td className="py-1">
                <span className="flex items-center gap-2">
                  <MemberAvatar name={p.name} src={p.avatar} className="size-7" />
                  <span className="truncate font-medium">{p.id === currentUserId ? "Du" : p.name}</span>
                </span>
              </td>
              {options.map((o) => {
                const a = voteOf(o.id, p.id);
                const I = a ? Icon[a] : null;
                const mine = p.id === currentUserId;
                return (
                  <td key={o.id} className="p-0">
                    <button
                      type="button"
                      disabled={!mine}
                      onClick={() => toggle(o.id)}
                      aria-label={mine ? `Stem på ${formatDateTime(o.starts_at)}` : undefined}
                      className={cn(
                        "flex h-10 w-full items-center justify-center gap-1 rounded-xl text-xs font-medium transition",
                        a ? style[a] : "bg-background",
                        mine && "cursor-pointer ring-1 ring-border hover:ring-primary",
                      )}
                    >
                      {I && <I className="size-4" />}
                      {a ? label[a] : mine ? "Stem" : "–"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td className="pt-2 text-muted-foreground">Poeng (ja = 1, kanskje = ½)</td>
            {options.map((o) => (
              <td key={o.id} className="pt-2 text-center">
                <span className={cn("font-semibold", best > 0 && score(o.id) === best && "text-emerald-600 dark:text-emerald-400")}>
                  {score(o.id)}
                </span>
                {canManage && (
                  <Button
                    type="button"
                    size="xs"
                    variant={o.id === chosenOptionId ? "default" : "outline"}
                    className="mt-1 w-full"
                    disabled={pending}
                    onClick={() =>
                      startTransition(() =>
                        chooseTime(slug, eventId, o.id === chosenOptionId ? null : o.id),
                      )
                    }
                  >
                    {o.id === chosenOptionId ? "Valgt" : "Velg"}
                  </Button>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
