// Lager appikoner og logofiler for web, iOS og Android fra logogeometrien i src/lib/brand.ts
// (tre gullringer på mørk bakgrunn).
// Kjør:  npm run icons
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import {
  GOLD_STOPS,
  GOLD_STOPS_ON_LIGHT,
  LOCKUP,
  LOCKUP_VIEWBOX,
  MARK_EXTENT,
  MARK_RINGS,
  MARK_STROKE,
  WORDMARK_LETTERS,
  goldGradientSvg,
  lockupSvg,
  markSvg,
} from "../src/lib/brand.ts";

// Bakgrunnen i ikonet: mørk grafitt som i logoen, litt lysere oppe til høyre
const BG = { from: "#1E1E1E", to: "#424242", solid: "#292929" };
// Merkets radius som andel av ikonets halve bredde
const MARK_SIZE = 0.62;

function iconSvg({ radius = 0, scale = 1, background = true, color, weight = 1 } = {}) {
  const s = ((512 * MARK_SIZE) / MARK_EXTENT) * scale;
  const bg = background
    ? `<linearGradient id="bg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${BG.from}"/><stop offset="1" stop-color="${BG.to}"/></linearGradient>` +
      `</defs><rect width="1024" height="1024" rx="${radius}" fill="url(#bg)"/>`
    : "</defs>";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${goldGradientSvg()}${bg}<g transform="translate(512 512) scale(${s.toFixed(4)})">${markSvg({ color, weight })}</g></svg>`;
}

async function png(file, size, opts) {
  let img = sharp(Buffer.from(iconSvg(opts))).resize(size, size);
  if (opts?.background !== false) img = img.flatten({ background: BG.solid });
  await img.png().toFile(file);
  console.log("✓", file);
}

// ---------------------------------------------------------------------------
// Web
await writeFile("public/icons/icon.svg", iconSvg({ radius: 224 }));
console.log("✓ public/icons/icon.svg");
await png("public/icons/icon-192.png", 192);
await png("public/icons/icon-512.png", 512);
await png("public/icons/maskable-512.png", 512, { scale: 0.85 });
await png("public/icons/apple-touch-icon.png", 180);
// Merke i statuslinjen for web-push: hvit silhuett på gjennomsiktig bakgrunn
await png("public/icons/badge-96.png", 96, { background: false, color: "#FFFFFF", scale: 1.5, weight: 1.8 });

// Logofiler (til e-post, presentasjoner o.l.)
await mkdir("public/brand", { recursive: true });
await writeFile("public/brand/flokk-logo.svg", lockupSvg());
await writeFile(
  "public/brand/flokk-mark.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-MARK_EXTENT} ${-MARK_EXTENT} ${MARK_EXTENT * 2} ${MARK_EXTENT * 2}"><defs>${goldGradientSvg()}</defs>${markSvg()}</svg>`,
);
console.log("✓ public/brand/flokk-{logo,mark}.svg");

// ---------------------------------------------------------------------------
// iOS: appikon (én 1024-versjon, uten gjennomsiktighet) og logoen til innloggingen
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
const logoSet = "ios/Flokk/Assets.xcassets/Logo.imageset";
await mkdir(logoSet, { recursive: true });
// 240 pt bred ved 3x; dypere gull i lys modus, originalgradienten i mørk
await sharp(Buffer.from(lockupSvg({ stops: GOLD_STOPS_ON_LIGHT }))).resize({ width: 720 }).png().toFile(`${logoSet}/Logo@3x.png`);
await sharp(Buffer.from(lockupSvg())).resize({ width: 720 }).png().toFile(`${logoSet}/LogoDark@3x.png`);
const dark = [{ appearance: "luminosity", value: "dark" }];
await writeFile(
  `${logoSet}/Contents.json`,
  JSON.stringify(
    {
      images: [
        { idiom: "universal", scale: "1x" },
        { idiom: "universal", scale: "2x" },
        { filename: "Logo@3x.png", idiom: "universal", scale: "3x" },
        { appearances: dark, idiom: "universal", scale: "1x" },
        { appearances: dark, idiom: "universal", scale: "2x" },
        { appearances: dark, filename: "LogoDark@3x.png", idiom: "universal", scale: "3x" },
      ],
      info: { author: "xcode", version: 1 },
    },
    null,
    2,
  ) + "\n",
);
console.log(`✓ ${logoSet}/Logo@3x.png`);

// ---------------------------------------------------------------------------
// Android: vektorer. Gradientene i VectorDrawable er i stiens egne koordinater,
// så hvert element får gradienten over sin egen bredde (som i SVG-en).
const f = (v) => +v.toFixed(2);
const ringPath = (cx, cy, r) => `M${f(cx - r)},${f(cy)}a${r},${r} 0,1 0,${2 * r},0a${r},${r} 0,1 0,${-2 * r},0z`;
const gradient = (attr, x0, x1, stops = GOLD_STOPS) => `
        <aapt:attr name="android:${attr}">
            <gradient android:type="linear" android:startX="${f(x0)}" android:startY="0" android:endX="${f(x1)}" android:endY="0">
${stops.map(([o, c]) => `                <item android:offset="${o}" android:color="${c}" />`).join("\n")}
            </gradient>
        </aapt:attr>`;

