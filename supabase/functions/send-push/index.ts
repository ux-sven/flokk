// Supabase Edge Function: sender Web Push når et varsel lages eller samles opp.
//
// Kalles på to måter:
//  1. Database Webhook på public.notifications (INSERT og UPDATE), med
//     headeren «x-flokk-secret» satt til PUSH_WEBHOOK_SECRET.
//  2. Fra appen med brukerens innlogging og { "test": true } for et testvarsel.
//
// Hemmeligheter (Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUSH_WEBHOOK_SECRET,
//   SITE_URL (kommaseparert liste over adresser appen kjører på)
// SUPABASE_URL og SUPABASE_SERVICE_ROLE_KEY finnes automatisk.
//
// Deploy med «Verify JWT» slått AV – funksjonen sjekker selv hemmelighet/innlogging.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";

const vapidReady = Boolean(env("VAPID_SUBJECT") && env("VAPID_PUBLIC_KEY") && env("VAPID_PRIVATE_KEY"));
if (vapidReady) webpush.setVapidDetails(env("VAPID_SUBJECT"), env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
else console.error("[send-push] Mangler VAPID_SUBJECT, VAPID_PUBLIC_KEY eller VAPID_PRIVATE_KEY");

const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

// SITE_URL kan være flere adresser, kommaseparert (f.eks. produksjon og localhost)
const allowedOrigins = env("SITE_URL").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);

let cors: Record<string, string> = {};
function setCors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  cors = {
    "Access-Control-Allow-Origin": !allowedOrigins.length ? "*" : allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

type NotificationRow = {
  id: string;
  user_id: string;
  group_id: string;
  event_id: string | null;
  kind: string;
  actor_id: string | null;
  data: { title?: string | null; starts_at?: string; task?: string; preview?: string };
  count: number;
  collapse_key: string | null;
  read_at: string | null;
  updated_at: string;
};

type PushPayload = { title: string; body: string; url: string; tag?: string; unread?: number; timestamp?: number };

const when = (iso?: string) =>
  iso
    ? new Intl.DateTimeFormat("nb-NO", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Oslo",
      }).format(new Date(iso))
    : "";

// Holdes i takt med describeNotification i src/lib/notifications.ts
function describe(n: NotificationRow, who: string): string {
  const title = n.data.title ? `«${n.data.title}»` : "arrangementet";
  switch (n.kind) {
    case "event_created":
      return `${who} har laget ${title}. Stem på tidspunkt!`;
    case "time_suggested":
      return n.count > 1
        ? `${n.count} nye forslag til tidspunkt for ${title}`
        : `${who} foreslo ${when(n.data.starts_at)} for ${title}`;
    case "vote":
      return n.count > 1 ? `${n.count} nye stemmer på ${title}` : `${who} har stemt på ${title}`;
    case "time_chosen":
      return `${title} er satt til ${when(n.data.starts_at)}`;
    case "event_cancelled":
      return `${title} er avlyst`;
    case "task_assigned":
      return `${who} ga deg oppgaven «${n.data.task ?? ""}» til ${title}`;
    case "message": {
      const where = n.data.title ? `«${n.data.title}»` : "gruppechatten";
      return n.count > 1 ? `${n.count} nye meldinger i ${where}` : `${who} i ${where}: ${n.data.preview ?? ""}`;
    }
    default:
      return "Noe nytt har skjedd i flokken";
  }
}

async function sendToUser(userId: string, payload: PushPayload) {
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24, urgency: "normal", topic: payload.tag?.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) },
        );
        sent++;
        await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Abonnementet er utløpt eller trukket tilbake
          await admin.from("push_subscriptions").delete().eq("id", s.id);
        } else {
          console.error("[send-push]", status, (err as Error).message);
        }
      }
    }),
  );
  return { sent, devices: subs?.length ?? 0 };
}

async function handleNotification(n: NotificationRow) {
  const [{ data: group }, { data: actor }, { count: unread }] = await Promise.all([
    admin.from("groups").select("slug, name, emoji").eq("id", n.group_id).maybeSingle(),
    n.actor_id
      ? admin.from("profiles").select("display_name").eq("id", n.actor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", n.user_id).is("read_at", null),
  ]);
  if (!group) return { skipped: "group" };

  const path = n.event_id
    ? `/${group.slug}/arrangement/${n.event_id}`
    : n.kind === "message"
      ? `/${group.slug}#chat`
      : `/${group.slug}`;

  return sendToUser(n.user_id, {
    title: [group.emoji, group.name].filter(Boolean).join(" "),
    body: describe(n, actor?.display_name || "Noen"),
    url: path,
    tag: n.collapse_key ?? n.id,
    unread: unread ?? undefined,
    timestamp: Date.parse(n.updated_at) || Date.now(),
  });
}

Deno.serve(async (req) => {
  setCors(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const body = await req.json().catch(() => ({}));
  if (!vapidReady && (body.test || body.record)) return json({ error: "vapid-not-configured" }, 500);

  // 1) Database Webhook
  const secret = env("PUSH_WEBHOOK_SECRET");
  if (secret && req.headers.get("x-flokk-secret") === secret) {
    if (body.table !== "notifications") return json({ skipped: "table" });
    const n = body.record as NotificationRow | undefined;
    const old = body.old_record as NotificationRow | null | undefined;
    if (!n || n.read_at) return json({ skipped: "read" });
    // Oppdateringer teller bare når et samlet varsel har fått noe nytt
    if (body.type === "UPDATE" && old && old.count >= n.count) return json({ skipped: "no-change" });
    return json(await handleNotification(n));
  }

  // 2) Testvarsel fra appen
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (body.test && token) {
    const { data } = await admin.auth.getUser(token);
    if (!data.user) return json({ error: "auth" }, 401);
    const result = await sendToUser(data.user.id, {
      title: "Flokk",
      body: "Push-varsler virker! 🎉",
      url: "/",
      tag: "test",
    });
    return json(result);
  }

  return json({ error: "unauthorized" }, 401);
});
