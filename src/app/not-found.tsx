import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-3xl font-bold">Fant ikke siden</h1>
      <p className="max-w-md text-muted-foreground">
        Flokken eller arrangementet finnes ikke, eller så har du ikke tilgang. Lukkede flokker er bare synlige for
        medlemmer.
      </p>
      <Link href="/" className={buttonVariants({ size: "lg" })}>
        Til forsiden
      </Link>
    </main>
  );
}
