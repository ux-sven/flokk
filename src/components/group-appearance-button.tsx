"use client";

import { useState, useTransition } from "react";
import { AppearancePicker, type Appearance } from "@/components/appearance-picker";
import { AppearancePopover } from "@/components/appearance-popover";
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
    <AppearancePopover error={error} iconOnly>
      <AppearancePicker value={value} onChange={change} disabled={pending} />
    </AppearancePopover>
  );
}
