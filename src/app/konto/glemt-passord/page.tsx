import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Glemt passord" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="Glemt passord" subtitle="Vi sender deg en lenke for å lage et nytt passord.">
      <ForgotForm />
    </AuthCard>
  );
}
