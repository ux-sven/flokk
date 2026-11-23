import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/contact";

export const metadata: Metadata = {
  title: "Personvern",
  description: "Hvilke opplysninger Flokk lagrer, hvorfor, og hvordan du sletter dem.",
};

/** Kontaktadresse for personvern: NEXT_PUBLIC_PRIVACY_CONTACT, ellers support-adressen. */
const contact = process.env.NEXT_PUBLIC_PRIVACY_CONTACT?.trim() || SUPPORT_EMAIL;
const UPDATED = "23. november 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <article className="space-y-8 rounded-3xl bg-card p-6 shadow-card sm:p-10 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_section]:space-y-3 [&_ul]:space-y-1.5">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Personvern i Flokk</h1>
          <p className="text-sm text-muted-foreground">Sist oppdatert {UPDATED}</p>
          <p>
            Flokk er en app for å samle grupper, planlegge treff og snakke sammen. Vi samler bare inn det som trengs for
            at appen skal virke, og vi selger ikke opplysninger eller bruker dem til reklame.
          </p>
        </header>

        <section>
          <h2>Hva vi lagrer</h2>
          <ul>
            <li>
              <strong>Konto:</strong> e-postadresse, visningsnavn og passord (lagret som en kryptografisk hash – vi kan
              ikke lese det).
            </li>
            <li>
              <strong>Det du gjør i flokkene:</strong> hvilke flokker du er med i og din rolle, arrangementer, tidsforslag,
              stemmer og påmeldinger, oppgaver, chatmeldinger og invitasjonslenker du lager.
            </li>
            <li>
              <strong>Varsler:</strong> varslene du får i appen, hvilket varslingsnivå du har valgt, og – hvis du slår på
              push-varsler – et teknisk token for nettleseren eller telefonen din.
            </li>
            <li>
              <strong>Flokk Pluss:</strong> om du har Pluss, hvilken variant (måned, år eller livstid), når den
              utløper og hvor den er kjøpt. Betalingen skjer hos Apple – vi får aldri kortopplysningene dine.
            </li>
            <li>
              <strong>«Inne nå»:</strong> mens du har en flokk åpen, ser andre medlemmer at du er inne. Dette lagres ikke.
            </li>
          </ul>
          <p>Vi bruker ikke sporing, analyseverktøy eller reklame-informasjonskapsler. Informasjonskapslene vi setter, holder deg innlogget.</p>
        </section>

        <section>
          <h2>Hvem som ser hva</h2>
          <p>
            Det du legger inn i en flokk, kan alle medlemmene av flokken se. Navnet på en åpen flokk og beskrivelsen er
            synlig for alle med lenken. Lukkede flokker er bare synlige for medlemmer.
          </p>
        </section>

        <section>
          <h2>Hvorfor vi behandler opplysningene</h2>
          <p>
            For å levere tjenesten du har bedt om (avtale, GDPR artikkel 6 nr. 1 b): innlogging, flokker, arrangementer,
            chat og varsler. Push-varsler sender vi bare når du selv har slått dem på.
          </p>
        </section>

        <section>
          <h2>Tjenester vi bruker</h2>
          <ul>
            <li>
              <strong>Supabase</strong> – database, innlogging og sanntid. Alle opplysningene over lagres her.
            </li>
            <li>
              <strong>E-post</strong> – for bekreftelse av konto, innloggingslenker og nytt passord.
            </li>
            <li>
              <strong>Apple (APNs) og Google (Firebase Cloud Messaging)</strong> – leverer push-varsler til telefoner.
              Nettleserens egen push-tjeneste brukes for varsler på nett. Varslene inneholder tittelen på det som skjedde.
            </li>
            <li>
              <strong>Apple og RevenueCat</strong> – kjøp av Flokk Pluss i iPhone-appen går gjennom App Store. RevenueCat
              holder rede på abonnementet på våre vegne og kjenner bare bruker-id-en din i Flokk og kjøpshistorikken.
            </li>
            <li>
              <strong>Kartverket</strong> – når du søker etter en adresse, sendes søketeksten til Kartverkets åpne
              adresse- og stedsnavntjenester. Ingen opplysninger om deg følger med.
            </li>
            <li>
              <strong>Google Maps</strong> – bare hvis du trykker på en kartlenke.
            </li>
          </ul>
        </section>

        <section>
          <h2>Hvor lenge vi lagrer</h2>
          <p>
            Så lenge du har en konto. Forlater du en flokk, slettes varslene dine fra flokken og stemmer på arrangementer
            som fortsatt planlegges. Invitasjonslenker utløper etter 14 dager. Push-tokens som ikke lenger virker,
            slettes automatisk.
          </p>
        </section>

        <section>
          <h2>Slette kontoen</h2>
          <p>
            Du kan slette kontoen selv under <Link href="/konto" className="underline underline-offset-2">Min profil</Link>{" "}
            på nett, eller under Profil i appen. Da slettes profilen, medlemskapene, stemmene, meldingene, varslene og
            push-tokens dine for godt. Flokker der du er eneste medlem slettes også. Er du eier av en flokk med andre
            medlemmer, må du først gi eierskapet til en annen. Arrangementer du har laget i andres flokker blir stående,
            med eieren av flokken som arrangør.
          </p>
        </section>

        <section>
          <h2>Dine rettigheter</h2>
          <p>
            Du har rett til innsyn i, retting og sletting av opplysningene om deg, og til å få dem utlevert. Du kan endre
            navnet ditt og slette kontoen selv. Du kan også klage til{" "}
            <a href="https://www.datatilsynet.no" className="underline underline-offset-2" rel="noopener noreferrer">
              Datatilsynet
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Kontakt</h2>
          {contact ? (
            <p>
              Spørsmål om personvern sender du til{" "}
              <a href={`mailto:${contact}`} className="underline underline-offset-2">
                {contact}
              </a>
              .
            </p>
          ) : (
            <p>Kontaktadresse for personvern kommer.</p>
          )}
        </section>
      </article>
    </main>
  );
}
