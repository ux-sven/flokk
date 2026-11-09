"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/format";
import { TINTS, tintBg, tintLabel } from "@/lib/tints";
import { cn } from "@/lib/utils";
import { createGroup, type CreateGroupState } from "./actions";

export function CreateGroupForm({ siteUrl }: { siteUrl: string }) {
  const [state, action, pending] = useActionState<CreateGroupState, FormData>(createGroup, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [tint, setTint] = useState<(typeof TINTS)[number]>("mint");
  const effectiveSlug = slugEdited ? slug : slugify(name);

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
        <div className="space-y-2">
          <Label htmlFor="emoji">Ikon</Label>
          <Input id="emoji" name="emoji" placeholder="🥾" className="h-10 text-center text-xl" maxLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Navn</Label>
          <Input
            id="name"
            name="name"
            required
            className="h-10"
            placeholder="Turgjengen"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Adresse</Label>
        <div className="flex h-10 items-center overflow-hidden rounded-lg border bg-background text-sm focus-within:ring-3 focus-within:ring-ring/50">
          <span className="pl-3 text-muted-foreground">{siteUrl.replace(/^https?:\/\//, "")}/</span>
          <input
            id="slug"
            name="slug"
            className="h-full flex-1 bg-transparent pr-3 outline-none"
            value={effectiveSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">Del denne adressen med medlemmene.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Beskrivelse</Label>
        <Textarea id="description" name="description" rows={3} placeholder="Hva er flokken til for?" />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Hvem kan bli med?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-2xl border bg-card p-4 has-checked:border-primary">
            <input type="radio" name="visibility" value="invite_only" defaultChecked className="mt-1" />
            <span>
              <span className="block font-medium">Kun inviterte</span>
              <span className="text-sm text-muted-foreground">Synlig bare for medlemmer.</span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-2xl border bg-card p-4 has-checked:border-primary">
            <input type="radio" name="visibility" value="open" className="mt-1" />
            <span>
              <span className="block font-medium">Åpen for alle</span>
              <span className="text-sm text-muted-foreground">Alle med bruker kan bli med.</span>
            </span>
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Farge</legend>
        <input type="hidden" name="tint" value={tint} />
        <div className="flex flex-wrap gap-2">
          {TINTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTint(t)}
              aria-pressed={tint === t}
              aria-label={tintLabel[t]}
              className={cn(
                "size-10 rounded-full ring-offset-2 ring-offset-background transition",
                tintBg[t],
                tint === t && "ring-2 ring-primary",
              )}
            />
          ))}
        </div>
      </fieldset>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="h-10 px-5">
        {pending ? "Oppretter …" : "Opprett flokk"}
      </Button>
    </form>
  );
}
