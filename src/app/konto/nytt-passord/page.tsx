import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { requireUser } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nytt passord" };

export default function NewPasswordPage() {
  return (
    <AuthCard title="Nytt passord" subtitle="Velg et passord du kan bruke for å logge inn.">
      <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl bg-muted" />}>
        <Guarded />
      </Suspense>
    </AuthCard>
  );
}

async function Guarded() {
  await requireUser("/konto/nytt-passord");
  return <NewPasswordForm />;
}
