"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  LayoutDashboard,
  Headphones,
  BarChart3,
  Wrench,
  Wallet,
  Shield,
} from "lucide-react";
import type { PortalRole } from "@/lib/loginRole";
import DevToolsGuard from "@/app/components/DevToolsGuard";
import ThemeToggle from "@/app/components/ThemeToggle";

type LandingPortal = {
  value: PortalRole;
  label: string;
  hint: string;
  shortHint: string;
  icon: typeof LayoutDashboard;
  accent: string;
  accentBg: string;
  accentBorder: string;
  /** Grid placement on sm+ (2-col layout) */
  spanFull?: boolean;
};

type PortalSection = {
  id: string;
  title: string;
  subtitle: string;
  portals: LandingPortal[];
};

/** Display order: leadership → operations → finance */
const LANDING_SECTIONS: PortalSection[] = [
  {
    id: "leadership",
    title: "Leadership",
    subtitle: "Admin & management access",
    portals: [
      {
        value: "admin",
        label: "Admin",
        hint: "Full admin dashboard — users, leads, reports",
        shortHint: "Full admin dashboard",
        icon: LayoutDashboard,
        accent: "#B8112D",
        accentBg: "bg-[#FFF1F3] group-hover:bg-[#B8112D]",
        accentBorder: "border-[#B8112D]/20 hover:border-[#B8112D]/40",
      },
      {
        value: "manager",
        label: "Manager",
        hint: "Leads, reports, projects & team overview",
        shortHint: "Leads, reports & projects",
        icon: BarChart3,
        accent: "#7C3AED",
        accentBg: "bg-[#F3EEFF] group-hover:bg-[#7C3AED]",
        accentBorder: "border-[#7C3AED]/20 hover:border-[#7C3AED]/40",
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    subtitle: "Daily client & project work",
    portals: [
      {
        value: "csr",
        label: "CSR",
        hint: "Client calls, leads & daily follow-ups",
        shortHint: "Calls & leads",
        icon: Headphones,
        accent: "#0B84F3",
        accentBg: "bg-[#EAF5FF] group-hover:bg-[#0B84F3]",
        accentBorder: "border-[#0B84F3]/20 hover:border-[#0B84F3]/40",
      },
      {
        value: "technical_manager",
        label: "Technical Manager",
        hint: "TMS — projects, KPI & team monitoring",
        shortHint: "Projects & KPI",
        icon: Wrench,
        accent: "#D97706",
        accentBg: "bg-[#FFF4E5] group-hover:bg-[#D97706]",
        accentBorder: "border-[#D97706]/20 hover:border-[#D97706]/40",
      },
    ],
  },
  {
    id: "finance",
    title: "Finance",
    subtitle: "Statements & assets",
    portals: [
      {
        value: "accounts",
        label: "Accounts",
        hint: "Statements, balance sheet & assets",
        shortHint: "Statements & assets",
        icon: Wallet,
        accent: "#12B76A",
        accentBg: "bg-[#ECFDF3] group-hover:bg-[#12B76A]",
        accentBorder: "border-[#12B76A]/20 hover:border-[#12B76A]/40",
        spanFull: true,
      },
    ],
  },
];

function PortalCard({ portal }: { portal: LandingPortal }) {
  const Icon = portal.icon;
  const isWide = Boolean(portal.spanFull);

  return (
    <Link
      href={`/login/${portal.value}`}
      className={`group relative flex w-full rounded-2xl bg-white/[0.97] dark:bg-crm-surface/95 hover:bg-white dark:hover:bg-crm-surface border-2 ${portal.accentBorder} shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5 sm:hover:-translate-y-1 text-left ${
        isWide
          ? "flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 md:p-6 sm:col-span-2"
          : "flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5 p-4 sm:p-4 md:p-5 min-h-[104px] sm:min-h-[88px]"
      }`}
    >
      <div
        className={`rounded-xl ${portal.accentBg} text-[var(--portal-accent)] group-hover:text-white flex items-center justify-center shrink-0 transition-colors duration-200 ${
          isWide ? "w-12 h-12 sm:w-14 sm:h-14" : "w-11 h-11 sm:w-11 sm:h-11 md:w-12 md:h-12"
        }`}
        style={{ ["--portal-accent" as string]: portal.accent }}
      >
        <Icon size={isWide ? 24 : 22} className="shrink-0" />
      </div>

      <div
        className={`flex-1 min-w-0 flex gap-2 sm:gap-3 ${
          isWide ? "flex-col sm:flex-row sm:items-center" : "flex-col sm:flex-row sm:items-center"
        }`}
      >
        <div className={`flex-1 min-w-0 ${isWide ? "sm:text-left" : ""}`}>
          <p className={`font-extrabold text-crm-text tracking-tight ${isWide ? "text-base sm:text-lg" : "text-[15px] sm:text-base"}`}>
            {portal.label}
          </p>
          <p className="text-[11px] sm:text-xs text-crm-text-muted mt-0.5 line-clamp-2 leading-relaxed">
            <span className="sm:hidden">{portal.shortHint}</span>
            <span className="hidden sm:inline">{portal.hint}</span>
          </p>
        </div>

        <div
          className={`hidden sm:flex items-center justify-center shrink-0 rounded-xl border border-gray-100 group-hover:border-transparent transition-all duration-200 ${
            isWide ? "w-10 h-10 sm:ml-auto" : "w-9 h-9"
          }`}
          style={{ backgroundColor: "transparent" }}
        >
          <ArrowRight
            size={18}
            className="transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white"
            style={{ color: portal.accent }}
          />
        </div>
      </div>

      <div className="flex sm:hidden items-center justify-between pt-2 mt-auto border-t border-gray-100/80">
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: portal.accent }}>
          Sign in
        </span>
        <ArrowRight size={16} style={{ color: portal.accent }} />
      </div>
    </Link>
  );
}

