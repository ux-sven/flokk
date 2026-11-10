// Søk etter norske adresser og stedsnavn i Kartverkets åpne API-er (gratis, uten nøkkel).
//   Adresser:   https://ws.geonorge.no/adresser/v1/
//   Stedsnavn:  https://api.kartverket.no/stedsnavn/v1/

export type Place = {
  label: string; // Lagres som arrangementets sted
  detail: string; // Vises under i forslagslisten
  kind: "address" | "place";
  lat: number;
  lng: number;
};

type AddressHit = {
  adressetekst: string;
  postnummer: string;
  poststed: string;
  kommunenavn: string;
  representasjonspunkt?: { lat: number; lon: number };
};

type NameHit = {
  skrivemåte: string;
  navneobjekttype: string;
  kommuner?: { kommunenavn: string }[];
  representasjonspunkt?: { nord: number; øst: number };
};

const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());

async function getJson<T>(url: string, signal: AbortSignal): Promise<T | null> {
  try {
    const res = await fetch(url, { signal });
    return res.ok ? ((await res.json()) as T) : null;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return null;
  }
}

/** Kombinerer adresse- og stedsnavnsøk. Kaster AbortError hvis søket avbrytes. */
export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const q = query.trim().replace(/\s+/g, " ");
  if (q.length < 3) return [];
  const enc = encodeURIComponent;
  const base = "https://ws.geonorge.no/adresser/v1/sok?treffPerSide=5&utkoordsys=4258&sok=";

  const [exact, prefix, names] = await Promise.all([
    getJson<{ adresser: AddressHit[] }>(base + enc(q), signal),
    // * på slutten gir treff mens man skriver («storgata 5 lil*»)
    getJson<{ adresser: AddressHit[] }>(base + enc(q + "*"), signal),
    getJson<{ navn: NameHit[] }>(
      `https://api.kartverket.no/stedsnavn/v1/navn?treffPerSide=5&utkoordsys=4258&sok=${enc(q + "*")}`,
      signal,
    ),
  ]);

  const out: Place[] = [];
  const seen = new Set<string>();
  const add = (p: Place) => {
    const key = p.label.toLowerCase();
    if (!seen.has(key) && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
      seen.add(key);
      out.push(p);
    }
  };

  for (const a of [...(exact?.adresser ?? []), ...(prefix?.adresser ?? [])]) {
    if (!a.representasjonspunkt) continue;
    const poststed = titleCase(a.poststed);
    add({
      label: `${a.adressetekst}, ${a.postnummer} ${poststed}`,
      detail: a.kommunenavn && titleCase(a.kommunenavn) !== poststed ? `Adresse i ${titleCase(a.kommunenavn)}` : "Adresse",
      kind: "address",
      lat: a.representasjonspunkt.lat,
      lng: a.representasjonspunkt.lon,
    });
  }
  for (const n of names?.navn ?? []) {
    if (!n.representasjonspunkt) continue;
    const kommune = n.kommuner?.[0]?.kommunenavn;
    add({
      label: kommune && kommune !== n.skrivemåte ? `${n.skrivemåte}, ${kommune}` : n.skrivemåte,
      detail: n.navneobjekttype,
      kind: "place",
      lat: n.representasjonspunkt.nord,
      lng: n.representasjonspunkt.øst,
    });
  }

  // Adresser først når søket inneholder et husnummer, ellers stedsnavn først
  const hasNumber = /\d/.test(q);
  return out
    .sort((a, b) => (a.kind === b.kind ? 0 : (a.kind === "address") === hasNumber ? -1 : 1))
    .slice(0, 8);
}

/** Lenke som åpner stedet i Google Maps (app på mobil, nettside ellers). */
export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/** Tolker koordinater fra et skjema. Gir null hvis de mangler eller er ugyldige. */
export function parseCoords(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  const la = Number(lat);
  const lo = Number(lng);
  if (lat === "" || lng === "" || lat == null || lng == null) return null;
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  return { lat: la, lng: lo };
}
