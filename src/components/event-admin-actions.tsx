"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteEvent, setEventArchived } from "@/app/[gruppe]/actions";

export function EventAdminActions({
  slug,
  eventId,
  title,
  archived,
}: {
  slug: string;
  eventId: string;
  title: string;
  archived: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function toggleArchive() {
    startTransition(async () => {
      const res = await setEventArchived(slug, eventId, !archived);
      if (res?.error) alert(res.error);
    });
  }

  function remove() {
    if (
      !confirm(
        `Slette «${title}» for godt?\n\nTidsforslag, stemmer, oppgaver og chat slettes også. Dette kan ikke angres – vil du heller beholde historikken, kan du arkivere.`,
      )
    )
      return;
    startTransition(async () => {
      const res = await deleteEvent(slug, eventId);
      if (res?.error) alert(res.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={toggleArchive} disabled={pending}>
        {archived ? <ArchiveRestore /> : <Archive />}
        {archived ? "Gjenopprett" : "Arkiver"}
      </Button>
      <Button variant="destructive" onClick={remove} disabled={pending}>
        <Trash2 /> Slett
      </Button>
    </div>
  );
}
