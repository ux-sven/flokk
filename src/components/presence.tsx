"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/**
 * Viser hvem i flokken som har appen åpen akkurat nå (Supabase Realtime Presence).
 * Én kanal per flokk; hver fane melder seg inn med bruker-id som nøkkel.
 * Skjult fane (bakgrunn, låst skjerm) teller ikke som «inne».
 */
const OnlineContext = createContext<Set<string>>(new Set());

export function PresenceProvider({
  groupId,
  userId,
  children,
}: {
  groupId: string;
  userId: string;
  children: React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [online, setOnline] = useState<Set<string>>(() => new Set([userId]));

  useEffect(() => {
    const channel = supabase.channel(`presence:group:${groupId}`, {
      config: { presence: { key: userId } },
    });
    let subscribed = false;

    const sync = () => {
      const ids = new Set(Object.keys(channel.presenceState()));
      if (!document.hidden) ids.add(userId);
      setOnline(ids);
    };
    const update = () => {
      if (!subscribed) return;
      if (document.hidden) channel.untrack();
      else channel.track({ since: new Date().toISOString() });
      sync();
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribed = true;
          update();
        }
      });
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      supabase.removeChannel(channel);
    };
  }, [supabase, groupId, userId]);

  return <OnlineContext.Provider value={online}>{children}</OnlineContext.Provider>;
}

export function useOnline() {
  return useContext(OnlineContext);
}

/** Medlemsavatar med grønn prikk når personen er inne nå. */
export function PresenceAvatar({
  userId,
  name,
  src,
  className,
}: {
  userId: string;
  name: string;
  src?: string | null;
  className?: string;
}) {
  const isOnline = useOnline().has(userId);
  return (
    <span className="relative inline-flex shrink-0">
      <MemberAvatar name={name} src={src} className={className} />
      {isOnline && (
        <span
          className="absolute right-0 bottom-0 size-3 rounded-full bg-emerald-500 ring-2 ring-card"
          title={`${name} er inne nå`}
        >
          <span className="sr-only">(inne nå)</span>
        </span>
      )}
    </span>
  );
}

/** «Inne nå»-linje med avatarer for andre medlemmer som er inne. Skjules når ingen andre er inne. */
export function OnlineNow({
  people,
  currentUserId,
  className,
}: {
  people: { id: string; name: string; avatar?: string | null }[];
  currentUserId: string;
  className?: string;
}) {
  const online = useOnline();
  const others = people.filter((p) => p.id !== currentUserId && online.has(p.id));
  if (!others.length) return null;

  const shown = others.slice(0, 5);
  const label =
    others.length === 1
      ? `${others[0].name} er også inne nå`
      : others.length === 2
        ? `${others[0].name} og ${others[1].name} er også inne nå`
        : `${others[0].name} og ${others.length - 1} andre er også inne nå`;

  return (
    <div className={cn("flex items-center gap-2 text-sm", className)} aria-live="polite">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
      </span>
      <span className="flex -space-x-1.5">
        {shown.map((p) => (
          <MemberAvatar key={p.id} name={p.name} src={p.avatar} className="size-6 ring-2 ring-card" />
        ))}
      </span>
      <span className="truncate font-medium">{label}</span>
    </div>
  );
}
