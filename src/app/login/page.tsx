import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logg inn" };

const errors: Record<string, string> = {
  callback: "Lenken var ugyldig eller utløpt. Prøv igjen.",
};

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <AuthCard title="Logg inn" subtitle="Velkommen tilbake til flokken.">
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted" />}>
        <LoginFormFromParams {...props} />
      </Suspense>
    </AuthCard>
  );
}

async function LoginFormFromParams({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <LoginForm next={nextPath} initialError={typeof error === "string" ? errors[error] : undefined} />;
}
