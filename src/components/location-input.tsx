"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, Mountain } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchPlaces, type Place } from "@/lib/places";
import { cn } from "@/lib/utils";

/**
 * Stedsfelt: fritekst, med forslag til adresser og stedsnavn fra Kartverket.
 * Velges et forslag, sendes koordinatene med (location_lat / location_lng).
 * Endres teksten etterpå, blir det fritekst igjen.
 */
export function LocationInput({
  id = "location",
  name = "location",
  defaultValue = "",
  placeholder = "Hos Kari, eller søk etter adresse",
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  placeholder?: string;
}) {
  const listId = useId();
  const [text, setText] = useState(defaultValue);
  const [picked, setPicked] = useState<Place | null>(null);
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const query = picked ? "" : text.trim();

  useEffect(() => {
    if (query.length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchPlaces(query, ctrl.signal);
        setResults(found);
        setActive(-1);
      } catch {
        /* avbrutt */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const visible = open && query.length >= 3 && results.length > 0;

  function choose(p: Place) {
    setPicked(p);
    setText(p.label);
    setOpen(false);
    setResults([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!visible) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault(); // ikke send skjemaet
      choose(results[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        className="h-10 pr-9"
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={visible}
        aria-controls={listId}
        aria-activedescendant={visible && active >= 0 ? `${listId}-${active}` : undefined}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPicked(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => (blurTimer.current = setTimeout(() => setOpen(false), 120))}
        onKeyDown={onKeyDown}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
        {loading && query.length >= 3 ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <MapPin className={cn("size-4", picked && "text-emerald-600")} />
        )}
      </span>
      <input type="hidden" name="location_lat" value={picked ? String(picked.lat) : ""} />
      <input type="hidden" name="location_lng" value={picked ? String(picked.lng) : ""} />

      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
          onMouseDown={(e) => e.preventDefault()} // behold fokus i feltet
        >
          {results.map((p, i) => {
            const Icon = p.kind === "address" ? MapPin : Mountain;
            return (
              <li
                key={`${p.label}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onClick={() => choose(p)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex cursor-pointer gap-2 rounded-lg px-3 py-2 text-sm", i === active && "bg-muted")}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate">{p.label}</span>
                  <span className="block text-xs text-muted-foreground">{p.detail}</span>
                </span>
              </li>
            );
          })}
          <li className="px-3 pt-1 pb-1.5 text-[11px] text-muted-foreground">
            Søk fra Kartverket · eller behold teksten du har skrevet
          </li>
        </ul>
      )}
      {picked && (
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
          Stedet får en kartlenke til Google Maps.
        </p>
      )}
    </div>
  );
}
