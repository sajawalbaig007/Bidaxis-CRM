"use client";

import { Suspense } from "react";
import TechnicalSidebar from "../components/layout/Sidebar";
import { TechnicalActiveProjectsPageInner } from "../active-projects/page";

export default function TechnicalRevisionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-[#F5F6FA]">
          <TechnicalSidebar />
          <main className="flex-1 min-w-0 p-6 mt-16">
            <div className="h-10 w-48 bg-gray-100 rounded-xl animate-pulse mb-4" />
            <div className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          </main>
        </div>
      }
    >
      <TechnicalActiveProjectsPageInner variant="revisions" />
    </Suspense>
  );
}
