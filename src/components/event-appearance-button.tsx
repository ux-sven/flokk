"use client";

import { useState, useTransition } from "react";
import { BackdropPicker } from "@/components/appearance-picker";
import { AppearancePopover } from "@/components/appearance-popover";
import { setEventBackdrop } from "@/app/[gruppe]/actions";
import type { Backdrop } from "@/lib/tints";

/** Lar arrangøren/admins velge egen bakgrunn for arrangementet. */
export function EventAppearanceButton({
  slug,
  eventId,
  initial,
  groupSurfaceClass,
}: {
  slug: string;
  eventId: string;
  initial: Backdrop | null;
  groupSurfaceClass: string;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function change(next: Backdrop | null) {
    const prev = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const res = await setEventBackdrop(slug, eventId, next);
      if (res?.error) {
        setValue(prev);
        setError(res.error);
      }
    });
  }

  return (
    <AppearancePopover error={error} variant="outline">
      <BackdropPicker
        value={value}
        onChange={change}
        disabled={pending}
        inherit={{ label: "Som flokken", className: groupSurfaceClass }}
      />
    </AppearancePopover>
  );
}
