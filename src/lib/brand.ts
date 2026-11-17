// Flokk-logoen som geometri, slik at nettappen, appikonene og de native appene
// tegnes fra samme kilde (scripts/generate-icons.mjs importerer denne filen).
//
// Merket er tre ringer inni hverandre som møtes på hver sin side, med sentrene på én linje
// mot øvre venstre. Ordmerket er FLOKK i smale, kraftige versaler.
// Mål tatt fra originallogoen; merket er sentrert i (0, 0).

/** Gullgradienten fra logoen, brukt per element (venstre → høyre). */
export const GOLD_STOPS: readonly (readonly [number, string])[] = [
  [0, "#9A6F35"],
  [0.28, "#C9A962"],
  [0.5, "#F3EBA0"],
  [0.72, "#C7AE6A"],
  [1, "#A67A43"],
];

/** Dypere gull for logoen på lys bakgrunn (samme som --logo-gold-N i globals.css). */
export const GOLD_STOPS_ON_LIGHT: readonly (readonly [number, string])[] = [
  [0, "#7D5A27"],
  [0.28, "#A6853F"],
  [0.5, "#C9AD5C"],
  [0.72, "#A6853F"],
  [1, "#85612F"],
];

/** Fargepaletten. */
export const PALETTE = {
  ink: "#0F0F0F",
  charcoal: "#292929",
  graphite: "#424242",
  gold: "#C7AE6A",
  goldLight: "#D5C28F",
  goldDeep: "#B99A45",
} as const;

const DIR = { x: -0.853, y: -0.521 }; // retningen sentrene ligger på
const R_OUTER = 170;
const R_MID = 107;
const R_INNER = 62;

export const MARK_STROKE = 15;
/** Ytterkant av merket (radius inkludert strek). */
export const MARK_EXTENT = R_OUTER + MARK_STROKE / 2;

/** Ringene i merket, fra ytterst til innerst. */
export const MARK_RINGS = [
  { cx: 0, cy: 0, r: R_OUTER },
  { cx: DIR.x * (R_OUTER - R_MID), cy: DIR.y * (R_OUTER - R_MID), r: R_MID },
  // Den minste ringen ligger litt lenger inn enn ren tangering, så den smelter sammen med den midterste
  { cx: DIR.x * 23, cy: DIR.y * 23, r: R_INNER },
].map((c) => ({ cx: round(c.cx), cy: round(c.cy), r: c.r }));

function round(v: number) {
  return Math.round(v * 100) / 100;
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

function k(x: number) {
  const p = (pts: number[][]) => "M" + pts.map(([px, py]) => `${x + px} ${py}`).join("L") + "Z";
  return p([[0, 0], [25, 0], [25, 48], [54, 0], [80, 0], [52, 55], [82, 142], [56, 142], [35, 82], [25, 98], [25, 142], [0, 142]]);
}

/**
 * Bokstavene i ordmerket (høyde 142, bredde 421), hver med sin bounding box
 * så gradienten kan legges per bokstav som i originalen.
 */
export const WORDMARK_HEIGHT = 142;
export const WORDMARK_WIDTH = 421;
export const WORDMARK_LETTERS: readonly { d: string; x: number; w: number; evenOdd?: boolean }[] = [
  { d: "M0 0H67V19H27V57H53V75H27V142H0Z", x: 0, w: 67 },
  { d: "M78 0H104V123H134V142H78Z", x: 78, w: 56 },
  { d: roundRect(155, 0, 73, 142, 26) + roundRect(180, 20, 23, 102, 10), x: 155, w: 73, evenOdd: true },
  { d: k(244), x: 244, w: 82 },
  { d: k(339), x: 339, w: 82 },
];

/** Avstand fra merkets senter til ordmerket, og ordmerkets vertikale plassering. */
export const LOCKUP = { wordmarkX: 258, wordmarkY: -WORDMARK_HEIGHT / 2 };
/** viewBox for merke + ordmerke ved siden av hverandre. */
export const LOCKUP_VIEWBOX = {
  x: -MARK_EXTENT,
  y: -MARK_EXTENT,
  w: LOCKUP.wordmarkX + WORDMARK_WIDTH + MARK_EXTENT,
  h: MARK_EXTENT * 2,
};

/** SVG-markup for merket (uten <svg>), med gradient-id `gid`. `weight` gjør strekene tykkere i små størrelser. */
export function markSvg({ gid = "flokk-gold", color, weight = 1 }: { gid?: string; color?: string; weight?: number } = {}) {
  const paint = color ?? `url(#${gid})`;
  return MARK_RINGS.map(
    (c) => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" fill="none" stroke="${paint}" stroke-width="${MARK_STROKE * weight}"/>`,
  ).join("");
}

/** SVG-markup for ordmerket (uten <svg>), plassert med origo øverst til venstre. */
export function wordmarkSvg({ gid = "flokk-gold", color }: { gid?: string; color?: string } = {}) {
  const paint = color ?? `url(#${gid})`;
  return WORDMARK_LETTERS.map(
    (l) => `<path d="${l.d}" fill="${paint}"${l.evenOdd ? ' fill-rule="evenodd"' : ""}/>`,
  ).join("");
}

/** <linearGradient> for gullet, i hvert elements egen bounding box. */
export function goldGradientSvg(gid = "flokk-gold", stops = GOLD_STOPS) {
  return `<linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">${stops.map(
    ([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`,
  ).join("")}</linearGradient>`;
}

/** Hele logoen (merke + ordmerke) som frittstående SVG. */
export function lockupSvg({ color, stops = GOLD_STOPS }: { color?: string; stops?: typeof GOLD_STOPS } = {}) {
  const v = LOCKUP_VIEWBOX;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}"><defs>${goldGradientSvg("flokk-gold", stops)}</defs>${markSvg({ color })}<g transform="translate(${LOCKUP.wordmarkX} ${LOCKUP.wordmarkY})">${wordmarkSvg({ color })}</g></svg>`;
}
