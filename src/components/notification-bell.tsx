"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Bell, CalendarCheck, CalendarPlus, CalendarX, ClipboardCheck, Clock, MessageCircle, Vote } from "lucide-react";
import { PushToggle } from "@/components/push-toggle";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { formatRelative } from "@/lib/format";
import {
  describeNotification,
  NOTIFICATION_LIMIT,
  NOTIFICATION_SELECT,
  notificationHref,
  type AppNotification,
  type NotificationKind,
} from "@/lib/notifications";
import { cn } from "@/lib/utils";

const icons: Record<NotificationKind, typeof Bell> = {
  event_created: CalendarPlus,
  time_suggested: Clock,
  vote: Vote,
  time_chosen: CalendarCheck,
  event_cancelled: CalendarX,
  task_assigned: ClipboardCheck,
  message: MessageCircle,
};

export function NotificationBell({ userId, initial }: { userId: string; initial: AppNotification[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select(NOTIFICATION_SELECT)
      .order("updated_at", { ascending: false })
      .limit(NOTIFICATION_LIMIT);
    if (data) setItems(data as unknown as AppNotification[]);
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const unread = items.filter((n) => !n.read_at).length;

  // Tallet på app-ikonet (hjemskjerm/dock) følger antall uleste
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    void (unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.())?.catch(() => {});
  }, [unread]);

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? now } : n)));
    await supabase.from("notifications").update({ read_at: now }).in("id", ids);
  }

  function openNotification(n: AppNotification) {
    setOpen(false);
    void markRead(n.read_at ? [] : [n.id]);
    router.push(notificationHref(n));
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label={unread ? `Varsler, ${unread} uleste` : "Varsler"}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), "relative")}
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="flex max-h-[min(32rem,var(--available-height))] w-[min(24rem,calc(100vw-2rem))] origin-[var(--transform-origin)] flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-lg outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <Popover.Title className="font-semibold">Varsler</Popover.Title>
              {unread > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => markRead(items.filter((n) => !n.read_at).map((n) => n.id))}
                >
                  Merk alle som lest
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Ingen varsler ennå. Du får beskjed når noe skjer i flokkene dine.
              </p>
            ) : (
              <ul className="overflow-y-auto">
                {items.map((n) => {
                  const Icon = icons[n.kind];
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted",
                          !n.read_at && "bg-emerald-50/60 dark:bg-emerald-950/30",
                        )}
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span className="line-clamp-2 block text-sm">{describeNotification(n)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {n.group?.name} · {formatRelative(n.updated_at)}
                          </span>
                        </span>
                        {!n.read_at && <span className="mt-2 size-2 shrink-0 rounded-full bg-emerald-600" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <PushToggle />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
