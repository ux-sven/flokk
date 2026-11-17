// Flokk Pluss: holder public.user_plans i takt med kjøp gjort via RevenueCat
// (App Store nå; Google Play og web senere).
//
// To måter å bli kalt på:
//   1. Webhook fra RevenueCat. Authorization-headeren må være REVENUECAT_WEBHOOK_SECRET
//      (settes i RevenueCat → Integrations → Webhooks → Authorization header).
//   2. Fra appen rett etter et kjøp eller «Gjenopprett kjøp», med brukerens innlogging og
//      body {"sync": true}, så Pluss låses opp med en gang uten å vente på webhooken.
//
// Uansett hendelse henter funksjonen brukerens gjeldende status fra RevenueCat sitt
// REST-API og skriver den til user_plans. Da spiller det ingen rolle om webhooks kommer
// dobbelt eller i feil rekkefølge.
//
// Hemmeligheter (Edge Functions → Secrets):
//   REVENUECAT_API_KEY         hemmelig nøkkel (sk_…) fra RevenueCat → API keys
//   REVENUECAT_WEBHOOK_SECRET  valgfri lang tilfeldig streng, samme som i RevenueCat
//   REVENUECAT_ENTITLEMENT     valgfri, standard «plus»
//
// Deploy med JWT-sjekk av (funksjonen sjekker selv):
//   npx supabase functions deploy revenuecat-webhook --project-ref <ref> --no-verify-jwt --use-api
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (k: string) => Deno.env.get(k) ?? "";
const ENTITLEMENT = env("REVENUECAT_ENTITLEMENT") || "plus";

const admin = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Source = "app_store" | "play_store" | "stripe" | "manual";

/** RevenueCat sitt navn på butikken → source i user_plans. */
function sourceOf(store: string | undefined): Source {
  switch (store) {
    case "app_store":
    case "mac_app_store":
      return "app_store";
    case "play_store":
      return "play_store";
    case "stripe":
    case "rc_billing":
      return "stripe";
    default:
      return "manual"; // f.eks. «promotional» gitt i RevenueCat-dashbordet
  }
}

type Entitlement = { expires_date: string | null; grace_period_expires_date?: string | null; product_identifier: string };
type Subscriber = {
  entitlements: Record<string, Entitlement>;
  subscriptions: Record<string, { store?: string }>;
  non_subscriptions: Record<string, { store?: string }[]>;
};

async function fetchSubscriber(userId: string): Promise<Subscriber> {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${env("REVENUECAT_API_KEY")}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`RevenueCat ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { subscriber: Subscriber }).subscriber;
}

/** Leser status fra RevenueCat og oppdaterer user_plans. Returnerer om brukeren har Pluss. */
async function refresh(userId: string): Promise<{ plus: boolean; expires_at: string | null }> {
  const sub = await fetchSubscriber(userId);
  const ent = sub.entitlements?.[ENTITLEMENT];
  // Henstand (grace period): Apple prøver fortsatt å trekke betalingen, brukeren beholder Pluss
  const expires = ent ? (ent.grace_period_expires_date ?? ent.expires_date) : undefined;
  const active = ent !== undefined && (expires === null || Date.parse(expires!) > Date.now());

  const { data: current } = await admin
    .from("user_plans")
    .select("source, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  // Pluss gitt manuelt for alltid overstyres aldri av butikkene
  const manualLifetime = current?.source === "manual" && current.expires_at === null;

  if (active) {
    if (!manualLifetime) {
      const product = ent!.product_identifier;
      const store = sub.subscriptions?.[product]?.store ?? sub.non_subscriptions?.[product]?.[0]?.store;
      const { error } = await admin.from("user_plans").upsert({
        user_id: userId,
        plan: "plus",
        source: sourceOf(store),
        expires_at: expires,
        note: product,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(`user_plans: ${error.message}`);
    }
    return { plus: true, expires_at: manualLifetime ? null : expires! };
  }

  // Ikke aktiv: fjern det butikkene har gitt, men la manuelt gitt Pluss stå
  if (current && current.source !== "manual") {
    const { error } = await admin.from("user_plans").delete().eq("user_id", userId);
    if (error) throw new Error(`user_plans: ${error.message}`);
  }
  const stillManual = current?.source === "manual" && (current.expires_at === null || Date.parse(current.expires_at) > Date.now());
  return { plus: stillManual, expires_at: stillManual ? current!.expires_at : null };
}

type WebhookEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return json({ error: "method" }, 405);
    if (!env("REVENUECAT_API_KEY")) return json({ error: "revenuecat-not-configured" }, 500);
    const body = await req.json().catch(() => ({}));
    const authorization = req.headers.get("authorization") ?? "";

    // 1) Webhook fra RevenueCat
    const secret = env("REVENUECAT_WEBHOOK_SECRET");
    if (secret && (authorization === secret || authorization === `Bearer ${secret}`)) {
      const e = (body.event ?? {}) as WebhookEvent;
      // Alle brukere hendelsen kan gjelde (overføring av kjøp gjelder to brukere).
      // Anonyme RevenueCat-id-er ($RCAnonymousID:…) er ikke Flokk-brukere og hoppes over.
      const ids = new Set(
        [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? []), ...(e.transferred_from ?? []), ...(e.transferred_to ?? [])]
          .filter((id): id is string => typeof id === "string" && UUID.test(id)),
      );
      const results: Record<string, unknown> = {};
      for (const id of ids) results[id] = await refresh(id);
      console.log("[revenuecat-webhook]", e.type, JSON.stringify(results));
      return json({ type: e.type, results });
    }

    // 2) Synk fra appen etter kjøp
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (body.sync && token) {
      const { data } = await admin.auth.getUser(token);
      if (!data.user) return json({ error: "auth" }, 401);
      return json(await refresh(data.user.id));
    }

    return json({ error: "unauthorized" }, 401);
  } catch (err) {
    console.error("[revenuecat-webhook]", err);
    return json({ error: "internal", message: (err as Error).message }, 500);
  }
});
