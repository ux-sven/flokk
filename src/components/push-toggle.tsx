"use client";

import { useEffect, useMemo, useState } from "react";
import { BellOff, BellRing, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type PushState = "checking" | "unsupported" | "install" | "missing-key" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function initialState(): PushState {
  if (typeof window === "undefined") return "checking";
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // På iPhone/iPad finnes push bare når Flokk er lagt til på hjemskjermen
  if (isIOS && !standalone) return "install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window))
    return "unsupported";
  if (!vapidKey) return "missing-key";
  if (Notification.permission === "denied") return "denied";
  return "checking";
}

export async function registerServiceWorker() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

/** Lagrer abonnementet på innlogget bruker (overtar enheten hvis den var registrert på en annen). */
async function saveSubscription(supabase: ReturnType<typeof createClient>, sub: PushSubscription) {
  const json = sub.toJSON();
  const { error } = await supabase.rpc("register_push_subscription", {
    sub_endpoint: sub.endpoint,
    sub_p256dh: json.keys?.p256dh ?? "",
    sub_auth: json.keys?.auth ?? "",
    sub_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

/** Slå push-varsler av og på for denne enheten. */
export function PushToggle() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<PushState>(initialState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testInfo, setTestInfo] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "checking") return;
    let cancelled = false;
    (async () => {
      const reg = await registerServiceWorker();
      const sub = await reg.pushManager.getSubscription();
      if (sub) await saveSubscription(supabase, sub); // knytter enheten til den som er innlogget nå
      if (!cancelled) setState(sub ? "on" : "off");
    })().catch(() => !cancelled && setState("off"));
    return () => {
      cancelled = true;
    };
  }, [state, supabase]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registerServiceWorker();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));
      await saveSubscription(supabase, sub);
      setState("on");
    } catch (e) {
      console.error("[push]", e);
      setError("Kunne ikke slå på varsler. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (e) {
      console.error("[push]", e);
      setError("Kunne ikke slå av varsler.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError(null);
    setTestInfo(null);
    const { data, error } = await supabase.functions.invoke<{ sent: number }>("send-push", { body: { test: true } });
    setBusy(false);
    if (error || !data) setError("Testvarselet kunne ikke sendes. Er Edge Function «send-push» satt opp?");
    else setTestInfo(data.sent ? "Testvarsel sendt!" : "Fant ingen aktive enheter. Slå varsler av og på igjen.");
  }

  if (state === "checking" || state === "unsupported" || state === "missing-key") return null;

  return (
    <div className="space-y-2 border-t px-4 py-3 text-sm">
      {state === "install" && (
        <p className="flex gap-2 text-muted-foreground">
          <Smartphone className="mt-0.5 size-4 shrink-0" />
          <span>
            Vil du ha varsler på iPhone? Trykk på <Share className="inline size-3.5" aria-label="Del" /> og velg
            «Legg til på Hjem-skjerm», og åpne Flokk derfra.
          </span>
        </p>
      )}
      {state === "denied" && (
        <p className="flex gap-2 text-muted-foreground">
          <BellOff className="mt-0.5 size-4 shrink-0" />
          Varsler er blokkert for Flokk. Tillat dem i nettleser- eller telefoninnstillingene.
        </p>
      )}
      {state === "off" && (
        <Button size="lg" className="w-full" onClick={enable} disabled={busy}>
          <BellRing /> Få varsler på denne enheten
        </Button>
      )}
      {state === "on" && (
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-muted-foreground">
            <BellRing className="size-4 text-emerald-600" /> Varsler er på for denne enheten
          </span>
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={sendTest} disabled={busy}>
              Test
            </Button>
            <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
              Slå av
            </Button>
          </span>
        </div>
      )}
      {testInfo && <p className="text-muted-foreground">{testInfo}</p>}
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}
