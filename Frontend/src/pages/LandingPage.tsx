import { useNavigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Users, LogIn, Activity } from "lucide-react";
import landingBackground from "@/assets/zpcs-landing-background.jpeg";

const zpcsGold = "#D7A928";

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#f7f8f3] text-[#102018]">
      <section
        className="relative min-h-[86vh] overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${landingBackground})` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#062f1a]/95 via-[#0b4f2a]/70 to-[#0b4f2a]/15" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f7f8f3] to-transparent" />

        <header className="relative z-10 border-b border-white/15 bg-[#0b4f2a]/70 backdrop-blur-sm">
          <div className="container mx-auto flex items-center justify-between px-4 py-5">
          <div className="flex items-center space-x-3">
              <div className="rounded-md border border-[#d7a928]/70 bg-[#d7a928] p-2 text-[#0b4f2a]">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#f4dc8a]">
                  Zimbabwe Prisons and Correctional Services
                </p>
                <h1 className="text-2xl font-semibold text-white">PrisonMS</h1>
              </div>
            </div>

            <Button
              onClick={() => navigate("/login")}
              className="border border-[#d7a928] bg-[#d7a928] font-semibold text-[#0b4f2a] hover:bg-[#efc84a]"
            >
              <LogIn className="mr-2 h-4 w-4" />
              Login
            </Button>
          </div>
        </header>

        <div className="relative z-10 container mx-auto flex min-h-[calc(86vh-81px)] items-center px-4 py-16">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex border-l-4 border-[#d7a928] pl-4 text-sm font-bold uppercase tracking-[0.22em] text-[#f4dc8a]">
              Secure correctional operations
            </p>
            <h2 className="text-5xl font-bold leading-tight text-white md:text-6xl">
              Zimbabwe Prisons and Correctional Services
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/90 md:text-xl">
              A green-and-gold digital workspace for inmate reception, officer
              administration, health services, stores, farms, and station-level
              accountability.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                size="lg"
                onClick={() => navigate("/login")}
                className="bg-[#d7a928] px-8 text-base font-semibold text-[#0b4f2a] hover:bg-[#efc84a]"
              >
                Enter System
                <LogIn className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/login")}
                className="border-white/70 bg-white/10 px-8 text-base font-semibold text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
              >
                Officer Login
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-10 flex flex-col gap-2 border-l-4 border-[#d7a928] pl-5">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#0b4f2a]">
              Key Modules
            </p>
            <h2 className="text-3xl font-bold text-[#102018]">
              Built around station workflows
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Users className="h-10 w-10" />}
              title="Inmate Management"
              description="Comprehensive inmate record management including admission, discharge, classification, and transfers."
            />
            <FeatureCard
              icon={<Shield className="h-10 w-10" />}
              title="Officer Administration"
              description="Manage prison staff, assign roles, and track performance across different departments."
            />
            <FeatureCard
              icon={<Activity className="h-10 w-10" />}
              title="Health and Rehabilitation"
              description="Track health records, OPD activity, stores, farms, and rehabilitation workflows from one system."
            />
          </div>
        </div>
      </section>

      <footer className="bg-[#0b4f2a] py-8 text-white">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-white/85">
            © 2026 Prison Management System. Zimbabwe Prisons and Correctional Services.
          </p>
        </div>
      </footer>
    </div>
  );
};

// Feature Card Component
const FeatureCard = ({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) => (
  <div className="rounded-md border border-[#0b4f2a]/15 bg-white p-6 shadow-sm">
    <div
      className="mb-5 inline-flex rounded-md p-3 text-[#0b4f2a]"
      style={{ backgroundColor: `${zpcsGold}33` }}
    >
      {icon}
    </div>
    <h3 className="mb-2 text-xl font-semibold text-[#0b4f2a]">{title}</h3>
    <p className="leading-7 text-[#3d4b42]">{description}</p>
  </div>
);

export default LandingPage;
