"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  groupId: string;
  eventId?: string | null;
  currentUserId: string;
  names: Record<string, string>;
  initialMessages: Message[];
  title?: string;
};

export function Chat({ groupId, eventId = null, currentUserId, names, initialMessages, title = "Chat" }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${groupId}:${eventId ?? "group"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const msg = payload.new as Message;
          if ((msg.event_id ?? null) !== eventId) return;
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, groupId, eventId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ group_id: groupId, event_id: eventId, body: text })
      .select("id, group_id, event_id, author_id, body, created_at")
      .single<Message>();
    setSending(false);
    if (!error && data) {
      setBody("");
      setMessages((prev) => (prev.some((m) => m.id === data.id) ? prev : [...prev, data]));
    }
  }

  return (
    <section className="flex h-[28rem] flex-col rounded-3xl bg-card shadow-card">
      <h2 className="px-5 pt-5 text-xl font-semibold">{title}</h2>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && <p className="text-sm text-muted-foreground">Ingen meldinger ennå. Si hei!</p>}
        {messages.map((m) => {
          const mine = m.author_id === currentUserId;
          const name = names[m.author_id] ?? "Medlem";
          return (
            <div key={m.id} className={cn("flex gap-2", mine && "flex-row-reverse")}>
              <MemberAvatar name={name} className="size-7" />
              <div className={cn("max-w-[80%] space-y-0.5", mine && "text-right")}>
                <p className="text-[11px] text-muted-foreground">
                  {mine ? "Du" : name} · {formatDateTime(m.created_at)}
                </p>
                <p
                  className={cn(
                    "inline-block rounded-2xl px-3 py-2 text-left text-sm whitespace-pre-wrap",
                    mine ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {m.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Skriv en melding …"
          aria-label="Melding"
          className="h-10 flex-1 rounded-full bg-muted px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon-lg" className="rounded-full" disabled={sending || !body.trim()} aria-label="Send">
          <SendHorizontal />
        </Button>
      </form>
    </section>
  );
}
