"use client";

import Link from "next/link";
import { Users, Construction } from "lucide-react";
import TechnicalSidebar from "../components/layout/Sidebar";

export default function TechnicalTeamPage() {
  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <TechnicalSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[900px] px-3 sm:px-4 md:px-6 py-10 sm:py-16 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center mb-4">
            <Users size={24} />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">Team Monitoring</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1 max-w-md">
            Team lead & estimator workload visibility — coming in the next build phase.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full">
            <Construction size={12} /> Placeholder
          </div>
          <Link href="/technical" className="mt-6 text-xs sm:text-sm font-semibold text-[#B8112D] hover:underline">
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
