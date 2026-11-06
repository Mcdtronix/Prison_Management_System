import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardCheck,
  Eye,
  FileClock,
  HeartPulse,
  KeyRound,
  Landmark,
  Lock,
  LogIn,
  MapPin,
  MessageSquare,
  Package,
  Shield,
  ShieldCheck,
  Sprout,
  UserCog,
  UserRound,
  Users,
} from "lucide-react";
import landingImage from "@/assets/zpcs-landing-background.jpeg";

/*
 * Public landing page: the only screen anyone sees before signing in.
 * Keep every claim here true to what the system does; officers and auditors
 * read it as a statement of how the system handles their data.
 */

const MODULES = [
  { icon: <ClipboardCheck className="h-5 w-5" />, title: "Reception & admissions",
    text: "Admit inmates, record offences and sentences, and route admissions and discharges for approval." },
  { icon: <Users className="h-5 w-5" />, title: "Inmate records",
    text: "One record per inmate, with classification, reclassification and discharge history in one place." },
  { icon: <HeartPulse className="h-5 w-5" />, title: "Health services",
    text: "Clinic visits, outpatient records and medical history, visible only to authorised health staff." },
  { icon: <UserCog className="h-5 w-5" />, title: "Officers & HR",
    text: "The officer database: postings, ranks, qualifications, courses, dependants and documents." },
  { icon: <Package className="h-5 w-5" />, title: "Stores",
    text: "Stock received, issued and on hand at each station, kept by the stores department." },
  { icon: <Sprout className="h-5 w-5" />, title: "Farms",
    text: "Farm production and activity at each station, recorded by the farms department." },
  { icon: <MessageSquare className="h-5 w-5" />, title: "Internal messaging",
    text: "Messages between departments and stations, with folders, drafts and protected attachments." },
  { icon: <BarChart3 className="h-5 w-5" />, title: "Reports & audit",
    text: "Station reports for management, and an audit trail of every change for oversight." },
];

const SAFEGUARDS = [
  { icon: <KeyRound className="h-5 w-5" />, title: "Role-based access",
    text: "Each officer gets the role their department needs and nothing more." },
  { icon: <MapPin className="h-5 w-5" />, title: "Station-level separation",
    text: "Officers see their own station's records. Provinces see their stations; HQ sees the country." },
  { icon: <FileClock className="h-5 w-5" />, title: "Complete audit trail",
    text: "Account changes, approvals and record edits are logged with who, what and when." },
  { icon: <Eye className="h-5 w-5" />, title: "Separation of duties",
    text: "System administrators manage accounts but cannot open inmate or health records." },
  { icon: <Lock className="h-5 w-5" />, title: "Controlled passwords",
    text: "New accounts start with a one-time password that must be replaced at first sign-in." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Session control",
    text: "Administrators can see who is signed in and end a session immediately if needed." },
];

