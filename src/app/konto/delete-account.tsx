"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteAccount } from "./actions";

const CONFIRM = "SLETT";

export function DeleteAccount({ ownedWithOthers }: { ownedWithOthers: string[] }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const blocked = ownedWithOthers.length > 0;

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteAccount();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <section className="space-y-4 rounded-3xl border border-destructive/30 bg-card p-6 shadow-card sm:p-8">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-destructive">Slett kontoen</h2>
        <p className="text-sm text-muted-foreground">
          Profilen din, medlemskapene, stemmene, meldingene og varslene dine slettes for godt. Flokker der du er
          alene slettes også. Arrangementer du har laget i andres flokker blir stående, med eieren av flokken som
          arrangør. Dette kan ikke angres.
        </p>
      </div>
      {blocked ? (
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
          Du er eier av {ownedWithOthers.join(", ")}. Overfør eierskapet under flokkens innstillinger før du sletter
          kontoen.
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="confirm-delete">
            Skriv <span className="font-semibold">{CONFIRM}</span> for å bekrefte
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="confirm-delete"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              className="h-10 min-w-40 flex-1"
            />
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={typed.trim().toUpperCase() !== CONFIRM || pending}
              onClick={remove}
            >
              <Trash2 /> {pending ? "Sletter …" : "Slett kontoen min"}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
