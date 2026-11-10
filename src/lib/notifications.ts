import { formatDateTime } from "@/lib/format";

export type NotificationKind =
  | "event_created"
  | "time_suggested"
  | "vote"
  | "time_chosen"
  | "event_cancelled"
  | "task_assigned"
  | "message";

export type NotifyLevel = "all" | "important" | "none";

export type AppNotification = {
  id: string;
  kind: NotificationKind;
  count: number;
  data: { title?: string | null; starts_at?: string; task?: string; preview?: string };
  read_at: string | null;
  updated_at: string;
  event_id: string | null;
  group: { slug: string; name: string } | null;
  actor: { display_name: string } | null;
};

export const NOTIFICATION_SELECT =
  "id, kind, count, data, read_at, updated_at, event_id, group:groups(slug, name), actor:profiles!notifications_actor_id_fkey(display_name)";

export const NOTIFICATION_LIMIT = 30;

/** Teksten i varselet, på norsk. */
export function describeNotification(n: AppNotification): string {
  const who = n.actor?.display_name || "Noen";
  const title = n.data.title ? `«${n.data.title}»` : "arrangementet";
  const when = n.data.starts_at ? formatDateTime(n.data.starts_at) : "";

  switch (n.kind) {
    case "event_created":
      return `${who} har laget ${title}. Stem på tidspunkt!`;
    case "time_suggested":
      return n.count > 1
        ? `${n.count} nye forslag til tidspunkt for ${title}`
        : `${who} foreslo ${when} for ${title}`;
    case "vote":
      return n.count > 1 ? `${n.count} nye stemmer på ${title}` : `${who} har stemt på ${title}`;
    case "time_chosen":
      return `${title} er satt til ${when}`;
    case "event_cancelled":
      return `${title} er avlyst`;
    case "task_assigned":
      return `${who} ga deg oppgaven «${n.data.task ?? ""}» til ${title}`;
    case "message": {
      const where = n.data.title ? `«${n.data.title}»` : "gruppechatten";
      return n.count > 1
        ? `${n.count} nye meldinger i ${where}`
        : `${who} i ${where}: ${n.data.preview ?? ""}`;
    }
  }
}

export function notificationHref(n: AppNotification): string {
  const slug = n.group?.slug;
  if (!slug) return "/";
  if (n.event_id) return `/${slug}/arrangement/${n.event_id}`;
  return n.kind === "message" ? `/${slug}#chat` : `/${slug}`;
}

export const notifyLevelLabel: Record<NotifyLevel, { label: string; hint: string }> = {
  all: { label: "Alt", hint: "Nye arrangementer, chat, stemmer og forslag" },
  important: { label: "Det viktigste", hint: "Nye arrangementer, valgt tidspunkt, avlysninger og dine oppgaver" },
  none: { label: "Ingenting", hint: "Ingen varsler fra denne flokken" },
};
