export const TINTS = ["mint", "lime", "sky", "lilac", "mauve", "peach"] as const;
export type Tint = (typeof TINTS)[number];

// Fulle klassenavn slik at Tailwind finner dem
export const tintBg: Record<Tint, string> = {
  lime: "bg-tint-lime",
  mint: "bg-tint-mint",
  sky: "bg-tint-sky",
  lilac: "bg-tint-lilac",
  mauve: "bg-tint-mauve",
  peach: "bg-tint-peach",
};

export const tintLabel: Record<Tint, string> = {
  lime: "Lime",
  mint: "Mint",
  sky: "Himmel",
  lilac: "Syrin",
  mauve: "Lyng",
  peach: "Fersken",
};

export function asTint(value: string | null | undefined): Tint {
  return (TINTS as readonly string[]).includes(value ?? "") ? (value as Tint) : "mint";
}

// Bakgrunnsbilder (public/backdrops/<navn>.svg, klasser i globals.css).
// Ny bakgrunn: legg til SVG-fil, en linje her, en klasse i globals.css og verdien i migrasjonen.
export const BACKDROP_GROUPS = [
  { label: "Årstider", items: [["var", "Vår"], ["sommer", "Sommer"], ["host", "Høst"], ["vinter", "Vinter"]] },
  { label: "Sport", items: [["fotball", "Fotball"], ["ski", "Ski"], ["sykkel", "Sykkel"]] },
  { label: "Musikk", items: [["noter", "Noter"], ["piano", "Piano"], ["lydbolger", "Lydbølger"]] },
  { label: "Mat og drikke", items: [["kaffe", "Kaffe"], ["sitrus", "Sitrus"], ["urter", "Urter"]] },
  { label: "Aktiviteter", items: [["friluftsliv", "Friluftsliv"], ["boker", "Bøker"], ["reise", "Reise"]] },
] as const;

export type Backdrop = (typeof BACKDROP_GROUPS)[number]["items"][number][0];
export const BACKDROPS: readonly Backdrop[] = BACKDROP_GROUPS.flatMap((g) => g.items.map(([k]) => k));

export const backdropLabel = Object.fromEntries(
  BACKDROP_GROUPS.flatMap((g) => g.items.map(([k, l]) => [k, l])),
) as Record<Backdrop, string>;

// Fulle klassenavn slik at Tailwind/CSS finner dem
export const backdropClass = Object.fromEntries(BACKDROPS.map((b) => [b, `backdrop backdrop-${b}`])) as Record<
  Backdrop,
  string
>;

export function asBackdrop(value: string | null | undefined): Backdrop | null {
  return (BACKDROPS as readonly string[]).includes(value ?? "") ? (value as Backdrop) : null;
}

/** Klassene for flokkens flate: bakgrunnsbilde hvis valgt, ellers fargen. */
export function groupSurface(g: { tint?: string | null; backdrop?: string | null } | null | undefined): string {
  const b = asBackdrop(g?.backdrop);
  return b ? backdropClass[b] : tintBg[asTint(g?.tint)];
}

/** Arrangementets flate: egen bakgrunn hvis valgt, ellers flokkens utseende. */
export function eventSurface(
  e: { backdrop?: string | null } | null | undefined,
  g: { tint?: string | null; backdrop?: string | null } | null | undefined,
): string {
  const b = asBackdrop(e?.backdrop);
  return b ? backdropClass[b] : groupSurface(g);
}
