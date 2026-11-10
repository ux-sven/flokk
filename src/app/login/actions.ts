"use server";

import { redirect } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";

export type AuthState = { error?: string; done?: boolean; email?: string };

const MIN_PASSWORD = 8;

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "/";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

const siteOrigin = getSiteOrigin;

function callbackUrl(origin: string, next: string) {
  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

/** Oversetter Supabase-feil til norsk. */
function describe(error: AuthError, context: string): string {
  console.error(`[auth:${context}]`, error.status, error.code, error.message);
  switch (error.code) {
    case "invalid_credentials":
      return "Feil e-post eller passord.";
    case "email_not_confirmed":
      return "E-postadressen er ikke bekreftet ennå. Sjekk innboksen din.";
    case "user_already_exists":
    case "email_exists":
      return "Det finnes allerede en bruker med denne e-postadressen. Logg inn i stedet.";
    case "weak_password":
      return "Passordet er for svakt. Bruk minst 8 tegn, gjerne med tall og spesialtegn.";
    case "same_password":
      return "Det nye passordet må være forskjellig fra det gamle.";
    case "over_email_send_rate_limit":
      return "For mange e-poster sendt på kort tid. Vent litt og prøv igjen.";
    case "over_request_rate_limit":
      return "For mange forsøk. Vent litt og prøv igjen.";
    case "email_address_invalid":
    case "validation_failed":
      return "E-postadressen ser ikke gyldig ut.";
    case "signup_disabled":
      return "Registrering av nye brukere er slått av.";
    default:
      return error.status === 429 ? "For mange forsøk. Vent litt og prøv igjen." : "Noe gikk galt. Prøv igjen.";
  }
}

export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  if (!email || !password) return { error: "Fyll inn e-post og passord.", email };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: describe(error, "password"), email };
  redirect(next);
}

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email");
  const next = safeNext(formData.get("next"));
  if (!email) return { error: "Skriv inn e-postadressen din." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl(await siteOrigin(), next) },
  });
  if (error) return { error: describe(error, "magic-link"), email };
  return { done: true, email };
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (name.length < 2) return { error: "Skriv inn navnet ditt.", email };
  if (!email) return { error: "Skriv inn e-postadressen din.", email };
  if (password.length < MIN_PASSWORD) return { error: `Passordet må ha minst ${MIN_PASSWORD} tegn.`, email };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name },
      emailRedirectTo: callbackUrl(await siteOrigin(), next),
    },
  });
  if (error) return { error: describe(error, "signup"), email };

  // Supabase skjuler at e-posten finnes ved å returnere en bruker uten identiteter
  if (data.user && data.user.identities?.length === 0) {
    return { error: "Det finnes allerede en bruker med denne e-postadressen. Logg inn i stedet.", email };
  }
  // «Confirm email» av: brukeren er logget inn med en gang
  if (data.session) redirect(next);
  return { done: true, email };
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = field(formData, "email");
  if (!email) return { error: "Skriv inn e-postadressen din." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl(await siteOrigin(), "/konto/nytt-passord"),
  });
  if (error) return { error: describe(error, "reset"), email };
  // Svarer likt uansett om brukeren finnes, for ikke å avsløre e-postadresser
  return { done: true, email };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Passordet må ha minst ${MIN_PASSWORD} tegn.` };
  if (password !== confirm) return { error: "Passordene er ikke like." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: describe(error, "update-password") };
  return { done: true };
}
