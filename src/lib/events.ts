/**
 * Deler arrangementer inn i tre lister:
 * - «Stemming pågår»: tidspunkt er ikke valgt ennå (nyeste først)
 * - «Kommende»: valgt tidspunkt som ikke er passert (snarest først)
 * - «Tidligere»: valgt tidspunkt som er passert (sist passerte først)
 *
 * Arrangementer har ikke sluttid, så et arrangement regnes som kommende
 * til seks timer etter start – da blir det stående ut kvelden det skjer.
 */
export const PAST_AFTER_MS = 6 * 60 * 60 * 1000;

type Sortable = { created_at?: string | null; chosen: { starts_at: string } | null };

export function splitEvents<T extends Sortable>(events: T[], now = Date.now()) {
  const voting: T[] = [];
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const e of events) {
    if (!e.chosen?.starts_at) voting.push(e);
    else if (new Date(e.chosen.starts_at).getTime() + PAST_AFTER_MS < now) past.push(e);
    else upcoming.push(e);
  }
  const at = (e: T) => new Date(e.chosen!.starts_at).getTime();
  const created = (e: T) => (e.created_at ? new Date(e.created_at).getTime() : 0);
  voting.sort((a, b) => created(b) - created(a));
  upcoming.sort((a, b) => at(a) - at(b));
  past.sort((a, b) => at(b) - at(a));
  return { voting, upcoming, past };
}
