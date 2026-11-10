"use client";

import { useTransition } from "react";
import { UserMinus } from "lucide-react";
import { removeMember } from "@/app/[gruppe]/actions";

export function RemoveMemberButton({
  groupId,
  slug,
  memberId,
  name,
}: {
  groupId: string;
  slug: string;
  memberId: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`Fjerne ${name} fra flokken?\n\n${name} mister tilgang til arrangementer og chat, og oppgavene blir ledige igjen.`))
      return;
    startTransition(async () => {
      const res = await removeMember(groupId, slug, memberId);
      if (res?.error) alert(res.error);
    });
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      aria-label={`Fjern ${name} fra flokken`}
      title="Fjern fra flokken"
      className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      <UserMinus className="size-4" />
    </button>
  );
}
