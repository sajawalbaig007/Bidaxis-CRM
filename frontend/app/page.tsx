"use client";

import { useEffect, useState, useCallback } from "react";
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
import { PORTAL_LOGIN_COPY } from "@/lib/loginRole";
import DevToolsGuard from "@/app/components/DevToolsGuard";
import ThemeToggle from "@/app/components/ThemeToggle";
import BrandLogo from "@/app/components/BrandLogo";

type LandingPortal = {
  value: PortalRole;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
  accent: string;
};

const PORTALS: LandingPortal[] = [
  {
    value: "admin",
    label: "Admin",
    hint: "Users, leads, uploads & company reports",
    icon: LayoutDashboard,
    accent: "#B8112D",
  },
  {
    value: "manager",
    label: "Manager",
    hint: "Leads, reports & project oversight",
    icon: BarChart3,
    accent: "#0F766E",
  },
  {
    value: "csr",
    label: "CSR",
    hint: "Calls, follow-ups & client pipeline",
    icon: Headphones,
    accent: "#0B84F3",
  },
  {
    value: "technical_manager",
    label: "Technical",
    hint: "Projects, revisions, KPI & delivery",
    icon: Wrench,
    accent: "#D97706",
  },
  {
    value: "accounts",
    label: "Accounts",
    hint: "Statements, payroll, cash flow & assets",
    icon: Wallet,
    accent: "#12B76A",
  },
];

const SLIDE_MS = 5200;

