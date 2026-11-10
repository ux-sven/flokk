"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Markerer varsler som lest når siden de gjelder vises:
 * et arrangement (alle varsler for det), eller gruppechatten.
 */
export function MarkRead({ groupId, eventId }: { groupId: string; eventId?: string }) {
  useEffect(() => {
    const supabase = createClient();
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("group_id", groupId)
      .is("read_at", null);
    query = eventId ? query.eq("event_id", eventId) : query.is("event_id", null).eq("kind", "message");
    // Spørringen kjøres først når den awaites/then-es; klokken oppdateres via realtime
    void query.then(() => {});
  }, [groupId, eventId]);
  return null;
}
