"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export type BlockedUser = { id: string; name: string };

/** Brukere du har blokkert, med mulighet til å oppheve blokkeringen. */
export function BlockedUsers({ initial }: { initial: BlockedUser[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [users, setUsers] = useState(initial);

  async function unblock(u: BlockedUser) {
    const { error } = await supabase.from("user_blocks").delete().eq("blocked_id", u.id);
    if (!error) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      router.refresh();
    }
  }

  return (
    <section className="space-y-3 rounded-3xl bg-card p-6 shadow-card sm:p-8">
      <h2 className="text-xl font-semibold">Blokkerte brukere</h2>
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Du har ikke blokkert noen. Du kan blokkere eller rapportere noen fra «⋯» ved en melding eller i medlemslisten.
        </p>
      ) : (
        <ul className="divide-y">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="truncate text-sm font-medium">{u.name}</span>
              <Button variant="outline" size="sm" onClick={() => unblock(u)}>
                Opphev blokkering
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
