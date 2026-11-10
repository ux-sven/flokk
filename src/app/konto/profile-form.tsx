"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/auth-card";
import { updateDisplayName, type ProfileState } from "./actions";

export function ProfileForm({ name }: { name: string }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateDisplayName, {});

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="display_name">Visningsnavn</Label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={name}
          maxLength={50}
          required
          autoComplete="name"
          className="h-10"
          aria-describedby="display_name_hint"
        />
        <p id="display_name_hint" className="text-xs text-muted-foreground">
          Dette er navnet de andre i flokkene dine ser.
        </p>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Lagrer …" : "Lagre navn"}
        </Button>
        {state.saved && !pending && (
          <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400" role="status">
            <Check className="size-4" /> Lagret
          </span>
        )}
      </div>
    </form>
  );
}
