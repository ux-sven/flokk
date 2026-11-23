"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Ellipsis, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { REPORT_REASONS, type ReportReason } from "@/lib/moderation";
import { cn } from "@/lib/utils";

type Props = {
  groupId: string;
  /** Brukeren menyen gjelder */
  userId: string;
  name: string;
  /** Satt når menyen hører til en melding: da kan meldingen rapporteres */
  messageId?: string;
  /** Kalles etter blokkering, så visningen kan skjule brukeren med en gang */
  onBlocked?: (userId: string) => void;
  className?: string;
};

/** «⋯»-meny for å rapportere en melding eller bruker, eller blokkere brukeren. */
export function SafetyMenu({ groupId, userId, name, messageId, onBlocked, className }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [open]);

  async function block() {
    setOpen(false);
    if (!confirm(`Blokkere ${name}? Du ser ikke lenger meldingene til ${name} og får ikke varsler om det ${name} gjør. ${name} får ikke vite det.`))
      return;
    const { error } = await supabase.from("user_blocks").insert({ blocked_id: userId });
    if (error && error.code !== "23505") {
      setNotice("Kunne ikke blokkere. Prøv igjen.");
      return;
    }
    setNotice(`${name} er blokkert. Du kan oppheve det under Min profil.`);
    onBlocked?.(userId);
    // Henter siden på nytt, så meldinger og varsler fra brukeren forsvinner overalt
    router.refresh();
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Flere valg for ${name}`}
        aria-expanded={open}
        className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Ellipsis className="size-4" />
      </button>
      {open && (
        <div role="menu" className="absolute top-8 right-0 z-20 w-56 overflow-hidden rounded-2xl bg-popover py-1 text-sm shadow-card-hover">
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              setReporting(true);
            }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-muted"
          >
            <Flag className="size-4" /> {messageId ? "Rapporter meldingen" : `Rapporter ${name}`}
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={block}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-destructive hover:bg-muted"
          >
            <Ban className="size-4" /> Blokker {name}
          </button>
        </div>
      )}
      {reporting && (
        <ReportDialog
          groupId={groupId}
          target={messageId ?? userId}
          kind={messageId ? "message" : "user"}
          name={name}
          onClose={(sent) => {
            setReporting(false);
            if (sent) setNotice("Takk! Rapporten er sendt, og vi ser på den innen et døgn.");
          }}
        />
      )}
      {notice && (
        <p role="status" className="absolute top-8 right-0 z-20 w-64 rounded-2xl bg-popover p-3 text-xs shadow-card-hover">
          {notice}{" "}
          <button type="button" className="underline" onClick={() => setNotice(null)}>
            OK
          </button>
        </p>
      )}
    </div>
  );
}

function ReportDialog({
  groupId,
  target,
  kind,
  name,
  onClose,
}: {
  groupId: string;
  target: string;
  kind: "message" | "user";
  name: string;
  onClose: (sent: boolean) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason>("inappropriate");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => ref.current?.showModal(), []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.rpc("report_content", {
      report_kind: kind,
      target,
      gid: groupId,
      report_reason: reason,
      report_details: details.trim() || null,
    });
    setBusy(false);
    if (error) setError("Kunne ikke sende rapporten. Prøv igjen.");
    else onClose(true);
  }

  return (
    <dialog
      ref={ref}
      onClose={() => onClose(false)}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-3xl bg-card p-0 text-card-foreground shadow-card-hover backdrop:bg-black/40"
    >
      <form onSubmit={send} className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{kind === "message" ? "Rapporter meldingen" : `Rapporter ${name}`}</h2>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm text-muted-foreground">Hva er galt?</legend>
          {(Object.entries(REPORT_REASONS) as [ReportReason, string][]).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={() => setReason(value)}
                className="accent-gold-deep"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Fortell gjerne mer (valgfritt)"
          className="w-full rounded-2xl bg-muted px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Rapporten går til Flokk, ikke til {name}. Vil du slippe å se mer fra {name}, kan du også blokkere.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => ref.current?.close()}>
            Avbryt
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Sender …" : "Send rapport"}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
