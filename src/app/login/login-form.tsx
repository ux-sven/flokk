"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, FormSuccess } from "@/components/auth-card";
import { cn } from "@/lib/utils";
import { sendMagicLink, signInWithPassword, type AuthState } from "./actions";

type Method = "password" | "link";

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [method, setMethod] = useState<Method>("password");
  const [pwState, pwAction, pwPending] = useActionState<AuthState, FormData>(signInWithPassword, {
    error: initialError,
  });
  const [linkState, linkAction, linkPending] = useActionState<AuthState, FormData>(sendMagicLink, {});
  const nextQuery = next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Innloggingsmetode" className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm">
        {(
          [
            ["password", "Passord"],
            ["link", "Lenke på e-post"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              "h-8 rounded-lg font-medium transition",
              method === value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {method === "password" ? (
        <form action={pwAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <div className="space-y-2">
            <Label htmlFor="email">E-post</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-10"
              defaultValue={pwState.email}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="password">Passord</Label>
              <Link href="/konto/glemt-passord" className="text-xs text-muted-foreground hover:underline">
                Glemt passord?
              </Link>
            </div>
            <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-10" />
          </div>
          <FormError message={pwState.error} />
          <Button type="submit" className="h-10 w-full" disabled={pwPending}>
            {pwPending ? "Logger inn …" : "Logg inn"}
          </Button>
        </form>
      ) : linkState.done ? (
        <FormSuccess title="Sjekk e-posten din">
          Vi har sendt en innloggingslenke til {linkState.email}. Åpne den i denne nettleseren.
        </FormSuccess>
      ) : (
        <form action={linkAction} className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-muted-foreground">Vi sender deg en lenke – ingen passord nødvendig.</p>
          <div className="space-y-2">
            <Label htmlFor="link-email">E-post</Label>
            <Input
              id="link-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-10"
              defaultValue={linkState.email}
            />
          </div>
          <FormError message={linkState.error} />
          <Button type="submit" className="h-10 w-full" disabled={linkPending}>
            {linkPending ? "Sender …" : "Send innloggingslenke"}
          </Button>
        </form>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Ny her?{" "}
        <Link href={`/konto/registrer${nextQuery}`} className="font-medium text-foreground hover:underline">
          Opprett bruker
        </Link>
      </p>
    </div>
  );
}
