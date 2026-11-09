import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Opprett bruker" };

export default function RegisterPage(props: PageProps<"/konto/registrer">) {
  return (
    <AuthCard title="Opprett bruker" subtitle="Du trenger en bruker for å bli med i en flokk.">
      <Suspense fallback={<div className="h-80 animate-pulse rounded-2xl bg-muted" />}>
        <RegisterFormFromParams {...props} />
      </Suspense>
    </AuthCard>
  );
}

async function RegisterFormFromParams({ searchParams }: PageProps<"/konto/registrer">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  return <RegisterForm next={nextPath} />;
}
