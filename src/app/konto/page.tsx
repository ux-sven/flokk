import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import Loading from "@/app/loading";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LeaveGroupButton } from "@/components/leave-group-button";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient, requireUser } from "@/lib/supabase/server";
import { groupSurface } from "@/lib/tints";
import { cn } from "@/lib/utils";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Min profil" };

export default function AccountPage() {
  return (
    <Suspense fallback={<Loading />}>
      <AccountContent />
    </Suspense>
  );
}

type MyGroup = {
  role: "owner" | "admin" | "member";
  groups: { id: string; name: string; slug: string; tint: string | null; backdrop: string | null } | null;
};

async function AccountContent() {
  const user = await requireUser("/konto");
  const supabase = await createClient();
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("group_members")
      .select("role, groups(id, name, slug, tint, backdrop)")
      .eq("user_id", user.id)
      .order("joined_at"),
  ]);
  const name = profile?.display_name || "";
  const groups = ((memberships ?? []) as unknown as MyGroup[]).filter((m) => m.groups);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Min profil</h1>

      <section className="space-y-5 rounded-3xl bg-card p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-4">
          <MemberAvatar name={name || "?"} src={profile?.avatar_url} className="size-14 text-base" />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{name || "Uten navn"}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <ProfileForm name={name} />
        <Link href="/konto/nytt-passord" className={buttonVariants({ variant: "outline" })}>
          <KeyRound /> Bytt passord
        </Link>
      </section>

      <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card sm:p-8">
        <h2 className="text-xl font-semibold">Mine flokker · {groups.length}</h2>
        {!groups.length ? (
          <p className="text-sm text-muted-foreground">
            Du er ikke med i noen flokker ennå. <Link href="/grupper/ny" className="underline">Lag en ny flokk</Link>.
          </p>
        ) : (
          <ul className="divide-y">
            {groups.map(({ role, groups: g }) => (
              <li key={g!.id} className="flex items-center gap-3 py-3">
                <span className={cn("size-10 shrink-0 rounded-xl", groupSurface(g!))} aria-hidden />
                <Link href={`/${g!.slug}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                  {g!.name}
                </Link>
                {role === "owner" ? (
                  <Badge variant="secondary" title="Eieren kan ikke melde seg ut av flokken">
                    Eier
                  </Badge>
                ) : (
                  <LeaveGroupButton groupId={g!.id} slug={g!.slug} name={g!.name} redirectTo="/konto" compact />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
