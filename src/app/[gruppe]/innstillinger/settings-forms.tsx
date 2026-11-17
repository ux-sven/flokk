"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Crown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteGroup,
  setMemberRole,
  transferOwnership,
  updateGroup,
  type GroupSettingsState,
} from "@/app/[gruppe]/actions";

type Person = { id: string; name: string; role: "owner" | "admin" | "member" };

export function GroupSettingsForm({
  groupId,
  slug,
  initial,
}: {
  groupId: string;
  slug: string;
  initial: {
    name: string;
    description: string;
    emoji: string;
    visibility: "open" | "invite_only";
    membersCanInvite: boolean;
  };
}) {
  const [state, action, pending] = useActionState<GroupSettingsState, FormData>(
    updateGroup.bind(null, groupId, slug),
    {},
  );

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
        <div className="space-y-2">
          <Label htmlFor="emoji">Ikon</Label>
          <Input id="emoji" name="emoji" defaultValue={initial.emoji} placeholder="🪺" className="h-10 text-center text-xl" maxLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Navn</Label>
          <Input id="name" name="name" required minLength={2} maxLength={80} defaultValue={initial.name} className="h-10" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Beskrivelse</Label>
        <Textarea id="description" name="description" rows={3} maxLength={500} defaultValue={initial.description} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Hvem kan bli med?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-2xl border bg-card p-4 has-checked:border-primary">
            <input type="radio" name="visibility" value="invite_only" defaultChecked={initial.visibility !== "open"} className="mt-1" />
            <span>
              <span className="block font-medium">Kun inviterte</span>
              <span className="text-sm text-muted-foreground">Synlig bare for medlemmer.</span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-2xl border bg-card p-4 has-checked:border-primary">
            <input type="radio" name="visibility" value="open" defaultChecked={initial.visibility === "open"} className="mt-1" />
            <span>
              <span className="block font-medium">Åpen for alle</span>
              <span className="text-sm text-muted-foreground">Alle med bruker kan bli med.</span>
            </span>
          </label>
        </div>
      </fieldset>
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border bg-card p-4">
        <input
          type="checkbox"
          name="members_can_invite"
          defaultChecked={initial.membersCanInvite}
          className="mt-1 size-4 accent-gold-deep"
        />
        <span>
          <span className="block font-medium">Alle medlemmer kan invitere</span>
          <span className="text-sm text-muted-foreground">
            Slår du av dette, er det bare admins som kan lage invitasjonslenker.
          </span>
        </span>
      </label>
      <p className="text-xs text-muted-foreground">
        Adressen (/{slug}) endres ikke, så lenker som er delt fortsetter å virke. Farge og bakgrunn endrer du med
        palett-knappen på flokksiden.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Lagrer …" : "Lagre endringer"}
        </Button>
        <p role="status" aria-live="polite" className="text-sm">
          {state.error ? (
            <span className="text-destructive">{state.error}</span>
          ) : state.saved && !pending ? (
            <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="size-4" /> Lagret
            </span>
          ) : null}
        </p>
      </div>
    </form>
  );
}

export function RoleList({ groupId, slug, members }: { groupId: string; slug: string; members: Person[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle(p: Person) {
    setError(null);
    startTransition(async () => {
      const res = await setMemberRole(groupId, slug, p.id, p.role === "admin" ? "member" : "admin");
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y">
        {members.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-gold-deep"
                checked={p.role === "admin"}
                disabled={pending}
                onChange={() => toggle(p)}
              />
              Admin
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function DangerZone({
  groupId,
  slug,
  name,
  members,
}: {
  groupId: string;
  slug: string;
  name: string;
  members: Person[];
}) {
  const [pending, startTransition] = useTransition();
  const [newOwner, setNewOwner] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function transfer() {
    const person = members.find((m) => m.id === newOwner);
    if (!person) return;
    if (!confirm(`Gjøre ${person.name} til eier av ${name}?\n\nDu blir admin, og bare ${person.name} kan gi eierskapet tilbake.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await transferOwnership(groupId, slug, newOwner);
      if (res?.error) setError(res.error);
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const res = await deleteGroup(groupId, slug, confirmName);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <section className="space-y-6 rounded-3xl border border-destructive/30 bg-card p-6 shadow-card sm:p-8">
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Overfør eierskap</h2>
          <p className="text-sm text-muted-foreground">
            Eieren kan ikke melde seg ut. Gi eierskapet til et annet medlem først – du blir da admin.
          </p>
        </div>
        {members.length ? (
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Ny eier"
              value={newOwner}
              onChange={(e) => setNewOwner(e.target.value)}
              className="h-10 min-w-48 flex-1 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">Velg medlem …</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.role === "admin" ? " (admin)" : ""}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" size="lg" disabled={!newOwner || pending} onClick={transfer}>
              <Crown /> Overfør
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Inviter noen først – det er ingen andre medlemmer å gi eierskapet til.</p>
        )}
      </div>

      <div className="space-y-3 border-t pt-6">
        <div>
          <h2 className="text-xl font-semibold text-destructive">Slett flokken</h2>
          <p className="text-sm text-muted-foreground">
            Alle arrangementer, stemmer, oppgaver, chat og invitasjoner slettes for godt. Dette kan ikke angres.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-name">
            Skriv <span className="font-semibold">{name}</span> for å bekrefte
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="confirm-name"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              autoComplete="off"
              className="h-10 min-w-48 flex-1"
            />
            <Button
              type="button"
              variant="destructive"
              size="lg"
              disabled={confirmName.trim() !== name || pending}
              onClick={remove}
            >
              <Trash2 /> Slett flokken
            </Button>
          </div>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
