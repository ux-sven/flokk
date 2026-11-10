"use client";

import { useState, useTransition } from "react";
import { Popover } from "@base-ui/react/popover";
import { Palette } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { AppearancePicker, type Appearance } from "@/components/appearance-picker";
import { setGroupAppearance } from "@/app/[gruppe]/actions";

/** Lar admins bytte bakgrunn/farge på flokken. */
export function GroupAppearanceButton({
  groupId,
  slug,
  initial,
}: {
  groupId: string;
  slug: string;
  initial: Appearance;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: Appearance) {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await setGroupAppearance(groupId, slug, next.tint, next.backdrop);
      if (res?.error) {
        setValue(prev);
        setError(res.error);
      }
    });
  }

  return (
    <Popover.Root>
      <Popover.Trigger className={buttonVariants({ variant: "secondary", size: "lg" })} aria-label="Endre utseende">
        <Palette /> <span className="hidden sm:inline">Utseende</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="max-h-[min(36rem,var(--available-height))] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto origin-[var(--transform-origin)] space-y-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title className="font-semibold">Utseende</Popover.Title>
            <AppearancePicker value={value} onChange={change} disabled={pending} />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
