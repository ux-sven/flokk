"use client";

import { useActionState, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { suggestTime, type SuggestTimeState } from "@/app/[gruppe]/actions";

function toIso(local: string) {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Lar et medlem foreslå et nytt tidspunkt. Tidssonen konverteres i nettleseren. */
export function SuggestTime({ slug, eventId, isOrganizer }: { slug: string; eventId: string; isOrganizer: boolean }) {
  const [state, action, pending] = useActionState<SuggestTimeState, FormData>(
    suggestTime.bind(null, slug, eventId),
    {},
  );
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [lastOk, setLastOk] = useState(state.ok);

  // Lukk skjemaet når et forslag er lagt til
  if (state.ok !== lastOk) {
    setLastOk(state.ok);
    setValue("");
    setOpen(false);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" size="lg" onClick={() => setOpen(true)}>
        <CalendarPlus /> {isOrganizer ? "Legg til tidspunkt" : "Foreslå et tidspunkt"}
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <Input
        type="datetime-local"
        aria-label="Nytt tidspunkt"
        required
        autoFocus
        className="h-9 w-auto"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <input type="hidden" name="starts_at" value={value ? toIso(value) : ""} />
      <Button type="submit" className="h-9" disabled={pending || !value}>
        {pending ? "Legger til …" : "Foreslå"}
      </Button>
      <Button type="button" variant="ghost" className="h-9" onClick={() => setOpen(false)}>
        Avbryt
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {!isOrganizer && (
        <p className="w-full text-xs text-muted-foreground">Du stemmer automatisk «ja» på ditt eget forslag.</p>
      )}
    </form>
  );
}
