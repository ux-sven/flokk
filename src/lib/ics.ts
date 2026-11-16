/**
 * Lager en .ics-fil (iCalendar) for ett arrangement. Arrangementer har ingen
 * sluttid, så vi bruker to timer – de fleste kalendere lar deg justere etterpå.
 */
export const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

function stamp(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Escaping etter RFC 5545 */
function text(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/** Linjer over 75 oktetter brettes med CRLF + mellomrom */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function eventIcs(e: {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  lat?: number | null;
  lng?: number | null;
  startsAt: string;
  url: string;
  groupName: string;
}) {
  const start = new Date(e.startsAt);
  const end = new Date(start.getTime() + DEFAULT_DURATION_MS);
  const description = [e.description?.trim(), `${e.groupName} på Flokk: ${e.url}`].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Flokk//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@flokk`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${text(e.title)}`,
    `DESCRIPTION:${text(description)}`,
    e.location ? `LOCATION:${text(e.location)}` : null,
    e.lat != null && e.lng != null ? `GEO:${e.lat};${e.lng}` : null,
    `URL:${e.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(e.title)}`,
    "TRIGGER:-PT2H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter((l): l is string => l !== null);
  return lines.map(fold).join("\r\n") + "\r\n";
}
