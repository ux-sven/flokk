"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, FormSuccess } from "@/components/auth-card";
import { requestPasswordReset, type AuthState } from "@/app/login/actions";

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});

  if (state.done) {
    return (
      <FormSuccess title="Sjekk e-posten din">
        Finnes det en bruker med {state.email}, har vi sendt en lenke for å lage nytt passord.
      </FormSuccess>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-post</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-10" defaultValue={state.email} />
      </div>
      <FormError message={state.error} />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? "Sender …" : "Send lenke"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-muted-foreground hover:underline">
          Tilbake til innlogging
        </Link>
      </p>
    </form>
  );
}
