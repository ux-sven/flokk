import type { Metadata } from "next";
import Link from "next/link";
import { Mail } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { FREE_LIMITS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Hjelp",
  description: "Svar på vanlige spørsmål om Flokk, Flokk Pluss og kontoen din – og hvordan du kontakter oss.",
};

const link = "underline underline-offset-2";

/** Supportsiden (Support URL i App Store Connect). */
export default function HelpPage() {
  const faq: { q: string; a: React.ReactNode }[] = [
    {
      q: "Hva er Flokk?",
      a: "Flokk samler vennegjengen, laget eller foreningen ett sted: arrangementer, avstemning om tidspunkt, påmelding, oppgaver og chat. Appen finnes for iPhone og Android og på nett.",
    },
    {
      q: "Hvordan kommer jeg i gang?",
      a: (
        <>
          Lag en konto, trykk <strong>Ny flokk</strong> og gi den et navn. Del deretter en invitasjonslenke fra flokken
          (<strong>Inviter</strong>), så kan de andre bli med. Åpne flokker kan man også bli med i direkte fra adressen.
        </>
      ),
    },
    {
      q: "Hvordan planlegger vi et treff?",
      a: "Lag et arrangement og foreslå noen tidspunkter. Medlemmene stemmer på det som passer, og arrangøren velger tidspunkt. Deretter kan alle svare om de kommer, fordele oppgaver og legge arrangementet i kalenderen.",
    },
    {
      q: "Jeg får ikke varsler",
      a: (
        <>
          Sjekk at varsler er slått på for Flokk i telefonens innstillinger, og at varslingsnivået i flokken står på{" "}
          <strong>Alt</strong> om du vil ha varsel om chat. I appen kan du sende deg selv et testvarsel under{" "}
          <strong>Profil</strong>. Du får ikke varsel om det du selv gjør.
        </>
      ),
    },
    {
      q: "Hva er gratis, og hva er Flokk Pluss?",
      a: (
        <>
          Flokk er gratis. Gratisversjonen lar deg eie {FREE_LIMITS.groups} flokker med inntil {FREE_LIMITS.members}{" "}
          medlemmer hver, og ha ett kommende arrangement om gangen per flokk. <strong>Flokk Pluss</strong> fjerner
          grensene for alle flokkene du eier – medlemmene trenger ikke betale. Pluss finnes som månedlig og årlig
          abonnement, og som engangskjøp (livstid).
        </>
      ),
    },
    {
      q: "Hvordan kjøper jeg Flokk Pluss?",
      a: (
        <>
          I iPhone-appen: <strong>Profil → Oppgrader til Flokk Pluss</strong>. Betalingen går gjennom App Store.
        </>
      ),
    },
    {
      q: "Hvordan sier jeg opp abonnementet?",
      a: (
        <>
          På iPhone: <strong>Innstillinger → [navnet ditt] → Abonnementer → Flokk</strong>, eller{" "}
          <strong>Profil → Administrer abonnement</strong> i appen. Abonnementet varer ut perioden du har betalt for.
        </>
      ),
    },
    {
      q: "Jeg har ny telefon eller har installert appen på nytt",
      a: (
        <>
          Logg inn med den samme Flokk-kontoen – Pluss følger kontoen. Har du kjøpt med en annen Flokk-konto, trykk{" "}
          <strong>Gjenopprett kjøp</strong> på kjøpsskjermen.
        </>
      ),
    },
    {
      q: "Kan jeg få pengene tilbake?",
      a: (
        <>
          Kjøp i App Store refunderes av Apple. Be om refusjon på{" "}
          <a href="https://reportaproblem.apple.com" className={link} rel="noopener noreferrer">
            reportaproblem.apple.com
          </a>
          .
        </>
      ),
    },
    {
      q: "Hvordan sletter jeg kontoen?",
      a: (
        <>
          Under <Link href="/konto" className={link}>Min profil</Link> på nett, eller <strong>Profil → Slett kontoen</strong>{" "}
          i appen. Er du eier av en flokk med andre medlemmer, må du først gi eierskapet til en annen. Et abonnement på
          Flokk Pluss må sies opp hos Apple i tillegg. Les mer i{" "}
          <Link href="/personvern" className={link}>
            personvernerklæringen
          </Link>
          .
        </>
      ),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Hjelp</h1>
        <p className="text-muted-foreground">Svar på det folk lurer mest på. Finner du ikke svaret, skriv til oss.</p>
      </header>

      <section className="divide-y rounded-3xl bg-card shadow-card">
        {faq.map(({ q, a }) => (
          <details key={q} className="group px-6 py-4 [&_strong]:font-semibold">
            <summary className="cursor-pointer list-none font-semibold marker:hidden">
              <span className="flex items-center justify-between gap-4">
                {q}
                <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                  +
                </span>
              </span>
            </summary>
            <p className="mt-2 leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </section>

      <section className="brand-panel space-y-3 rounded-3xl p-6 shadow-card sm:p-8">
        <h2 className="text-xl font-semibold">Kontakt oss</h2>
        <p className="text-sm text-[#f2efe8]/75">
          Spørsmål, feil eller forslag? Send en e-post, så svarer vi så snart vi kan – vanligvis innen et par dager.
        </p>
        <a href={`mailto:${SUPPORT_EMAIL}`} className={buttonVariants({ variant: "gold", size: "lg", className: "h-11 px-5" })}>
          <Mail /> {SUPPORT_EMAIL}
        </a>
      </section>
    </main>
  );
}
