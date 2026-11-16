import { Suspense } from "react";
import Loading from "@/app/loading";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loadGroup, loadMembers } from "@/lib/groups";
import { DangerZone, GroupSettingsForm, RoleList } from "./settings-forms";

export const metadata: Metadata = { title: "Innstillinger" };

type Params = PageProps<"/[gruppe]/innstillinger">;

export default function GroupSettingsPage(props: Params) {
  return (
    <Suspense fallback={<Loading />}>
      <GroupSettingsContent {...props} />
    </Suspense>
  );
}

async function GroupSettingsContent({ params }: Params) {
  const { gruppe } = await params;
  const { group, user, role, isAdmin } = await loadGroup(gruppe);
  if (!user) redirect(`/login?next=/${gruppe}/innstillinger`);
  if (!isAdmin) redirect(`/${gruppe}`);
  const isOwner = role === "owner";
  const members = isOwner ? await loadMembers(group.id) : [];
  const others = members
    .filter((m) => m.user_id !== user.id)
    .map((m) => ({ id: m.user_id, name: m.profiles?.display_name || "Medlem", role: m.role }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
      <Link href={`/${group.slug}`} className="text-sm text-muted-foreground hover:underline">
        ← {group.name}
      </Link>
      <section className="rounded-3xl bg-card p-6 shadow-card sm:p-8">
        <h1 className="mb-6 text-2xl font-bold">Innstillinger for flokken</h1>
        <GroupSettingsForm
          groupId={group.id}
          slug={group.slug}
          initial={{
            name: group.name,
            description: group.description ?? "",
            emoji: group.emoji ?? "",
            visibility: group.visibility,
            membersCanInvite: group.members_can_invite ?? true,
          }}
        />
      </section>

      {isOwner && (
        <section className="space-y-4 rounded-3xl bg-card p-6 shadow-card sm:p-8">
          <div>
            <h2 className="text-xl font-semibold">Roller</h2>
            <p className="text-sm text-muted-foreground">
              Admins kan invitere, endre flokken og arrangementene, og fjerne vanlige medlemmer.
            </p>
          </div>
          {others.length ? (
            <RoleList groupId={group.id} slug={group.slug} members={others} />
          ) : (
            <p className="text-sm text-muted-foreground">Ingen andre medlemmer ennå.</p>
          )}
        </section>
      )}

      {isOwner && <DangerZone groupId={group.id} slug={group.slug} name={group.name} members={others} />}
    </main>
  );
}
