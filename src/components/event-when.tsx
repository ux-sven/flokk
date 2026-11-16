import { CalendarCheck, Vote } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Statuslinje på arrangementskort: dato når tidspunktet er valgt, ellers
 * «Stemming pågår» i gult. Grønt er forbeholdt «inne nå» og bekreftelser.
 */
export function EventWhen({
  startsAt,
  suggestions,
  className,
}: {
  startsAt: string | null | undefined;
  suggestions?: number;
  className?: string;
}) {
  if (startsAt) {
    return (
      <p className={cn("flex items-center gap-1.5 text-xs font-semibold", className)}>
        <CalendarCheck className="size-3.5 shrink-0" aria-hidden />
        {formatDateTime(startsAt)}
      </p>
    );
  }
  return (
    <p className={cn("flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400", className)}>
      <Vote className="size-3.5 shrink-0" aria-hidden />
      Stemming pågår{suggestions != null ? ` · ${suggestions} forslag` : ""}
    </p>
  );
}
