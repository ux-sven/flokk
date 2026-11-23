import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import Loading from "@/app/loading";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { LeaveGroupButton } from "@/components/leave-group-button";
import { MemberAvatar } from "@/components/member-avatar";
import { createClient, requireUser } from "@/lib/supabase/server";
import { groupSurface } from "@/lib/tints";
import { cn } from "@/lib/utils";
import { FREE_LIMITS, type MyPlan } from "@/lib/plan";
import { formatDate } from "@/lib/format";
import { DeleteAccount } from "./delete-account";
import { BlockedUsers, type BlockedUser } from "./blocked-users";
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
  const [{ data: profile }, { data: memberships }, { data: plan }, { data: blocks }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).maybeSingle(),
    supabase
      .from("group_members")
      .select("role, groups(id, name, slug, tint, backdrop)")
      .eq("user_id", user.id)
      .order("joined_at"),
    supabase.rpc("my_plan").then((r) => ({ data: (r.data ?? null) as MyPlan | null })),
    // Tom liste hvis migrasjon 16 ikke er kjørt
    supabase
      .from("user_blocks")
      .select("blocked_id, profiles!user_blocks_blocked_id_fkey(display_name)")
      .then((r) => ({ data: (r.data ?? []) as unknown as { blocked_id: string; profiles: { display_name: string } | null }[] })),
  ]);
  const blocked: BlockedUser[] = blocks.map((b) => ({ id: b.blocked_id, name: b.profiles?.display_name || "Bruker" }));
  const name = profile?.display_name || "";
  const groups = ((memberships ?? []) as unknown as MyGroup[]).filter((m) => m.groups);
  const owned = groups.filter((m) => m.role === "owner").map((m) => m.groups!.id);
  const { data: others } = owned.length
    ? await supabase.from("group_members").select("group_id").in("group_id", owned).neq("user_id", user.id)
    : { data: [] };
  const withOthers = new Set((others ?? []).map((r) => r.group_id as string));
  const ownedWithOthers = groups.filter((m) => m.role === "owner" && withOthers.has(m.groups!.id)).map((m) => m.groups!.name);

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
        <div className="flex flex-wrap gap-2">
          <Link href="/konto/nytt-passord" className={buttonVariants({ variant: "outline" })}>
            <KeyRound /> Bytt passord
          </Link>
          <form action="/auth/logout" method="post">
            <button type="submit" className={buttonVariants({ variant: "ghost" })}>
              <LogOut /> Logg ut
            </button>
          </form>
        </div>
      </section>

      {plan && <PlanCard plan={plan} />}

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

      <BlockedUsers initial={blocked} />

      <DeleteAccount ownedWithOthers={ownedWithOthers} />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/personvern" className="inline-flex items-center gap-1 hover:text-foreground hover:underline">
          <ShieldCheck className="size-4" /> Personvernerklæring
        </Link>
      </p>
    </main>
  );
}

function PlanCard({ plan }: { plan: MyPlan }) {
  if (plan.plus) {
    return (
      <section className="brand-panel space-y-2 rounded-3xl p-6 shadow-card sm:p-8">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-gold" />
          <h2 className="text-xl font-semibold">Flokk Pluss</h2>
        </div>
        <p className="text-sm text-[#f2efe8]/75">
          Ingen grenser på flokker, medlemmer eller arrangementer i flokkene du eier.
          {plan.expires_at ? ` Gjelder til ${formatDate(plan.expires_at)}.` : ""}
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card sm:p-8">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Gratisversjonen</h2>
        <Badge variant="secondary">
          {plan.owned_groups} av {plan.max_groups} flokker
        </Badge>
      </div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        <li>Eie inntil {FREE_LIMITS.groups} flokker</li>
        <li>Inntil {FREE_LIMITS.members} medlemmer i hver flokk</li>
        <li>Ett kommende arrangement om gangen i hver flokk</li>
      </ul>
      <p className="text-sm">
        Med <span className="font-semibold text-gold-text">Flokk Pluss</span> forsvinner grensene for alle flokkene du
        eier. Kommer snart.
      </p>
    </section>
  );
}
