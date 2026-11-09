import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/server";
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
  const user = isSupabaseConfigured ? await getUser() : null;
  return (
    <>
          {user ? (
            <>
              <Link href="/grupper/ny" className={buttonVariants({ size: "lg" })}>
                <Plus /> Ny flokk
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
