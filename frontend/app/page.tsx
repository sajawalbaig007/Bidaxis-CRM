"use client";

import Link from "next/link";
import { ArrowRight, Building2, Shield } from "lucide-react";
import DevToolsGuard from "@/app/components/DevToolsGuard";
import BrandLogo from "@/app/components/BrandLogo";
import BemWordmark from "@/app/components/BemWordmark";
import GpsLogo from "@/app/components/GpsLogo";
import GpsWordmark from "@/app/components/GpsWordmark";
import CompanyPortalChrome from "@/app/components/CompanyPortalChrome";
import { COMPANY_META, type PortalCompany } from "@/lib/companyGate";

const CARDS: PortalCompany[] = ["BEM", "GPS"];

export default function HomeLandingPage() {
  return (
    <>
      <DevToolsGuard />
      <CompanyPortalChrome company="both">
        <div className="text-center mb-5 sm:mb-8 shrink-0 animate-[fadeUp_0.6s_ease-out]">
          <p className="text-white/50 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] mb-2">
            Secure company portals
          </p>
          <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-black tracking-tight">
            Choose your company
          </h1>
          <p className="text-white/80 text-[13px] sm:text-[14px] mt-2 max-w-md mx-auto leading-relaxed">
            Sign in with company credentials, then open the matching dashboards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 min-h-0">
          {CARDS.map(key => {
            const c = COMPANY_META[key];
            return (
              <Link
                key={key}
                href={`/company/${c.slug}`}
                className="group rounded-[1.5rem] sm:rounded-[1.85rem] border border-white/20 bg-white/[0.09] backdrop-blur-xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.5)] p-5 sm:p-7 flex flex-col min-h-[240px] sm:min-h-[300px] transition-all hover:-translate-y-0.5 hover:bg-white/[0.13] hover:border-white/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white flex items-center justify-center shadow-lg overflow-hidden"
                    style={{ boxShadow: `0 12px 32px ${c.accent}55` }}
                  >
                    {key === "BEM" ? (
                      <BrandLogo size="sm" className="!m-0 drop-shadow-none h-11 w-11" />
                    ) : (
                      <GpsLogo size="sm" className="drop-shadow-none h-11 w-11" />
                    )}
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/80 px-2.5 py-1 rounded-full border border-white/15"
                    style={{ background: `${c.accent}33` }}
                  >
                    <Building2 size={11} />
                    {c.key}
                  </span>
                </div>

                <div className="mt-5 sm:mt-6 text-left">
                  {key === "BEM" ? (
                    <BemWordmark className="text-[18px] sm:text-[22px] justify-start" onDark />
                  ) : (
                    <div className="items-start text-left">
                      <GpsWordmark onDark className="items-start" />
                    </div>
                  )}
                  <p className="text-white/75 text-[13px] sm:text-[14px] mt-3 leading-relaxed">
                    {c.tagline}
                  </p>
                  <p className="text-white/55 text-[11px] sm:text-[12px] mt-1.5 font-medium">
                    {c.portalsLabel}
                  </p>
                </div>

                <div className="mt-auto pt-6 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-white/60">
                    <Shield size={12} />
                    Company login required
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-white text-sm font-bold group-hover:brightness-110"
                    style={{
                      background: `linear-gradient(135deg, ${c.accent}, ${c.accent}dd)`,
                      boxShadow: `0 8px 24px ${c.accent}44`,
                    }}
                  >
                    Continue
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </CompanyPortalChrome>
    </>
  );
}
