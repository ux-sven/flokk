"use client";

import { useOptimistic, useTransition } from "react";
import { BellRing } from "lucide-react";
import { setNotifyLevel } from "@/app/[gruppe]/actions";
import { notifyLevelLabel, type NotifyLevel } from "@/lib/notifications";
import { cn } from "@/lib/utils";

const levels: NotifyLevel[] = ["all", "important", "none"];

export function NotifyLevelPicker({ groupId, slug, level }: { groupId: string; slug: string; level: NotifyLevel }) {
  const [current, setCurrent] = useOptimistic(level);
  const [pending, startTransition] = useTransition();

  return (
    <section className="space-y-3 rounded-3xl bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <BellRing className="size-5" /> Varsler
      </h2>
      <div role="radiogroup" aria-label="Varsler fra flokken" className="space-y-1.5">
        {levels.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={current === l}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setCurrent(l);
                await setNotifyLevel(groupId, slug, l);
              })
            }
            className={cn(
              "w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-muted",
              current === l && "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
            )}
          >
            <span className="block text-sm font-medium">{notifyLevelLabel[l].label}</span>
            <span className="block text-xs text-muted-foreground">{notifyLevelLabel[l].hint}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
