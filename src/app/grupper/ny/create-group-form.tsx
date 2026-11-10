"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/format";
import { AppearancePicker, type Appearance } from "@/components/appearance-picker";
import { createGroup, type CreateGroupState } from "./actions";

export function CreateGroupForm({ siteUrl }: { siteUrl: string }) {
  const [state, action, pending] = useActionState<CreateGroupState, FormData>(createGroup, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [look, setLook] = useState<Appearance>({ tint: "mint", backdrop: "sommer" });
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
        <legend className="text-sm font-medium">Utseende</legend>
        <input type="hidden" name="tint" value={look.tint} />
        <input type="hidden" name="backdrop" value={look.backdrop ?? ""} />
        <AppearancePicker value={look} onChange={setLook} />
      </fieldset>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="h-10 px-5">
        {pending ? "Oppretter …" : "Opprett flokk"}
      </Button>
    </form>
  );
}
