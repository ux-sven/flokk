"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationInput } from "@/components/location-input";
import { BackdropPicker } from "@/components/appearance-picker";
import { backdropClass, backdropLabel, type Backdrop } from "@/lib/tints";
import { cn } from "@/lib/utils";
import { createEvent, type CreateEventState } from "../../actions";

function toIso(local: string) {
  // datetime-local er i brukerens tidssone – konverter i nettleseren
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function NewEventForm({
  groupId,
  slug,
  groupSurfaceClass,
}: {
  groupId: string;
  slug: string;
  groupSurfaceClass: string;
}) {
  const [state, action, pending] = useActionState<CreateEventState, FormData>(
    createEvent.bind(null, groupId, slug),
    {},
  );
  const [options, setOptions] = useState<string[]>([""]);
  const [backdrop, setBackdrop] = useState<Backdrop | null>(null);

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Tittel</Label>
        <Input id="title" name="title" required className="h-10" placeholder="Sommerfest" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Sted</Label>
        <LocationInput />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Beskrivelse</Label>
        <Textarea id="description" name="description" rows={3} />
      </div>

      <details className="group rounded-2xl border bg-card">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 text-sm">
          <span className={cn("size-8 shrink-0 rounded-lg border", backdrop ? backdropClass[backdrop] : groupSurfaceClass)} />
          <span className="flex-1">
            <span className="block font-medium">Bakgrunn</span>
            <span className="text-xs text-muted-foreground">{backdrop ? backdropLabel[backdrop] : "Som flokken"}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t p-4">
          <input type="hidden" name="backdrop" value={backdrop ?? ""} />
          <BackdropPicker
            value={backdrop}
            onChange={setBackdrop}
            inherit={{ label: "Som flokken", className: groupSurfaceClass }}
          />
        </div>
      </details>

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
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4">
          <input type="checkbox" name="allow_time_suggestions" defaultChecked className="mt-1 size-4 accent-emerald-600" />
          <span>
            <span className="block text-sm font-medium">La medlemmene foreslå flere tidspunkt</span>
            <span className="text-xs text-muted-foreground">Du kan slå dette av senere. Forslag stenges når du velger tidspunkt.</span>
          </span>
        </label>
      </fieldset>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="h-10 px-5">
        {pending ? "Oppretter …" : "Opprett og start avstemning"}
      </Button>
    </form>
  );
}
