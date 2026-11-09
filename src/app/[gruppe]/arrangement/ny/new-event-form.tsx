"use client";

import { useActionState, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createEvent, type CreateEventState } from "../../actions";

function toIso(local: string) {
  // datetime-local er i brukerens tidssone – konverter i nettleseren
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function NewEventForm({ groupId, slug }: { groupId: string; slug: string }) {
  const [state, action, pending] = useActionState<CreateEventState, FormData>(
    createEvent.bind(null, groupId, slug),
    {},
  );
  const [options, setOptions] = useState<string[]>([""]);

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Tittel</Label>
        <Input id="title" name="title" required className="h-10" placeholder="Sommerfest" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Sted</Label>
        <Input id="location" name="location" className="h-10" placeholder="Hos Kari" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Beskrivelse</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Forslag til tidspunkt</legend>
        <p className="text-xs text-muted-foreground">Medlemmene stemmer ja, kanskje eller nei på hvert forslag.</p>
        {options.map((value, i) => (
          <div key={i} className="flex gap-2">
            <Input
              type="datetime-local"
              aria-label={`Tidspunkt ${i + 1}`}
              className="h-10"
              value={value}
              onChange={(e) => setOptions((o) => o.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <input type="hidden" name="option" value={value ? toIso(value) : ""} />
            {options.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                aria-label="Fjern forslag"
                onClick={() => setOptions((o) => o.filter((_, j) => j !== i))}
              >
                <X />
              </Button>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setOptions((o) => [...o, ""])}>
          <Plus /> Legg til tidspunkt
        </Button>
      </fieldset>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="h-10 px-5">
        {pending ? "Oppretter …" : "Opprett og start avstemning"}
      </Button>
    </form>
  );
}
