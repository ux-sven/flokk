"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, FormSuccess } from "@/components/auth-card";
import { signUp, type AuthState } from "@/app/login/actions";

export function RegisterForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});
  const loginHref = `/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  if (state.done) {
    return (
      <FormSuccess title="Bekreft e-postadressen din">
        Vi har sendt en bekreftelseslenke til {state.email}. Klikk på den for å fullføre registreringen.
      </FormSuccess>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="name">Navn</Label>
        <Input id="name" name="name" autoComplete="name" required className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" defaultValue={state.email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Passord</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="h-10"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          Minst 8 tegn.
        </p>
      </div>
      <FormError message={state.error} />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? "Oppretter …" : "Opprett bruker"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Har du allerede en bruker?{" "}
        <Link href={loginHref} className="font-medium text-foreground hover:underline">
          Logg inn
        </Link>
      </p>
    </form>
  );
}