/** Ringene som <path>-elementer i et koordinatsystem med merkets senter i (cx, cy) og skala s. */
function ringsXml({ cx, cy, s, color, weight = 1, stops }) {
  return MARK_RINGS.map((c) => {
    const x = cx + c.cx * s, y = cy + c.cy * s, r = f(c.r * s), w = f(MARK_STROKE * s * weight);
    const d = ringPath(x, y, r);
    return color
      ? `    <path android:pathData="${d}" android:strokeColor="${color}" android:strokeWidth="${w}" />`
      : `    <path android:pathData="${d}" android:strokeWidth="${w}">${gradient("strokeColor", x - r - w / 2, x + r + w / 2, stops)}
    </path>`;
  }).join("\n");
}

const vectorHeader = (w, h, vw, vh) => `<?xml version="1.0" encoding="utf-8"?>
<!-- Generert av scripts/generate-icons.mjs -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="${w}dp" android:height="${h}dp"
    android:viewportWidth="${vw}" android:viewportHeight="${vh}">`;

// Adaptivt ikon: 108dp-rutenett der 72dp er synlig; merket får samme andel av den synlige flaten som på iOS
const iconScale = (36 * MARK_SIZE) / MARK_EXTENT;
const launcher = (color) =>
  `${vectorHeader(108, 108, 108, 108)}\n${ringsXml({ cx: 54, cy: 54, s: iconScale, color })}\n</vector>\n`;
await writeFile("android/app/src/main/res/drawable/ic_launcher_foreground.xml", launcher());
await writeFile("android/app/src/main/res/drawable/ic_launcher_monochrome.xml", launcher("#FFFFFF"));
await writeFile(
  "android/app/src/main/res/drawable/ic_launcher_background.xml",
  `${vectorHeader(108, 108, 108, 108)}
    <path android:pathData="M0,0h108v108h-108z">
        <aapt:attr name="android:fillColor">
            <gradient android:type="linear" android:startX="0" android:startY="108" android:endX="108" android:endY="0">
                <item android:offset="0" android:color="${BG.from}" />
                <item android:offset="1" android:color="${BG.to}" />
            </gradient>
        </aapt:attr>
    </path>
</vector>
`,
);
// Varselikon i statuslinjen: hvit silhuett, fyller 24dp nesten helt
await writeFile(
  "android/app/src/main/res/drawable/ic_notification.xml",
  `${vectorHeader(24, 24, 24, 24)}\n${ringsXml({ cx: 12, cy: 12, s: 11 / MARK_EXTENT, color: "#FFFFFFFF", weight: 1.8 })}\n</vector>\n`,
);
console.log("✓ android/app/src/main/res/drawable/ic_launcher_{foreground,monochrome,background}.xml, ic_notification.xml");

// Logoen til innloggingen (merke + ordmerke); drawable-night får originalgradienten
await mkdir("android/app/src/main/res/drawable-night", { recursive: true });
for (const [dir, stops] of [["drawable", GOLD_STOPS_ON_LIGHT], ["drawable-night", GOLD_STOPS]]) {
  const v = LOCKUP_VIEWBOX;
  const ox = -v.x, oy = -v.y; // flytt origo så alt er positivt
  const letters = WORDMARK_LETTERS.map(
    (l) => `        <path android:pathData="${l.d}"${l.evenOdd ? ' android:fillType="evenOdd"' : ""}>${gradient("fillColor", l.x, l.x + l.w, stops).replace(/\n/g, "\n    ")}
        </path>`,
  ).join("\n");
  await writeFile(
    `android/app/src/main/res/${dir}/flokk_logo.xml`,
    `${vectorHeader(240, f((240 * v.h) / v.w), f(v.w), f(v.h))}
${ringsXml({ cx: ox, cy: oy, s: 1, stops })}
    <group android:translateX="${f(ox + LOCKUP.wordmarkX)}" android:translateY="${f(oy + LOCKUP.wordmarkY)}">
${letters}
    </group>
</vector>
`,
  );
  console.log(`✓ android/app/src/main/res/${dir}/flokk_logo.xml`);
}

// ---------------------------------------------------------------------------
// favicon.ico for eldre nettlesere: ICO-fil med innebygde PNG-er (16, 32 og 48 px)
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((s) => sharp(Buffer.from(iconSvg({ radius: 224, weight: s < 48 ? 2.2 : 1.6 }))).resize(s, s).png().toBuffer()),
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
