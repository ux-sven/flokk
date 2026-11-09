"use client";

import { useTransition } from "react";
import { setAllowTimeSuggestions } from "@/app/[gruppe]/actions";

export function SuggestionsToggle({ slug, eventId, allowed }: { slug: string; eventId: string; allowed: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
      <input
        type="checkbox"
        className="size-4 accent-emerald-600"
        checked={allowed}
        disabled={pending}
        onChange={(e) => startTransition(() => setAllowTimeSuggestions(slug, eventId, e.target.checked))}
      />
      Medlemmer kan foreslå tidspunkt
    </label>
  );
}
