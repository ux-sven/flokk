"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

const AUTH_PAGES = ["/login", "/konto/registrer", "/konto/glemt-passord", "/konto/nytt-passord"];

/** «Logg inn» i toppen – skjules på sidene der man allerede logger inn eller registrerer seg. */
export function LoginLink() {
  const path = usePathname();
  if (AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <Link href="/login" className={buttonVariants({ size: "lg" })}>
      Logg inn
    </Link>
  );
}
