import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { NotificationBell } from "@/components/notification-bell";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient, getUser } from "@/lib/supabase/server";
import { NOTIFICATION_LIMIT, NOTIFICATION_SELECT, type AppNotification } from "@/lib/notifications";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          FLOKK.
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />}>
            <UserActions />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function UserActions() {
  await connection(); // brukerdata hentes alltid ved forespørsel
  const user = isSupabaseConfigured ? await getUser() : null;
  let notifications: AppNotification[] = [];
  let profile: { display_name: string; avatar_url: string | null } | null = null;
  if (user) {
    const supabase = await createClient();
    const [{ data }, { data: me }] = await Promise.all([
      supabase
        .from("notifications")
        .select(NOTIFICATION_SELECT)
        .order("updated_at", { ascending: false })
        .limit(NOTIFICATION_LIMIT),
      supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    ]);
    notifications = (data ?? []) as unknown as AppNotification[];
    profile = me;
  }
  return (
    <>
          {user ? (
            <>
              <NotificationBell userId={user.id} initial={notifications} />
              <Link href="/grupper/ny" className={buttonVariants({ size: "lg" })}>
                <Plus /> Ny flokk
              </Link>
              <Link href="/konto" aria-label="Min profil" title="Min profil" className="rounded-full ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-ring/50">
                <MemberAvatar name={profile?.display_name || "?"} src={profile?.avatar_url} className="size-9" />
              </Link>
              <form action="/auth/logout" method="post">
                <button type="submit" className={buttonVariants({ variant: "ghost", size: "lg" })}>
                  Logg ut
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className={buttonVariants({ size: "lg" })}>
              Logg inn
            </Link>
          )}
    </>
  );
}
