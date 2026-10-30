"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LANDING_PORTALS } from "@/lib/landingPortals";
import DevToolsGuard from "@/app/components/DevToolsGuard";
import ThemeToggle from "@/app/components/ThemeToggle";

export default function BidAxisPortalPicker() {
  return (
    <>
      <DevToolsGuard />
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(165deg, #071833 0%, #0E3A86 48%, #1B6FE8 100%)",
          }}
        />
        <div className="pointer-events-none absolute -top-24 -left-16 h-72 w-72 rounded-full bg-[#5B9BFF] opacity-30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-10 h-80 w-80 rounded-full bg-[#123A8C] opacity-50 blur-3xl" />

        <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))] z-20">
          <ThemeToggle className="!h-10 !w-10 rounded-xl border border-white/25 bg-white/10 text-white shadow-lg backdrop-blur-sm sm:!h-11 sm:!w-11" />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-4xl">
          <div className="mb-8 text-center sm:mb-10">
            <div className="mb-4 inline-flex items-center justify-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[22px] font-black text-[#1B6FE8] shadow-lg">
                B
              </span>
              <p className="text-left leading-none">
                <span className="block text-[26px] font-black tracking-tight text-white sm:text-[30px]">
                  Bid<span className="text-[#8EBEFF]">Axis</span>
                </span>
                <span className="mt-1 block text-[11px] font-bold tracking-[0.22em] text-white/60">.CO</span>
              </p>
            </div>
            <p className="text-[13px] text-white/80 sm:text-[15px]">
              Choose your dashboard to sign in
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {LANDING_PORTALS.map((portal) => {
              const Icon = portal.icon;
              return (
                <Link
                  key={portal.value}
                  href={`/login/${portal.value}`}
                  className="group flex flex-col rounded-2xl border border-white/15 bg-white/[0.08] p-4 shadow-[0_16px_40px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.14]"
                >
                  <span
                    className="mb-3 grid h-11 w-11 place-items-center rounded-xl text-white"
                    style={{
                      background: `linear-gradient(145deg, ${portal.accent}, ${portal.accent}cc)`,
                      boxShadow: `0 8px 20px ${portal.accent}44`,
                    }}
                  >
                    <Icon size={20} />
                  </span>
                  <h2 className="text-[16px] font-bold text-white">{portal.label}</h2>
                  <p className="mt-1 min-h-[2.5rem] text-[12px] leading-relaxed text-white/65">
                    {portal.hint}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#8EBEFF] group-hover:text-white">
                    Sign in
                    <ArrowRight size={14} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
