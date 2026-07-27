"use client";

import Link from "next/link";
import { FileText, Construction } from "lucide-react";
import TechnicalSidebar from "../components/layout/Sidebar";

export default function TechnicalReportsPage() {
  return (
    <div className="min-h-screen bg-[#F5F6FA] dark:bg-gray-950">
      <TechnicalSidebar />
      <main className="max-w-[900px] mx-auto p-6 flex flex-col items-center justify-center min-h-[70vh] text-center mt-14 sm:mt-16">
        <div className="w-14 h-14 rounded-2xl bg-[#ECFDF5] text-[#15803D] flex items-center justify-center mb-4">
          <FileText size={24} />
        </div>
        <h1 className="text-2xl font-bold text-[#0F172A] dark:text-gray-100">Reports</h1>
        <p className="text-sm text-gray-500 mt-2 max-w-md">
          Delivered projects, estimated vs actual hours, overtime & monthly productivity — next phase.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full">
          <Construction size={12} /> Placeholder
        </div>
        <Link href="/technical" className="mt-6 text-sm font-semibold text-[#B8112D] hover:underline">
          ← Back to Dashboard
        </Link>
      </main>
    </div>
  );
}
