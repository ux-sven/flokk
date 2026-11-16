// Lager app-ikonene for web, iOS og Android fra én tegning (F + limegrønn prikk).
// Kjør:  node scripts/generate-icons.mjs
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

export const COLORS = { background: "#111011", letter: "#F8F8F8", dot: "#BEEA56" };

// Tegningen i et 1024×1024-rutenett, målt fra originalbildet
const F = [
  { x: 319, y: 239, w: 330, h: 108 }, // toppstrek
  { x: 319, y: 239, w: 119, h: 466 }, // stamme
  { x: 319, y: 427, w: 256, h: 102 }, // midtstrek
];
const DOT = { cx: 660, cy: 646, r: 60 };
const R = 10; // litt avrunding på hjørnene, som i originalen

function glyph({ letter = COLORS.letter, dot = COLORS.dot } = {}) {
  return [
    ...F.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${R}" fill="${letter}"/>`),
    `<circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="${dot}"/>`,
  ].join("");
}

function svg({ radius = 0, scale = 1, background = COLORS.background, letter, dot } = {}) {
  // Skalerer tegningen rundt midten (for maskerbare ikoner med sikker sone)
  const t = scale === 1 ? "" : ` transform="translate(512 512) scale(${scale}) translate(-512 -512)"`;
  const bg = background ? `<rect width="1024" height="1024" rx="${radius}" fill="${background}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${bg}<g${t}>${glyph({ letter, dot })}</g></svg>`;
}

async function png(file, size, opts) {
  let img = sharp(Buffer.from(svg(opts))).resize(size, size);
  if (opts?.background !== null) img = img.flatten({ background: COLORS.background });
  await img.png().toFile(file);
  console.log("✓", file);
}

// Web
await writeFile("public/icons/icon.svg", svg({ radius: 224 }));
console.log("✓ public/icons/icon.svg");
await png("public/icons/icon-192.png", 192);
await png("public/icons/icon-512.png", 512);
await png("public/icons/maskable-512.png", 512, { scale: 0.85 });
await png("public/icons/apple-touch-icon.png", 180);
// Merke i statuslinjen for web-push: hvit silhuett på gjennomsiktig bakgrunn
await png("public/icons/badge-96.png", 96, { background: null, letter: "#FFFFFF", dot: "#FFFFFF", scale: 1.6 });

// iOS (én 1024-versjon; uten gjennomsiktighet)
await png("ios/Flokk/Assets.xcassets/AppIcon.appiconset/AppIcon.png", 1024);
await writeFile(
  "ios/Flokk/Assets.xcassets/AppIcon.appiconset/Contents.json",
  JSON.stringify(
    {
      images: [{ filename: "AppIcon.png", idiom: "universal", platform: "ios", size: "1024x1024" }],
      info: { author: "xcode", version: 1 },
    },
    null,
    2,
  ) + "\n",
);

// Android: vektor i 108dp-rutenettet der 72dp er synlig. Tegningen får samme
// andel av den synlige flaten som på iOS.
const k = 72 / 1024;
const o = 18; // (108 − 72) / 2
const n = (v) => +(v * k).toFixed(2);
const rr = n(R);
const rect = (b) => {
  const x = n(b.x) + o, y = n(b.y) + o, w = n(b.w), h = n(b.h);
  return `M${x + rr},${y}h${+(w - 2 * rr).toFixed(2)}a${rr},${rr} 0,0 1,${rr},${rr}v${+(h - 2 * rr).toFixed(2)}a${rr},${rr} 0,0 1,-${rr},${rr}h-${+(w - 2 * rr).toFixed(2)}a${rr},${rr} 0,0 1,-${rr},-${rr}v-${+(h - 2 * rr).toFixed(2)}a${rr},${rr} 0,0 1,${rr},-${rr}z`;
};
const cx = n(DOT.cx) + o, cy = n(DOT.cy) + o, r = n(DOT.r);
const circle = `M${cx - r},${cy}a${r},${r} 0,1 0,${2 * r},0a${r},${r} 0,1 0,-${2 * r},0z`;
const vector = (letter, dot) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Generert av scripts/generate-icons.mjs -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
${F.map((b) => `    <path android:fillColor="${letter}" android:pathData="${rect(b)}" />`).join("\n")}
    <path android:fillColor="${dot}" android:pathData="${circle}" />
</vector>
`;
await writeFile("android/app/src/main/res/drawable/ic_launcher_foreground.xml", vector(COLORS.letter, COLORS.dot));
await writeFile("android/app/src/main/res/drawable/ic_launcher_monochrome.xml", vector("#FFFFFF", "#FFFFFF"));
console.log("✓ android/app/src/main/res/drawable/ic_launcher_{foreground,monochrome}.xml");

// favicon.ico for eldre nettlesere: ICO-fil med innebygde PNG-er (16, 32 og 48 px)
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((s) => sharp(Buffer.from(svg({ radius: 224 }))).resize(s, s).png().toBuffer()),
);
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(s, e);
  header.writeUInt8(s, e + 1);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
await writeFile("src/app/favicon.ico", Buffer.concat([header, ...pngs]));
console.log("✓ src/app/favicon.ico");
