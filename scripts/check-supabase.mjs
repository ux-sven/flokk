// Sjekker at Supabase-prosjektet er satt opp riktig for Flokk.
// Kjør: npm run check:supabase   (leser .env.local)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const site = process.env.NEXT_PUBLIC_SITE_URL;

let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg, hint) => {
  failed++;
  console.log(`  ✗ ${msg}${hint ? `\n      → ${hint}` : ""}`);
};
const warn = (msg) => console.log(`  ! ${msg}`);

console.log("\nMiljøvariabler");
if (!url || !key) {
  bad("NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY må være satt", "cp .env.example .env.local og fyll inn");
  process.exit(1);
}
if (/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url) || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(url)) ok(`URL: ${url}`);
else bad(`URL ser uvanlig ut: ${url}`, "Forventet https://<prosjekt-ref>.supabase.co");

if (key.startsWith("sb_secret_") || key.includes("service_role"))
  bad("Nøkkelen ser ut som en hemmelig nøkkel!", "Bruk publishable/anon-nøkkelen – den hemmelige må aldri ligge i NEXT_PUBLIC_*");
else if (key.startsWith("sb_publishable_")) ok("Publishable key");
else warn("Nøkkelen er en eldre anon-nøkkel (fungerer, men publishable key anbefales)");

if (site) ok(`NEXT_PUBLIC_SITE_URL: ${site}`);
else warn("NEXT_PUBLIC_SITE_URL er ikke satt (faller tilbake til request-origin)");

const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
async function call(path, init) {
  try {
    const res = await fetch(`${url}${path}`, { headers, ...init });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: { message: e.message } };
  }
}

console.log("\nDatabase (migrasjoner)");
const groups = await call("/rest/v1/groups?select=id,slug,visibility&limit=1");
if (groups.status === 200) ok("Tabellen groups finnes og kan leses av utloggede");
else if (groups.status === 0) {
  bad(`Får ikke kontakt med ${url}`, groups.body?.message);
  process.exit(1);
}
else if (groups.body?.code === "PGRST205" || groups.body?.code === "42P01")
  bad("Tabellen groups finnes ikke", "Kjør migrasjonene i supabase/migrations (se docs/supabase-oppsett.md)");
else if (groups.body?.code === "42501")
  bad("Mangler rettigheter på groups", "Kjør 20261109130000_grants.sql");
else bad(`Uventet svar fra groups (${groups.status})`, JSON.stringify(groups.body));

const events = await call("/rest/v1/events?select=id&limit=1");
if (events.status === 200 && Array.isArray(events.body) && events.body.length === 0)
  ok("Arrangementer er skjult for utloggede (RLS virker)");
else if (events.status === 401 || events.body?.code === "42501") ok("Utloggede har ikke tilgang til arrangementer");
else if (events.status === 200 && events.body?.length) bad("Utloggede kan lese arrangementer!", "Sjekk at RLS er slått på");
else bad(`Uventet svar fra events (${events.status})`, JSON.stringify(events.body));

const suggest = await call("/rest/v1/rpc/can_suggest_time", {
  method: "POST",
  body: JSON.stringify({ eid: "00000000-0000-0000-0000-000000000000" }),
});
if (suggest.status === 200) ok("Forslag til tidspunkt er satt opp (migrasjon 4)");
else bad("Mangler støtte for forslag til tidspunkt", "Kjør 20261109150000_time_suggestions.sql");

const notif = await call("/rest/v1/notifications?select=id&limit=1");
if (notif.body?.code === "PGRST205" || notif.body?.code === "42P01")
  bad("Mangler varsler", "Kjør 20261109160000_notifications.sql");
else if (notif.status === 200 && Array.isArray(notif.body) && notif.body.length) bad("Utloggede kan lese varsler!", "Sjekk RLS på notifications");
else ok("Varsler er satt opp (migrasjon 5) og skjult for utloggede");

