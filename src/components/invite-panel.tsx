"use client";

import { useState } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createInviteLink } from "@/app/[gruppe]/actions";

type CopyState = "idle" | "copied" | "failed";

/**
 * Kopierer tekst til utklippstavlen. Lenken lages på serveren først, og Safari
 * godtar bare kopiering i selve klikket – derfor sendes et løfte inn i
 * ClipboardItem synkront, med writeText som reserve for andre nettlesere.
 */
async function copyPromised(text: Promise<string>): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) }),
      ]);
      return true;
    }
  } catch {
    // prøv writeText under
  }
  try {
    await navigator.clipboard.writeText(await text);
    return true;
  } catch {
    return false;
  }
}

export function InvitePanel({ groupId, slug }: { groupId: string; slug: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copy, setCopy] = useState<CopyState>("idle");

  function flash(ok: boolean) {
    setCopy(ok ? "copied" : "failed");
    if (ok) setTimeout(() => setCopy((c) => (c === "copied" ? "idle" : c)), 4000);
  }

  function create() {
    setPending(true);
    setError(null);
    setCopy("idle");
    const link = createInviteLink(groupId, slug).then((res) => {
      if ("token" in res && res.token) return new URL(`/invitasjon/${res.token}`, window.location.origin).toString();
      throw new Error(res.error ?? "Noe gikk galt.");
    });
    // Kopieringen må startes i klikket, før lenken er ferdig laget
    const copied = copyPromised(link);
    link
      .then(async (u) => {
        setUrl(u);
        flash(await copied);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setPending(false));
  }

  async function copyAgain() {
    if (!url) return;
    flash(await copyPromised(Promise.resolve(url)));
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" size="lg" className="w-full" disabled={pending} onClick={create}>
        <UserPlus /> {pending ? "Lager lenke …" : url ? "Lag ny invitasjonslenke" : "Lag invitasjonslenke"}
      </Button>
      {url && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Invitasjonslenke" />
            <Button type="button" variant="outline" onClick={copyAgain} aria-label="Kopier lenken">
              {copy === "copied" ? <Check /> : <Copy />}
            </Button>
          </div>
          <p role="status" aria-live="polite" className="text-xs">
            {copy === "copied" ? (
              <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" /> Lenken er kopiert – lim den inn der du vil dele den.
              </span>
            ) : copy === "failed" ? (
              <span className="text-muted-foreground">Kunne ikke kopiere automatisk. Marker lenken og kopier den selv.</span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">Gyldig i 14 dager. Del den med dem du vil invitere.</p>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
