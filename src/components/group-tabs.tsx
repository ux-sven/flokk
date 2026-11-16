"use client";

import { useEffect, useState } from "react";
import { CalendarDays, MessagesSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "arrangementer", label: "Arrangementer", icon: CalendarDays },
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "medlemmer", label: "Medlemmer", icon: Users },
] as const;
type Tab = (typeof TABS)[number]["id"];

/**
 * På mobil vises flokksiden som tre faner i stedet for én lang side.
 * Fra lg og oppover vises alt samtidig som før (to kolonner).
 * Fanen følger #chat / #medlemmer i adressen, så varsler kan lenke rett dit.
 */
export function GroupTabs({
  events,
  chat,
  members,
  memberCount,
}: {
  events: React.ReactNode;
  chat: React.ReactNode;
  members: React.ReactNode;
  memberCount: number;
}) {
  const [tab, setTab] = useState<Tab>("arrangementer");

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1);
      if (TABS.some((t) => t.id === h)) setTab(h as Tab);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);

  function select(t: Tab) {
    setTab(t);
    history.replaceState(null, "", t === "arrangementer" ? window.location.pathname : `#${t}`);
  }

  const panel = (t: Tab) => cn(tab !== t && "max-lg:hidden");

  return (
    <>
      <div
        role="tablist"
        aria-label="Deler av flokken"
        className="sticky top-[4.5rem] z-10 flex gap-1 rounded-full bg-card/90 p-1 shadow-card backdrop-blur lg:hidden"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            onClick={() => select(id)}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors",
              tab === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{id === "medlemmer" ? `${label} · ${memberCount}` : label}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <div id="panel-arrangementer" role="tabpanel" aria-labelledby="tab-arrangementer" className={panel("arrangementer")}>
            {events}
          </div>
          <div id="panel-chat" role="tabpanel" aria-labelledby="tab-chat" className={panel("chat")}>
            {chat}
          </div>
        </div>
        <aside id="panel-medlemmer" role="tabpanel" aria-labelledby="tab-medlemmer" className={cn("space-y-6", panel("medlemmer"))}>
          {members}
        </aside>
      </div>
    </>
  );
}
