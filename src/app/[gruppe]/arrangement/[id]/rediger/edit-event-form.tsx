"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LocationInput } from "@/components/location-input";
import { updateEvent, type EditEventState } from "@/app/[gruppe]/actions";

export function EditEventForm({
  slug,
  eventId,
  cancelHref,
  initial,
}: {
  slug: string;
  eventId: string;
  cancelHref: string;
  initial: { title: string; description: string; location: string; coords: { lat: number; lng: number } | null };
}) {
  const [state, action, pending] = useActionState<EditEventState, FormData>(updateEvent.bind(null, slug, eventId), {});

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Tittel</Label>
        <Input id="title" name="title" required minLength={2} maxLength={120} className="h-10" defaultValue={initial.title} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Sted</Label>
        <LocationInput defaultValue={initial.location} defaultCoords={initial.coords} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Beskrivelse</Label>
        <Textarea id="description" name="description" rows={4} defaultValue={initial.description} />
      </div>
      <p className="text-xs text-muted-foreground">
        Tidspunkt endrer du på arrangementssiden: foreslå nye tider eller velg et annet forslag.
      </p>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Lagrer …" : "Lagre endringer"}
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Avbryt
        </Link>
      </div>
    </form>
  );
}
