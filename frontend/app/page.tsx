"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
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
  const chipTrackRef = useRef<HTMLDivElement>(null);
  const chipBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [capsule, setCapsule] = useState({ left: 0, width: 0, ready: false });

  const go = useCallback((next: number) => {
    setIndex(((next % PORTALS.length) + PORTALS.length) % PORTALS.length);
  }, []);

  /** Measure active chip — works for any future portal count. */
  const measureCapsule = useCallback(() => {
    const track = chipTrackRef.current;
    const btn = chipBtnRefs.current[index];
    if (!track || !btn) return;
    setCapsule({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
      ready: true,
    });
    // Keep active chip visible when many portals overflow horizontally
    const btnLeft = btn.offsetLeft;
    const btnRight = btnLeft + btn.offsetWidth;
    const viewLeft = track.scrollLeft;
    const viewRight = viewLeft + track.clientWidth;
    if (btnLeft < viewLeft + 8) {
      track.scrollTo({ left: Math.max(0, btnLeft - 16), behavior: "smooth" });
    } else if (btnRight > viewRight - 8) {
      track.scrollTo({ left: btnRight - track.clientWidth + 16, behavior: "smooth" });
    }
  }, [index]);

  useLayoutEffect(() => {
    measureCapsule();
  }, [measureCapsule]);

  useEffect(() => {
    const track = chipTrackRef.current;
    if (!track) return;
    const onResize = () => measureCapsule();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(track);
    window.addEventListener("resize", onResize);
    track.addEventListener("scroll", onResize, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
      track.removeEventListener("scroll", onResize);
    };
  }, [measureCapsule]);

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

            {/* Quick jump chips — sliding glass capsule (scales with future portals) */}
            <div className="border-t border-white/10 bg-black/25 px-2.5 sm:px-3 py-2.5 sm:py-3">
              <div
                ref={chipTrackRef}
                className="relative flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-x-auto scrollbar-none py-0.5"
                style={{ scrollbarWidth: "none" }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-full border border-white/25 backdrop-blur-md transition-[transform,width,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,width]"
                  style={{
                    width: capsule.width,
                    transform: `translateX(${capsule.left}px)`,
                    opacity: capsule.ready ? 1 : 0,
                    background: `linear-gradient(135deg, ${active.accent}ee, ${active.accent}99)`,
                    boxShadow: `0 4px 18px ${active.accent}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
                  }}
                />
                {PORTALS.map((portal, i) => {
                  const ChipIcon = portal.icon;
                  const on = i === index;
                  return (
                    <button
                      key={portal.value}
                      type="button"
                      ref={el => {
                        chipBtnRefs.current[i] = el;
                      }}
                      onClick={() => go(i)}
                      className={`relative z-[1] inline-flex items-center gap-1.5 h-9 px-2.5 sm:px-3.5 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap transition-colors duration-300 shrink-0 ${
                        on ? "text-white" : "text-white/55 hover:text-white/90"
                      }`}
                    >
                      <ChipIcon size={13} className="shrink-0" />
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
