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
import BemWordmark from "@/app/components/BemWordmark";
import GpsLogo from "@/app/components/GpsLogo";

type LandingPortal = {
  value: PortalRole;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
  accent: string;
  /** When set, show brand image instead of lucide icon */
  brandMark?: "gps";
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
    label: "GPS",
    hint: "Projects, revisions, KPI & delivery",
    icon: Wrench,
    accent: "#D97706",
    brandMark: "gps",
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
  const CHIPS_PER_ROW = 5;
  const chipTrackRef = useRef<HTMLDivElement>(null);
  const chipBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [capsule, setCapsule] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const go = useCallback((next: number) => {
    setIndex(((next % PORTALS.length) + PORTALS.length) % PORTALS.length);
  }, []);

  /** Measure active chip — works across wrapped rows when portals > 5. */
  const measureCapsule = useCallback(() => {
    const btn = chipBtnRefs.current[index];
    if (!btn) return;
    setCapsule({
      left: btn.offsetLeft,
      top: btn.offsetTop,
      width: btn.offsetWidth,
      height: btn.offsetHeight,
      ready: true,
    });
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
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
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
      <div className="h-[100dvh] relative flex items-center justify-center px-3 py-3 sm:px-6 sm:py-5 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110 transition-[filter] duration-700"
          style={{
            backgroundImage: `linear-gradient(165deg, rgba(15,23,42,0.9) 0%, ${active.accent}99 48%, rgba(15,23,42,0.78) 100%), url('/images/image.png')`,
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[18px] sm:backdrop-blur-[22px] bg-[#0F172A]/35" />

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

        <div className="relative z-10 w-full max-w-[560px] sm:max-w-[640px] md:max-w-[720px] mx-auto flex flex-col max-h-full">
          <div className="text-center mb-5 sm:mb-7 animate-[fadeUp_0.6s_ease-out] shrink-0">
            <div className="inline-flex items-center justify-center gap-3 sm:gap-4 mb-2.5 sm:mb-3">
              <BrandLogo size="md" className="shrink-0" priority />
              <BemWordmark className="text-[20px] sm:text-[24px] md:text-[28px]" onDark />
            </div>
            <p className="text-white/50 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] mb-1.5">
              Secure portals
            </p>
            <p className="text-white/85 text-[12px] sm:text-[13px] max-w-sm mx-auto px-2 leading-relaxed">
              Pick your dashboard and sign in.
            </p>
          </div>

          <div
            className="rounded-[1.35rem] sm:rounded-[1.75rem] border border-white/20 bg-white/[0.09] backdrop-blur-xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex-1 min-h-0 flex flex-col"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <div className="relative p-4 sm:p-6 md:p-7 flex-1">
              <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5">
                <div className="inline-flex items-center gap-2">
                  <Shield size={13} className="text-white/70" />
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
                    Dashboard preview
                  </p>
                </div>
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
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
                        <div
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0 transition-transform duration-500 overflow-hidden"
                          style={{
                            background: portal.brandMark === "gps"
                              ? "#fff"
                              : `linear-gradient(145deg, ${portal.accent}, ${portal.accent}cc)`,
                            boxShadow: `0 12px 32px ${portal.accent}55`,
                            transform: visible ? "scale(1)" : "scale(0.92)",
                          }}
                        >
                          {portal.brandMark === "gps" ? (
                            <GpsLogo size="md" className="!h-12 !w-12 sm:!h-14 sm:!w-14 drop-shadow-none" />
                          ) : (
                            <PIcon size={32} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-[10px] font-bold uppercase tracking-[0.16em] mb-1.5 drop-shadow-sm"
                            style={{ color: "#fff" }}
                          >
                            <span style={{ color: portal.accent }}>{PORTAL_LOGIN_COPY[portal.value].eyebrow}</span>
                          </p>
                          <h2 className="text-white text-xl sm:text-2xl md:text-[1.75rem] font-black tracking-tight leading-tight drop-shadow-sm">
                            {PORTAL_LOGIN_COPY[portal.value].slides[0]?.title ?? `${portal.label} Dashboard`}
                          </h2>
                          <p className="text-white/80 text-[12px] sm:text-[13px] mt-1.5 leading-relaxed max-w-md">
                            {portal.hint}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 sm:mt-6 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                        <Link
                          href={`/login/${portal.value}`}
                          className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-5 rounded-xl text-white text-sm font-bold transition-all hover:brightness-110 active:scale-[0.98]"
                          style={{
                            background: `linear-gradient(135deg, ${portal.accent}, ${portal.accent}dd)`,
                            boxShadow: `0 8px 24px ${portal.accent}55`,
                          }}
                        >
                          Continue to {portal.label}
                          <ArrowRight size={16} />
                        </Link>
                        <p className="text-[11px] text-white/65 sm:ml-1">
                          Secure portal · separate credentials
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/25 px-2.5 sm:px-3 py-2 sm:py-2.5 shrink-0">
              <div
                ref={chipTrackRef}
                className="relative grid gap-1 sm:gap-1.5"
                style={{ gridTemplateColumns: `repeat(${CHIPS_PER_ROW}, minmax(0, 1fr))` }}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute rounded-full border border-white/25 backdrop-blur-md transition-[transform,width,height,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,width,height]"
                  style={{
                    width: capsule.width,
                    height: capsule.height,
                    transform: `translate(${capsule.left}px, ${capsule.top}px)`,
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
                      className={`relative z-[1] inline-flex w-full items-center justify-center gap-1 sm:gap-1.5 h-9 px-1.5 sm:px-2 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap transition-colors duration-300 min-w-0 ${
                        on ? "text-white" : "text-white/60 hover:text-white/95"
                      }`}
                    >
                      {portal.brandMark === "gps" ? (
                        <span className={`inline-flex shrink-0 rounded-full overflow-hidden ${on ? "bg-white/95" : "bg-white/80"}`}>
                          <GpsLogo size="sm" className="!h-4 !w-4 sm:!h-[18px] sm:!w-[18px] drop-shadow-none" />
                        </span>
                      ) : (
                        <ChipIcon size={13} className="shrink-0" />
                      )}
                      <span className="truncate">{portal.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
