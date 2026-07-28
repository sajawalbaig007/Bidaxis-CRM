"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, Headphones, BarChart3, Wrench, Wallet } from "lucide-react";
import { PORTAL_OPTIONS } from "@/lib/loginRole";
import DevToolsGuard from "@/app/components/DevToolsGuard";
import ThemeToggle from "@/app/components/ThemeToggle";

const PORTAL_ICONS = {
  admin: LayoutDashboard,
  manager: BarChart3,
  csr: Headphones,
  technical_manager: Wrench,
  accounts: Wallet,
} as const;

export default function HomeLandingPage() {
  return (
    <>
      <DevToolsGuard />
      <div className="min-h-[100dvh] relative flex items-center justify-center p-3 sm:p-6 md:p-8 overflow-x-hidden overflow-y-auto">
        <div
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            backgroundImage:
              "linear-gradient(160deg, rgba(15,23,42,0.75) 0%, rgba(74,6,18,0.65) 45%, rgba(184,17,45,0.55) 100%), url('/images/image.png')",
          }}
        />
        <div className="absolute inset-0 backdrop-blur-[22px] bg-[#0F172A]/40" />

        <div className="absolute top-4 right-4 z-20">
          <ThemeToggle className="!w-10 !h-10 rounded-xl shadow-sm bg-white/10 border border-white/20 text-white" />
        </div>

        <div className="relative z-10 w-full max-w-[720px] text-center px-1 sm:px-0">
          <div className="inline-flex bg-white dark:bg-crm-surface rounded-2xl px-5 sm:px-6 py-3 shadow-2xl mb-5 sm:mb-8">
            <Image src="/images/logo.jpeg" alt="BEM Solutions" width={160} height={48} className="object-contain h-9 sm:h-12 w-auto" style={{ width: "auto", height: "auto" }} />
          </div>

          <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-black tracking-tight drop-shadow-sm">
            CRM Dashboard
          </h1>
          <p className="text-white/70 text-xs sm:text-sm md:text-base mt-2 mb-6 sm:mb-10 max-w-md mx-auto px-2">
            Select your role to sign in. Each portal uses separate credentials.
          </p>

          <div className="grid grid-cols-2 grid-rows-3 gap-2.5 sm:gap-3 max-w-[640px] mx-auto">
            {PORTAL_OPTIONS.map(opt => {
              const Icon = PORTAL_ICONS[opt.value];
              const isLastAlone = opt.value === "accounts";
              return (
                <Link
                  key={opt.value}
                  href={`/login/${opt.value}`}
                  className={`group flex items-center gap-2.5 sm:gap-3 w-full px-3 sm:px-4 py-3 sm:py-4 rounded-xl sm:rounded-2xl bg-white/95 dark:bg-crm-surface/95 hover:bg-white dark:hover:bg-crm-surface backdrop-blur-sm border border-white/30 dark:border-crm-border shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 text-left ${
                    isLastAlone ? "col-span-2 max-w-[320px] sm:max-w-[340px] justify-self-center" : ""
                  }`}
                >
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#FFF1F3] dark:bg-[#B8112D]/20 text-[#B8112D] flex items-center justify-center shrink-0 group-hover:bg-[#B8112D] group-hover:text-white transition-colors">
                    <Icon size={18} className="sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] sm:text-[15px] font-bold text-crm-text leading-tight">{opt.label}</p>
                    <p className="text-[10px] sm:text-[11px] text-crm-text-muted mt-0.5 line-clamp-2 leading-snug">{opt.hint}</p>
                  </div>
                  <ArrowRight size={16} className="text-[#B8112D] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              );
            })}
          </div>

          <p className="text-white/40 text-[11px] mt-8 tracking-wide">BEM Solutions · Secured access</p>
        </div>
      </div>
    </>
  );
}
