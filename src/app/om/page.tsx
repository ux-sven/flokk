import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarCheck, Check, ListChecks, MessagesSquare, Users } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { APP_STORE_URL } from "@/lib/contact";
import { FREE_LIMITS } from "@/lib/plan";

export const metadata: Metadata = {
  title: "Om Flokk",
  description:
    "Flokk samler vennegjengen, laget og foreningen: arrangementer, avstemning om tidspunkt, påmelding, oppgaver og chat – for iPhone, Android og nett.",
};

const features = [
  { icon: Users, title: "Egne flokker", text: "Åpne for alle eller bare for inviterte, med egen adresse og invitasjonslenke." },
  { icon: CalendarCheck, title: "Finn et tidspunkt", text: "Foreslå tider, la flokken stemme, og velg det som passer flest." },
  { icon: Check, title: "Hvem kommer?", text: "Påmelding med ett trykk, og arrangementet rett i kalenderen." },
  { icon: ListChecks, title: "Fordel oppgavene", text: "Hvem tar med hva? Oppgaver knyttet til hvert arrangement." },
  { icon: MessagesSquare, title: "Snakk sammen", text: "Chat for hele flokken, eller bare for ett arrangement." },
  { icon: Bell, title: "Varsler som teller", text: "Velg selv om du vil ha alt, bare det viktige, eller ingenting." },
];

/** Markedssiden (Marketing URL i App Store Connect). */
export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-14 px-4 py-10">
      <section className="brand-panel relative overflow-hidden rounded-[2rem] px-6 py-12 shadow-card sm:px-12 sm:py-16">
        <LogoMark className="pointer-events-none absolute -right-16 -bottom-20 size-80 opacity-25 sm:-right-10 sm:size-[26rem] sm:opacity-40" />
        <div className="relative max-w-xl space-y-6">
          <h1 className="text-5xl font-extrabold tracking-tight">Samle flokken.</h1>
          <p className="text-lg text-[#f2efe8]/75">
            Flokk er stedet for vennegjengen, laget og foreningen. Planlegg treff der alle får si sitt om når det passer,
            se hvem som kommer, fordel oppgavene og snakk sammen – uten lange meldingstråder.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={APP_STORE_URL} className={buttonVariants({ variant: "gold", size: "lg", className: "h-11 px-5" })}>
              Last ned for iPhone
            </a>
            <Link
              href="/login"
              className={buttonVariants({
                variant: "outline",
                size: "lg",
                className: "h-11 border-white/25 bg-transparent px-5 text-[#f2efe8] hover:bg-white/10 hover:text-white",
              })}
            >
              Bruk Flokk på nett
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Alt flokken trenger</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl bg-card p-6 shadow-card">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent text-gold-text">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Gratis – med Pluss når flokken vokser</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3 rounded-3xl bg-card p-6 shadow-card sm:p-8">
            <h3 className="text-xl font-semibold">Gratis</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>Eie inntil {FREE_LIMITS.groups} flokker</li>
              <li>Inntil {FREE_LIMITS.members} medlemmer i hver flokk</li>
              <li>Ett kommende arrangement om gangen</li>
              <li>Avstemning, påmelding, oppgaver og chat</li>
            </ul>
          </div>
          <div className="brand-panel space-y-3 rounded-3xl p-6 shadow-card sm:p-8">
            <h3 className="text-xl font-semibold text-gold">Flokk Pluss</h3>
            <ul className="space-y-1.5 text-sm text-[#f2efe8]/75">
              <li>Så mange flokker du vil</li>
              <li>Ubegrenset antall medlemmer</li>
              <li>Planlegg flere arrangementer samtidig</li>
              <li>Gjelder alle flokkene du eier – medlemmene betaler ingenting</li>
            </ul>
            <p className="text-sm text-[#f2efe8]/75">Månedlig, årlig eller livstid. Kjøpes i iPhone-appen.</p>
          </div>
        </div>
      </section>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/hjelp" className="hover:text-foreground hover:underline">
          Hjelp
        </Link>
        {" · "}
        <Link href="/personvern" className="hover:text-foreground hover:underline">
          Personvern
        </Link>
        {" · "}
        <Link href="/vilkar" className="hover:text-foreground hover:underline">
          Vilkår
        </Link>
      </p>
    </main>
  );
}
