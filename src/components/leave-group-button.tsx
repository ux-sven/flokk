"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { leaveGroup } from "@/app/[gruppe]/actions";
import { Button } from "@/components/ui/button";

export function LeaveGroupButton({
  groupId,
  slug,
  name,
  redirectTo = "/",
  compact = false,
}: {
  groupId: string;
  slug: string;
  name: string;
  redirectTo?: string;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function leave() {
    if (
      !confirm(
        `Melde deg ut av ${name}?\n\nDu mister tilgang til arrangementer og chat, og oppgavene dine blir ledige igjen. Du trenger en ny invitasjon for å bli med igjen hvis flokken er lukket.`,
      )
    )
      return;
    startTransition(() => leaveGroup(groupId, slug, redirectTo));
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={leave}
      disabled={pending}
      className={compact ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive" : "w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"}
    >
      <LogOut /> {pending ? "Melder ut …" : compact ? "Meld ut" : "Meld meg ut av flokken"}
    </Button>
  );
}
