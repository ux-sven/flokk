const TZ = "Europe/Oslo";

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(
    new Date(iso),
  );
}

const relative = new Intl.RelativeTimeFormat("nb-NO", { numeric: "auto" });

/** «for 5 minutter siden», «i går» osv.; eldre enn en uke vises som dato. */
export function formatRelative(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "nå";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86400) return relative.format(Math.round(seconds / 86400), "day");
  return formatDateTime(iso);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Deler av en dato for kalender-flis: { weekday: "lør.", day: "13", month: "des.", time: "18:00", long: "lørdag 13. desember" } */
export function dateParts(iso: string) {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("nb-NO", { ...o, timeZone: TZ }).format(d);
  return {
    weekday: f({ weekday: "short" }).replace(".", ""),
    day: f({ day: "numeric" }).replace(".", ""),
    month: f({ month: "short" }).replace(".", ""),
    time: formatTime(iso),
    long: f({ weekday: "long", day: "numeric", month: "long" }),
  };
}
