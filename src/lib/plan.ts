// Flokk Pluss: gratisgrenser og status. Grensene håndheves i databasen
// (supabase/migrations/20261117120000_plans.sql); her brukes de bare til visning.

/** Din plan, fra rpc("my_plan"). */
export type MyPlan = {
  plus: boolean;
  source: "manual" | "app_store" | "play_store" | "stripe" | null;
  expires_at: string | null;
  owned_groups: number;
  max_groups: number;
};

/** En flokks grenser, fra rpc("group_plan"). max_* er null når eieren har Pluss. */
export type GroupPlan = {
  plus: boolean;
  members: number;
  max_members: number | null;
  upcoming_events: number;
  max_upcoming_events: number | null;
};

/** Gratisgrensene (samme som plan_limit() i databasen). */
export const FREE_LIMITS = { groups: 3, members: 8, upcomingEvents: 1 } as const;

/**
 * Meldingen fra databasen når en gratisgrense er nådd, ellers null.
 * Triggerne setter hint «plan_limit:<type>» og en norsk melding som kan vises direkte.
 */
export function planLimitMessage(error: { hint?: string | null; message?: string } | null | undefined): string | null {
  return error?.hint?.startsWith("plan_limit:") && error.message ? error.message : null;
}

export function atLimit(count: number, max: number | null | undefined): boolean {
  return max != null && count >= max;
}