export default function HomeLandingPage() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const active = PORTALS[index]!;

  const go = useCallback((next: number) => {
    setIndex(((next % PORTALS.length) + PORTALS.length) % PORTALS.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => go(index + 1), SLIDE_MS);
    return () => clearInterval(t);
  }, [index, paused, go]);

  return (
    <>
      <DevToolsGuard />
      <div className="min-h-[100dvh] relative flex items-center justify-center px-3 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-10 overflow-x-hidden overflow-y-auto">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 transition-[filter] duration-700"
          style={{
            backgroundImage: `linear-gradient(165deg, rgba(15,23,42,0.88) 0%, ${active.accent}99 48%, rgba(15,23,42,0.75) 100%), url('/images/image.png')`,
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[18px] sm:backdrop-blur-[22px] bg-[#0F172A]/35" />

        {/* Soft animated orbs */}
        <div
          className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full blur-3xl opacity-40 transition-colors duration-700"
          style={{ background: active.accent }}
        />
        <div
          className="pointer-events-none absolute -bottom-28 -right-10 w-80 h-80 rounded-full blur-3xl opacity-25 transition-colors duration-700"
          style={{ background: active.accent }}
        />

        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] sm:top-5 sm:right-5 z-20">
          <ThemeToggle className="!w-10 !h-10 sm:!w-11 sm:!h-11 rounded-xl shadow-lg bg-white/10 border border-white/25 text-white backdrop-blur-sm" />
        </div>

        <div className="relative z-10 w-full max-w-[560px] sm:max-w-[640px] md:max-w-[720px] mx-auto">
          <div className="text-center mb-5 sm:mb-7 animate-[fadeUp_0.6s_ease-out]">
            <BrandLogo size="lg" className="mb-4 sm:mb-5" priority />
            <p className="text-white/50 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5">
              Secure portals
            </p>
            <p className="text-white/80 text-[12px] sm:text-sm md:text-[15px] max-w-sm mx-auto px-2 leading-relaxed">
              Slide through dashboards — pick yours and sign in.
            </p>
          </div>

          {/* Featured portal slider */}
          <div
            className="rounded-[1.35rem] sm:rounded-[1.75rem] border border-white/20 bg-white/[0.09] backdrop-blur-xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div className="relative min-h-[280px] sm:min-h-[300px] p-5 sm:p-7 md:p-8">
              {/* Progress bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-white/10 overflow-hidden">
                <div
                  key={index}
                  className="h-full origin-left"
                  style={{
                    background: active.accent,
                    animation: paused ? "none" : `slideProgress ${SLIDE_MS}ms linear forwards`,
                    width: paused ? "100%" : undefined,
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-2 mb-5 sm:mb-6">
                <div className="inline-flex items-center gap-2">
                  <Shield size={13} className="text-white/55" />
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
                    Dashboard preview
                  </p>
                </div>
                <p className="text-[10px] sm:text-[11px] font-semibold text-white/45 tabular-nums">
                  {index + 1} / {PORTALS.length}
                </p>
              </div>

              <div className="relative overflow-hidden">
                {PORTALS.map((portal, i) => {
                  const PIcon = portal.icon;
                  const visible = i === index;
                  return (
                    <div
                      key={portal.value}
                      className={`transition-all duration-500 ease-out ${
                        visible
                          ? "relative opacity-100 translate-x-0"
                          : "absolute inset-0 opacity-0 translate-x-6 pointer-events-none"
                      }`}
                      aria-hidden={!visible}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-6">
                        <div
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-transform duration-500"
                          style={{
                            background: `linear-gradient(145deg, ${portal.accent}, ${portal.accent}cc)`,
                            boxShadow: `0 12px 32px ${portal.accent}55`,
                            transform: visible ? "scale(1)" : "scale(0.92)",
                          }}
                        >
                          <PIcon size={32} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5"
                            style={{ color: portal.accent }}
                          >
                            {PORTAL_LOGIN_COPY[portal.value].eyebrow}
                          </p>
                          <h2 className="text-white text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                            {PORTAL_LOGIN_COPY[portal.value].slides[0]?.title ?? `${portal.label} Dashboard`}
                          </h2>
                          <p className="text-white/65 text-[13px] sm:text-sm mt-2 leading-relaxed max-w-md">
                            {portal.hint}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row sm:items-center gap-3">
                        <Link
                          href={`/login/${portal.value}`}
                          className="inline-flex items-center justify-center gap-2 h-12 px-5 rounded-xl text-white text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                          style={{
                            background: `linear-gradient(135deg, ${portal.accent}, ${portal.accent}dd)`,
                            boxShadow: `0 8px 24px ${portal.accent}55`,
                          }}
                        >
                          Continue to {portal.label}
                          <ArrowRight size={16} />
                        </Link>
                        <p className="text-[11px] text-white/40 sm:ml-1">
                          Secure portal · separate credentials
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dot indicators */}
              <div className="mt-7 sm:mt-8 flex items-center justify-center gap-2">
                  {PORTALS.map((p, i) => (
                    <button
                      key={p.value}
                      type="button"
                      aria-label={`Show ${p.label}`}
                      onClick={() => go(i)}
                      className="h-1.5 rounded-full transition-all duration-300"
                      style={{
                        width: i === index ? 28 : 8,
                        background: i === index ? active.accent : "rgba(255,255,255,0.28)",
                      }}
                    />
                  ))}
              </div>
            </div>

            {/* Quick jump chips */}
            <div className="border-t border-white/10 bg-black/20 px-3 sm:px-4 py-3 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max sm:min-w-0 sm:justify-between">
                {PORTALS.map((portal, i) => {
                  const ChipIcon = portal.icon;
                  const on = i === index;
                  return (
                    <button
                      key={portal.value}
                      type="button"
                      onClick={() => go(i)}
                      className={`inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
                        on ? "text-white shadow-md" : "text-white/55 hover:text-white hover:bg-white/10"
                      }`}
                      style={on ? { background: portal.accent } : undefined}
                    >
                      <ChipIcon size={13} />
                      {portal.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-center text-white/40 text-[10px] sm:text-[11px] mt-5 sm:mt-7 tracking-wide">
            BEM Solutions · Secured access
          </p>
        </div>
      </div>
    </>
  );
}
