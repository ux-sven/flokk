"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createInviteLink } from "@/app/[gruppe]/actions";

export function InvitePanel({ groupId, slug }: { groupId: string; slug: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await createInviteLink(groupId, slug);
            if ("token" in res && res.token) {
              setError(null);
              setUrl(new URL(`/invitasjon/${res.token}`, window.location.origin).toString());
            } else setError(res.error ?? "Noe gikk galt.");
          })
        }
      >
        <UserPlus /> {pending ? "Lager lenke …" : "Lag invitasjonslenke"}
      </Button>
      {url && (
        <div className="space-y-1">
          <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          <p className="text-xs text-muted-foreground">Gyldig i 14 dager. Del den med dem du vil invitere.</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
