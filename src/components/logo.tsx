import { useId } from "react";
import {
  GOLD_STOPS,
  LOCKUP,
  LOCKUP_VIEWBOX,
  MARK_EXTENT,
  MARK_RINGS,
  MARK_STROKE,
  WORDMARK_LETTERS,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

function Gold({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      {/* --logo-gold-N (globals.css) gir dypere gull på lys bakgrunn */}
      {GOLD_STOPS.map(([o, c], i) => (
        <stop key={o} offset={o} style={{ stopColor: `var(--logo-gold-${i}, ${c})` }} />
      ))}
    </linearGradient>
  );
}

function Rings({ paint }: { paint: string }) {
  return MARK_RINGS.map((c, i) => (
    <circle key={i} cx={c.cx} cy={c.cy} r={c.r} fill="none" stroke={paint} strokeWidth={MARK_STROKE} />
  ));
}

/** Logomerket (tre gullringer). */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox={`${-MARK_EXTENT} ${-MARK_EXTENT} ${MARK_EXTENT * 2} ${MARK_EXTENT * 2}`}
      className={cn("size-8", className)}
      aria-hidden
    >
      <defs>
        <Gold id={id} />
      </defs>
      <Rings paint={`url(#${id})`} />
    </svg>
  );
}

/** Hele logoen: merke og ordmerket FLOKK. */
export function Logo({ className }: { className?: string }) {
  const id = useId();
  const v = LOCKUP_VIEWBOX;
  return (
    <svg viewBox={`${v.x} ${v.y} ${v.w} ${v.h}`} className={cn("h-8 w-auto", className)} role="img" aria-label="Flokk">
      <defs>
        <Gold id={id} />
      </defs>
      <Rings paint={`url(#${id})`} />
      <g transform={`translate(${LOCKUP.wordmarkX} ${LOCKUP.wordmarkY})`}>
        {WORDMARK_LETTERS.map((l, i) => (
          <path key={i} d={l.d} fill={`url(#${id})`} fillRule={l.evenOdd ? "evenodd" : undefined} />
        ))}
      </g>
    </svg>
  );
}