const LandingPage = () => {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#f6f7f2] text-[#102018] antialiased">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium">
        Skip to content
      </a>

      {/* Official-use notice */}
      <div className="bg-[#063f20] text-[#f4dc8a]">
        <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-medium tracking-wide">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Official system. Authorised correctional services personnel only.</span>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#0b4f2a]/10 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
        <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3" aria-label="Prison Management System, home">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#0b4f2a] text-[#d7a928] shadow-sm">
              <Shield className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b4f2a]/70 sm:block">
                Correctional Services
              </span>
              <span className="block truncate text-sm font-semibold text-[#102018] sm:text-base">Prison Management System</span>
            </span>
          </Link>

          <nav aria-label="Page sections" className="hidden items-center gap-8 text-sm font-medium text-[#3d4b42] md:flex">
            <a href="#modules" className="transition-colors hover:text-[#0b4f2a]">Modules</a>
            <a href="#security" className="transition-colors hover:text-[#0b4f2a]">Security</a>
            <a href="#access" className="transition-colors hover:text-[#0b4f2a]">Getting access</a>
          </nav>

          <Link
            to="/login"
            className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md bg-[#0b4f2a] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#063f20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7a928] focus-visible:ring-offset-2"
          >
            <LogIn className="hidden h-4 w-4 sm:block" aria-hidden />
            Sign in
          </Link>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-white">
          <div className="container mx-auto grid items-center gap-12 px-4 py-14 md:py-20 xl:grid-cols-[1.05fr_1fr] xl:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-[#d7a928]/50 bg-[#d7a928]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7a5d0c]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d7a928]" aria-hidden />
                Integrated correctional operations
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight text-[#0b2a18] sm:text-5xl lg:text-[3.4rem]">
                One secure record for every station, officer and inmate.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-[#3d4b42]">
                Reception, inmate records, health, stores, farms and personnel, run from a single system
                that follows the chain of command from National Headquarters to every station.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-[#0b4f2a] px-7 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#063f20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7a928] focus-visible:ring-offset-2"
                >
                  Sign in with your service number
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a
                  href="#access"
                  className="inline-flex h-12 items-center justify-center whitespace-nowrap rounded-md border border-[#0b4f2a]/20 bg-white px-7 text-base font-semibold text-[#0b4f2a] transition-colors hover:border-[#0b4f2a]/40 hover:bg-[#0b4f2a]/5"
                >
                  How to get access
                </a>
              </div>

              <dl className="mt-12 grid max-w-xl grid-cols-3 divide-x divide-[#0b4f2a]/10 border-y border-[#0b4f2a]/10 py-5">
                <HeroFact term="Access" detail="Role-based" />
                <HeroFact term="Data" detail="Station-scoped" />
                <HeroFact term="Changes" detail="Fully audited" />
              </dl>
            </div>

            <figure className="relative w-full max-w-2xl xl:max-w-none">
              <div className="absolute -inset-3 -z-0 rounded-2xl bg-gradient-to-br from-[#d7a928]/30 via-transparent to-[#0b4f2a]/20 blur-2xl" aria-hidden />
              <div className="relative overflow-hidden rounded-xl border border-[#0b4f2a]/10 shadow-2xl shadow-[#0b4f2a]/15">
                <img
                  src={landingImage}
                  alt="Correctional officers reviewing records on a tablet in a prison courtyard"
                  className="aspect-[4/3] w-full object-cover"
                  loading="eager"
                />
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#062f1a]/85 to-transparent" aria-hidden />
                <figcaption className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-5 text-white">
                  <span>
                    <span className="block text-xs font-semibold uppercase tracking-[0.14em] text-[#f4dc8a]">Station operations</span>
                    <span className="mt-1 block text-sm text-white/90">Records captured where the work happens.</span>
                  </span>
                </figcaption>
              </div>
            </figure>
          </div>
        </section>

        {/* Chain of command */}
        <section className="border-y border-[#0b4f2a]/10 bg-[#f6f7f2]">
          <div className="container mx-auto grid gap-6 px-4 py-10 md:grid-cols-3">
            <Tier icon={<Landmark className="h-5 w-5" />} level="National Headquarters"
              text="Sets up provinces, stations, roles and departments, and oversees the whole service." />
            <Tier icon={<Building2 className="h-5 w-5" />} level="Provincial Commands"
              text="Oversee the stations in their province and appoint each station's system administrators." />
            <Tier icon={<MapPin className="h-5 w-5" />} level="Stations"
              text="Run day-to-day operations. Officers work only with their own station's records." />
          </div>
        </section>

        {/* Modules */}
        <section id="modules" className="scroll-mt-20 bg-white py-20">
          <div className="container mx-auto px-4">
            <SectionHeading
              eyebrow="Modules"
              title="Everything a station runs on, in one place"
              text="Each department works in its own module. Records move between them through approvals, not paperwork."
            />
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-[#0b4f2a]/10 bg-[#0b4f2a]/10 sm:grid-cols-2 lg:grid-cols-4">
              {MODULES.map((m) => (
                <div key={m.title} className="group bg-white p-6 transition-colors hover:bg-[#fbfbf7]">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#0b4f2a]/[0.07] text-[#0b4f2a] transition-colors group-hover:bg-[#d7a928]/20">
                    {m.icon}
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-[#0b2a18]">{m.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#4a5a50]">{m.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="security" className="relative scroll-mt-20 overflow-hidden bg-[#0b4f2a] py-20 text-white">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
            aria-hidden />
          <div className="container relative mx-auto px-4">
            <SectionHeading
              dark
              eyebrow="Security & accountability"
              title="Built for sensitive records"
              text="Inmate, health and personnel records are protected by design, not by policy alone."
            />
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SAFEGUARDS.map((s) => (
                <div key={s.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#d7a928] text-[#0b4f2a]">
                    {s.icon}
                  </span>
                  <h3 className="mt-5 text-base font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/75">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Getting access */}
        <section id="access" className="scroll-mt-20 bg-[#f6f7f2] py-20">
          <div className="container mx-auto grid gap-12 px-4 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
            <div>
              <SectionHeading
                eyebrow="Getting access"
                title="Accounts are issued, not registered"
                text="There is no public sign-up. Every account is created by an authorised system administrator for a named officer."
              />
              <div className="mt-8 rounded-xl border border-[#d7a928]/40 bg-[#d7a928]/10 p-5 text-sm leading-6 text-[#5b4508]">
                <p className="font-semibold text-[#3f3005]">Forgotten your password?</p>
                <p className="mt-1">
                  Contact your station system administrator. They will verify your identity and issue a new one-time password.
                </p>
              </div>
            </div>

            <ol className="space-y-4">
              <Step n={1} icon={<UserRound className="h-5 w-5" />} title="Your administrator creates your account"
                text="Your station's system administrator sets up your account against your service number and gives you the role your department needs." />
              <Step n={2} icon={<KeyRound className="h-5 w-5" />} title="Sign in and set your own password"
                text="Use your service number and the one-time password you are given in person. You will be asked to choose a new password straight away." />
              <Step n={3} icon={<ShieldCheck className="h-5 w-5" />} title="Work within your station"
                text="You will see the modules and records for your role and station. Your actions are recorded in the audit trail." />
            </ol>
          </div>
        </section>

        {/* Final call to action */}
        <section className="bg-white py-16">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-[#0b2a18] px-8 py-10 text-white md:flex-row md:items-center md:px-12">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Ready to start your shift?</h2>
                <p className="mt-2 text-white/70">Sign in with your service number to open your workspace.</p>
              </div>
              <Link
                to="/login"
                className="inline-flex h-12 shrink-0 items-center gap-2 rounded-md bg-[#d7a928] px-7 text-base font-semibold text-[#0b2a18] transition-colors hover:bg-[#e8bd3c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b2a18]"
              >
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#063f20] text-white/70">
        <div className="container mx-auto grid gap-8 px-4 py-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-3 text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#d7a928] text-[#0b4f2a]">
                <Shield className="h-4 w-4" aria-hidden />
              </span>
              <span className="font-semibold">Prison Management System</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6">
              Unauthorised access or use of this system is prohibited. Activity is monitored and recorded,
              and may be used in disciplinary or legal proceedings.
            </p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-2 text-sm md:justify-self-end">
            <a href="#modules" className="hover:text-white">Modules</a>
            <a href="#security" className="hover:text-white">Security</a>
            <a href="#access" className="hover:text-white">Getting access</a>
            <Link to="/login" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="container mx-auto px-4 py-5 text-xs text-white/50">
            © {year} Correctional Services. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

const HeroFact = ({ term, detail }: { term: string; detail: string }) => (
  <div className="px-4 first:pl-0">
    <dt className="text-xs font-medium uppercase tracking-[0.12em] text-[#6b7a70]">{term}</dt>
    <dd className="mt-1 text-sm font-semibold text-[#0b2a18] sm:text-base">{detail}</dd>
  </div>
);

const Tier = ({ icon, level, text }: { icon: ReactNode; level: string; text: string }) => (
  <div className="flex gap-4">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#0b4f2a]/15 bg-white text-[#0b4f2a]">
      {icon}
    </span>
    <div>
      <h3 className="text-sm font-semibold text-[#0b2a18]">{level}</h3>
      <p className="mt-1 text-sm leading-6 text-[#4a5a50]">{text}</p>
    </div>
  </div>
);

const SectionHeading = ({
  eyebrow, title, text, dark = false,
}: { eyebrow: string; title: string; text: string; dark?: boolean }) => (
  <div className="max-w-2xl">
    <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${dark ? "text-[#f4dc8a]" : "text-[#8a6a0f]"}`}>
      {eyebrow}
    </p>
    <h2 className={`mt-3 text-3xl font-bold tracking-tight sm:text-4xl ${dark ? "text-white" : "text-[#0b2a18]"}`}>
      {title}
    </h2>
    <p className={`mt-4 text-base leading-7 ${dark ? "text-white/75" : "text-[#4a5a50]"}`}>{text}</p>
  </div>
);

const Step = ({ n, icon, title, text }: { n: number; icon: ReactNode; title: string; text: string }) => (
  <li className="flex gap-5 rounded-xl border border-[#0b4f2a]/10 bg-white p-6 shadow-sm">
    <div className="flex flex-col items-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b4f2a] text-[#d7a928]">{icon}</span>
    </div>
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6a0f]">Step {n}</p>
      <h3 className="mt-1 text-base font-semibold text-[#0b2a18]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#4a5a50]">{text}</p>
    </div>
  </li>
);

export default LandingPage;
