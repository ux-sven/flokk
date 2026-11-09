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
