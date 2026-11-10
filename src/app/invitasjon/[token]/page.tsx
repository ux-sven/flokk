import { Suspense } from "react";
import Loading from "@/app/loading";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient, getUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitasjon" };

type Invitation = { group_id: string; group_slug: string; group_name: string; group_description: string; valid: boolean };

async function accept(token: string) {
  "use server";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { invite_token: token });
  if (error) redirect(`/invitasjon/${token}?feil=1`);
  redirect(`/${data}`);
}

export default function InvitationPage(props: PageProps<"/invitasjon/[token]">) {
  return (
    <Suspense fallback={<Loading />}>
      <InvitationPageContent {...props} />
    </Suspense>
  );
}

async function InvitationPageContent({ params, searchParams }: PageProps<"/invitasjon/[token]">) {
  const { token } = await params;
  const { feil } = await searchParams;
  const supabase = await createClient();
  const [{ data }, user] = await Promise.all([
    supabase.rpc("get_invitation", { invite_token: token }),
    getUser(),
  ]);
  const invite = (data as Invitation[] | null)?.[0];

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4 rounded-3xl bg-card p-8 text-center shadow-card">
        {!invite || !invite.valid ? (
          <>
            <h1 className="text-2xl font-bold">Invitasjonen er ugyldig</h1>
            <p className="text-muted-foreground">Lenken er utløpt eller finnes ikke. Be om en ny invitasjon.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Du er invitert til</p>
            <h1 className="text-3xl font-bold">{invite.group_name}</h1>
            {invite.group_description && <p className="text-muted-foreground">{invite.group_description}</p>}
            {feil && <p className="text-sm text-destructive">Kunne ikke godta invitasjonen.</p>}
            {user ? (
              <form action={accept.bind(null, token)}>
                <Button type="submit" size="lg" className="h-11 w-full">
                  Bli med i flokken
                </Button>
              </form>
            ) : (
              <Link
                href={`/login?next=/invitasjon/${token}`}
                className={buttonVariants({ size: "lg", className: "h-11 w-full" })}
              >
                Logg inn eller registrer deg for å bli med
              </Link>
            )}
          </>
        )}
      </div>
    </main>
  );
}
