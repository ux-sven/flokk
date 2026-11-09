"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, FormSuccess } from "@/components/auth-card";
import { updatePassword, type AuthState } from "@/app/login/actions";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, {});

  if (state.done) {
    return (
      <div className="space-y-4">
        <FormSuccess title="Passordet er oppdatert">Du kan nå logge inn med det nye passordet.</FormSuccess>
        <Link href="/" className={buttonVariants({ className: "h-10 w-full" })}>
          Til forsiden
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nytt passord</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-10" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Gjenta passord</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="h-10" />
      </div>
      <FormError message={state.error} />
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? "Lagrer …" : "Lagre passord"}
      </Button>
    </form>
  );
}