const rpc = await call("/rest/v1/rpc/get_invitation", { method: "POST", body: JSON.stringify({ invite_token: "sjekk" }) });
if (rpc.status === 200) ok("RPC get_invitation finnes");
else bad(`RPC get_invitation svarer ${rpc.status}`, "Kjør migrasjonene på nytt");

console.log("\nPush-varsler");
const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
if (vapid && vapid.length === 87) ok("NEXT_PUBLIC_VAPID_PUBLIC_KEY er satt");
else bad("NEXT_PUBLIC_VAPID_PUBLIC_KEY mangler eller er ugyldig", "Kjør npm run vapid (se docs/push-varsler.md)");
if (process.env.VAPID_PRIVATE_KEY && !process.env.NEXT_PUBLIC_VAPID_PRIVATE_KEY) ok("Privat VAPID-nøkkel er ikke eksponert til nettleseren");
if (process.env.NEXT_PUBLIC_VAPID_PRIVATE_KEY) bad("Den private VAPID-nøkkelen ligger i NEXT_PUBLIC_*!", "Fjern NEXT_PUBLIC_-prefikset");

const subs = await call("/rest/v1/push_subscriptions?select=id&limit=1");
if (subs.body?.code === "PGRST205" || subs.body?.code === "42P01")
  bad("Tabellen push_subscriptions finnes ikke", "Kjør 20261110090000_push_subscriptions.sql");
else if (subs.status === 200 && Array.isArray(subs.body) && subs.body.length) bad("Utloggede kan lese push-abonnementer!", "Sjekk RLS");
else ok("Push-abonnementer er satt opp (migrasjon 6) og skjult for utloggede");

const fn = await call("/functions/v1/send-push", { method: "POST", body: "{}" });
if (fn.status === 401 && fn.body?.error === "unauthorized") ok("Edge Function send-push er deployet (med Verify JWT av)");
else if (fn.status === 401) bad("send-push avviser kall før funksjonen kjører", "Slå av «Verify JWT» for funksjonen");
else if (fn.status === 404) bad("Edge Function send-push er ikke deployet", "Se docs/push-varsler.md, steg 3");
else bad(`Uventet svar fra send-push (${fn.status})`, JSON.stringify(fn.body));
warn("Sjekk manuelt: Database → Webhooks → push_notifications (INSERT+UPDATE på notifications, header x-flokk-secret)");

console.log("\nAuth");
const auth = await call("/auth/v1/settings");
if (auth.status !== 200) bad(`Får ikke lest auth-innstillinger (${auth.status})`);
else {
  const s = auth.body;
  if (s.external?.email) ok("E-post-innlogging er på");
  else bad("E-post-innlogging er av", "Authentication → Sign In / Providers → Email");
  if (s.disable_signup) bad("Nye registreringer er slått av", "Authentication → Sign In / Providers → Allow new users to sign up");
  else ok("Nye brukere kan registrere seg");
  if (s.mailer_autoconfirm) warn("«Confirm email» er av – greit i utvikling, bør være på i produksjon");
  if (s.password_min_length && s.password_min_length < 8)
    warn(`Minimum passordlengde i Supabase er ${s.password_min_length} – appen krever 8. Sett den til 8 under Sign In / Providers → Email.`);
}

console.log("\nManuelt (kan ikke sjekkes med publishable key)");
console.log(`  • Authentication → URL Configuration: Site URL = ${site ?? "http://localhost:3000"}`);
console.log(`  • Redirect URLs inneholder ${site ?? "http://localhost:3000"}/auth/callback** (med ** på slutten)`);
console.log("  • Database → Publications → supabase_realtime: messages, event_votes, event_tasks, event_time_options, notifications");
console.log("  • Egen SMTP før dere inviterer mange (innebygd e-post har lav grense per time)\n");

if (failed) {
  console.log(`${failed} problem(er) funnet.\n`);
  process.exit(1);
}
console.log("Alt ser bra ut! 🎉\n");
