"use client";

import { Check } from "lucide-react";
import { BACKDROP_GROUPS, TINTS, backdropClass, tintBg, tintLabel, type Backdrop, type Tint } from "@/lib/tints";
import { cn } from "@/lib/utils";

export type Appearance = { tint: Tint; backdrop: Backdrop | null };

/** Velg bakgrunnsbilde eller ensfarget flate for flokken. */
export function AppearancePicker({
  value,
  onChange,
  disabled,
}: {
  value: Appearance;
  onChange: (next: Appearance) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      {BACKDROP_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {group.items.map(([b, label]) => {
              const selected = value.backdrop === b;
              return (
                <button
                  key={b}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, backdrop: b as Backdrop })}
                  aria-pressed={selected}
                  className={cn(
                    "relative flex h-14 items-end rounded-xl border p-2 text-left text-xs font-semibold ring-offset-2 ring-offset-background transition disabled:opacity-60",
                    backdropClass[b as Backdrop],
                    selected ? "ring-2 ring-primary" : "hover:brightness-95",
                  )}
                >
                  {label}
                  {selected && (
                    <Check className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary p-0.5 text-primary-foreground" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Eller en farge</p>
        <div className="flex flex-wrap gap-2">
          {TINTS.map((t) => {
            const selected = !value.backdrop && value.tint === t;
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ tint: t, backdrop: null })}
                aria-pressed={selected}
                aria-label={tintLabel[t]}
                title={tintLabel[t]}
                className={cn(
                  "size-10 rounded-full ring-offset-2 ring-offset-background transition disabled:opacity-60",
                  tintBg[t],
                  selected && "ring-2 ring-primary",
                )}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
