import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { FREE_LIMITS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Vilkår",
  description: "Vilkårene for å bruke Flokk, blant annet regler for innhold og Flokk Pluss.",
};

const UPDATED = "23. november 2026";
const link = "underline underline-offset-2";

/** Vilkår for bruk. Brukerne godtar dem når de oppretter en konto. */
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <article className="space-y-8 rounded-3xl bg-card p-6 shadow-card sm:p-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_section]:space-y-3 [&_ul]:space-y-1.5">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Vilkår for Flokk</h1>
          <p className="text-sm text-muted-foreground">Sist oppdatert {UPDATED}</p>
          <p>
            Når du oppretter en konto i Flokk, godtar du disse vilkårene. De gjelder appene for iPhone og Android og
            nettsiden.
          </p>
        </header>

        <section>
          <h2>Regler for innhold – nulltoleranse</h2>
          <p>
            Flokk er for å samle folk. Vi har <strong>nulltoleranse</strong> for støtende innhold og misbruk. Du har
            ikke lov til å legge inn eller sende:
          </p>
          <ul>
            <li>trakassering, mobbing, trusler eller hatefulle ytringer</li>
            <li>seksuelt innhold, nakenhet eller innhold som utnytter barn</li>
            <li>vold, eller oppfordring til vold eller ulovlige handlinger</li>
            <li>spam, svindel eller forsøk på å lure andre</li>
            <li>andres personopplysninger uten samtykke</li>
          </ul>
          <p>
            Du er selv ansvarlig for det du legger inn. Du må være minst 13 år for å bruke Flokk.
          </p>
        </section>

        <section>
          <h2>Rapportering og blokkering</h2>
          <p>
            Ser du noe som bryter med reglene, kan du rapportere meldingen eller brukeren fra «⋯»-menyen. Du kan også
            blokkere en bruker, så ser du ikke lenger meldingene deres. Vi går gjennom rapporter innen 24 timer, fjerner
            innhold som bryter med vilkårene, og stenger brukere som har lagt det inn. Eiere og administratorer av en
            flokk kan også slette meldinger og fjerne medlemmer.
          </p>
        </section>

        <section>
          <h2>Flokk Pluss</h2>
          <p>
            Flokk er gratis med noen grenser ({FREE_LIMITS.groups} egne flokker, {FREE_LIMITS.members} medlemmer per
            flokk og ett kommende arrangement om gangen). Flokk Pluss fjerner grensene for flokkene du eier, og kjøpes i
            iPhone-appen som månedlig eller årlig abonnement, eller som engangskjøp. Abonnementet fornyes automatisk til
            samme pris med mindre det sies opp senest 24 timer før perioden er over, og sies opp under Innstillinger →
            [navnet ditt] → Abonnementer. Kjøp, refusjon og oppsigelse følger også{" "}
            <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" className={link} rel="noopener noreferrer">
              Apples standardvilkår
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Kontoen din</h2>
          <p>
            Du kan slette kontoen når som helst under Min profil eller Profil i appen. Vi kan stenge kontoer som bryter
            vilkårene. Les om hva vi lagrer i{" "}
            <Link href="/personvern" className={link}>
              personvernerklæringen
            </Link>
            .
          </p>
        </section>

        <section>
          <h2>Ansvar og endringer</h2>
          <p>
            Vi gjør vårt beste for at Flokk skal virke, men kan ikke love at tjenesten alltid er tilgjengelig eller fri
            for feil. Vi kan endre vilkårene; ved vesentlige endringer sier vi fra i appen.
          </p>
        </section>

        <section>
          <h2>Kontakt</h2>
          <p>
            Spørsmål om vilkårene sender du til{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className={link}>
              {SUPPORT_EMAIL}
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
