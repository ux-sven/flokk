"use client";

import { Check } from "lucide-react";
import { BACKDROP_GROUPS, TINTS, backdropClass, tintBg, tintLabel, type Backdrop, type Tint } from "@/lib/tints";
import { cn } from "@/lib/utils";

export type Appearance = { tint: Tint; backdrop: Backdrop | null };

const tileClass =
  "relative flex h-14 items-end rounded-xl border p-2 text-left text-xs font-semibold ring-offset-2 ring-offset-background transition disabled:opacity-60";

function Selected() {
  return <Check className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary p-0.5 text-primary-foreground" />;
}

/**
 * Bakgrunnsbilder gruppert etter tema. Med «inherit» vises først en flis for
 * «ingen egen bakgrunn» (value = null), f.eks. «Som flokken».
 */
export function BackdropPicker({
  value,
  onChange,
  disabled,
  inherit,
}: {
  value: Backdrop | null;
  onChange: (next: Backdrop | null) => void;
  disabled?: boolean;
  inherit?: { label: string; className: string };
}) {
  return (
    <div className="space-y-4">
      {inherit && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-pressed={value === null}
            className={cn(tileClass, inherit.className, value === null ? "ring-2 ring-primary" : "hover:brightness-95")}
          >
            {inherit.label}
            {value === null && <Selected />}
          </button>
        </div>
      )}
      {BACKDROP_GROUPS.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {group.items.map(([b, label]) => {
              const selected = value === b;
              return (
                <button
                  key={b}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(b)}
                  aria-pressed={selected}
                  className={cn(tileClass, backdropClass[b], selected ? "ring-2 ring-primary" : "hover:brightness-95")}
                >
                  {label}
                  {selected && <Selected />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

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
      <BackdropPicker
        value={value.backdrop}
        onChange={(backdrop) => onChange({ ...value, backdrop })}
        disabled={disabled}
      />
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
