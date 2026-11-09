import { Suspense } from "react";
import Loading from "@/app/loading";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink } from "./actions";

const errors: Record<string, string> = {
  missing: "Skriv inn e-postadressen din.",
  send: "Vi fikk ikke sendt lenken. Prøv igjen om litt.",
  callback: "Innloggingslenken var ugyldig eller utløpt.",
};

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<Loading />}>
      <LoginPageContent {...props} />
    </Suspense>
  );
}

async function LoginPageContent({ searchParams }: PageProps<"/login">) {
  const { next, sent, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/";

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-sm">
        <Link href="/" className="text-lg font-extrabold tracking-tight">
          FLOKK.
        </Link>
        {sent ? (
          <div className="mt-6 space-y-2">
            <h1 className="text-2xl font-bold">Sjekk e-posten din</h1>
            <p className="text-muted-foreground">
              Vi har sendt deg en innloggingslenke. Klikk på den for å fortsette.
            </p>
          </div>
        ) : (
          <form action={sendMagicLink} className="mt-6 space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Logg inn eller registrer deg</h1>
              <p className="text-sm text-muted-foreground">
                Ingen passord – vi sender deg en lenke på e-post.
              </p>
            </div>
            <input type="hidden" name="next" value={nextPath} />
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {typeof error === "string" && errors[error] && (
              <p className="text-sm text-destructive">{errors[error]}</p>
            )}
            <Button type="submit" className="h-10 w-full">
              Send innloggingslenke
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