function PortalSectionBlock({ section, showHeader }: { section: PortalSection; showHeader: boolean }) {
  const isSingleWide = section.portals.length === 1 && section.portals[0]?.spanFull;

  return (
    <div className={showHeader ? "space-y-2.5 sm:space-y-3" : ""}>
      {showHeader && (
        <div className="flex items-center gap-2 px-0.5">
          <span className="h-px flex-1 bg-white/15" aria-hidden />
          <div className="text-center shrink-0">
            <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.12em] text-white/55">
              {section.title}
            </p>
            <p className="text-[9px] sm:text-[10px] text-white/35 mt-0.5 hidden sm:block">{section.subtitle}</p>
          </div>
          <span className="h-px flex-1 bg-white/15" aria-hidden />
        </div>
      )}

      <div
        className={`grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5 md:gap-4 ${
          isSingleWide ? "sm:grid-cols-1" : ""
        }`}
      >
        {section.portals.map(portal => (
          <PortalCard key={portal.value} portal={portal} />
        ))}
      </div>
    </div>
  );
}

export default function HomeLandingPage() {
  return (
    <>
      <DevToolsGuard />
      <div className="min-h-[100dvh] relative flex items-center justify-center px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10 md:px-8 md:py-12 overflow-x-hidden overflow-y-auto">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            backgroundImage:
              "linear-gradient(165deg, rgba(15,23,42,0.82) 0%, rgba(74,6,18,0.68) 42%, rgba(184,17,45,0.52) 100%), url('/images/image.png')",
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[18px] sm:backdrop-blur-[24px] bg-[#0F172A]/45" />

        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] sm:top-5 sm:right-5 z-20">
          <ThemeToggle className="!w-10 !h-10 sm:!w-11 sm:!h-11 rounded-xl shadow-lg bg-white/10 border border-white/25 text-white backdrop-blur-sm" />
        </div>

        <div className="relative z-10 w-full max-w-[560px] sm:max-w-[640px] md:max-w-[720px] lg:max-w-[820px] mx-auto">
          <div className="text-center mb-5 sm:mb-7 md:mb-9">
            <div className="inline-flex items-center justify-center bg-white dark:bg-crm-surface rounded-2xl px-4 sm:px-7 py-2.5 sm:py-3.5 shadow-2xl mb-3 sm:mb-5">
              <Image
                src="/images/logo.jpeg"
                alt="BEM Solutions"
                width={180}
                height={52}
                className="object-contain h-8 sm:h-11 md:h-12 w-auto max-w-[min(100%,200px)]"
                style={{ width: "auto", height: "auto" }}
                priority
              />
            </div>
            <h1 className="text-white text-[1.5rem] leading-tight sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-md px-1">
              CRM Dashboard
            </h1>
            <p className="text-white/75 text-[11px] sm:text-sm md:text-base mt-1.5 sm:mt-2 max-w-md mx-auto px-1 leading-relaxed">
              Select your role to sign in. Each portal uses separate credentials.
            </p>
          </div>

          <div className="rounded-[1.25rem] sm:rounded-[1.75rem] border border-white/20 bg-white/[0.08] backdrop-blur-xl p-3 sm:p-5 md:p-6 lg:p-7 shadow-[0_24px_80px_-12px_rgba(0,0,0,0.45)]">
            <div className="flex items-center justify-center gap-2 mb-4 sm:mb-5">
              <Shield size={14} className="text-white/60 shrink-0" />
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.14em] text-white/60">
                Choose your portal
              </p>
            </div>

            <div className="space-y-4 sm:space-y-5 md:space-y-6">
              {LANDING_SECTIONS.map(section => (
                <PortalSectionBlock key={section.id} section={section} showHeader={section.id !== "leadership"} />
              ))}
            </div>

            <p className="mt-4 sm:mt-5 pt-4 border-t border-white/10 text-center text-[10px] sm:text-[11px] text-white/40 leading-relaxed">
              Order: Admin → Manager → CSR → Technical Manager → Accounts
            </p>
          </div>

          <p className="text-center text-white/40 text-[10px] sm:text-[11px] mt-5 sm:mt-7 tracking-wide">
            BEM Solutions · Secured access
          </p>
        </div>
      </div>
    </>
  );
}
