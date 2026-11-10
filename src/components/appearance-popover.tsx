"use client";

import type { ReactNode } from "react";
import { Popover } from "@base-ui/react/popover";
import { Palette } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

/** Knappen «Utseende» med en nedtrekksflate for bakgrunnsvalg. */
export function AppearancePopover({
  children,
  error,
  variant = "secondary",
}: {
  children: ReactNode;
  error?: string | null;
  variant?: "secondary" | "outline";
}) {
  return (
    <Popover.Root>
      <Popover.Trigger className={buttonVariants({ variant, size: "lg" })} aria-label="Endre utseende">
        <Palette /> <span className="hidden sm:inline">Utseende</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="max-h-[min(36rem,var(--available-height))] w-[min(28rem,calc(100vw-2rem))] origin-[var(--transform-origin)] space-y-3 overflow-y-auto rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg outline-none transition-[scale,opacity] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <Popover.Title className="font-semibold">Utseende</Popover.Title>
            {children}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
