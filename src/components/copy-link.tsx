"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Diskret, rund ikonknapp som ligger oppå bakgrunnsbilder (header). */
export const iconButtonClass =
  "inline-flex size-9 items-center justify-center rounded-full bg-background/55 text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background/85 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4";

export function CopyLink({
  path,
  label = "Kopier lenke",
  iconOnly = false,
}: {
  path: string;
  label?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Lenken er kopiert" : label}
        title={copied ? "Kopiert!" : label}
        className={cn(iconButtonClass, copied && "text-emerald-600 dark:text-emerald-400")}
      >
        {copied ? <Check /> : <Link2 />}
        <span className="sr-only" role="status">
          {copied ? "Lenken er kopiert" : ""}
        </span>
      </button>
    );
  }

  return (
    <Button type="button" variant="outline" size="lg" onClick={copy}>
      {copied ? <Check /> : <Link2 />}
      {copied ? "Kopiert!" : label}
    </Button>
  );
}
