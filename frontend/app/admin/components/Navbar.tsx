// ===============================
// components/admin/DashboardNavbar.tsx
// ===============================

"use client";

import {
  Bell,
  Search,
  ShieldCheck,
  
} from "lucide-react";

import { useRouter } from "next/navigation";

export default function DashboardNavbar() {
  const router = useRouter();

  return (
    <>
      {/* ================= DESKTOP NAVBAR ================= */}

      <div className="hidden lg:flex items-center justify-between gap-4 mb-6">

        {/* SEARCH */}
        <div className="relative w-[320px]">

          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          />

          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"
          />

        </div>

        {/* RIGHT */}
        <div className="flex items-center gap-4">

          {/* SCRAPER BUTTON */}
          <button
            onClick={() =>
              router.push("/admin/scraper")
            }
            className="bg-[#B8112D] hover:bg-[#a30f27] transition-all text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm"
          >
            Scraper Panel
          </button>

         

          {/* NOTIFICATION */}
          <div className="w-10 h-10 rounded-2xl bg-white border border-gray-200 flex items-center justify-center cursor-pointer hover:border-[#B8112D] transition-all">

            <Bell
              size={18}
              className="text-gray-600"
            />

          </div>

          {/* PROFILE */}
          <div className="flex items-center gap-3 bg-white border border-gray-200 px-3 py-2 rounded-2xl">

            <div className="w-10 h-10 rounded-full bg-[#B8112D] text-white flex items-center justify-center">

              <ShieldCheck size={18} />

            </div>

            <div>

              <h3 className="text-sm font-semibold text-gray-700">
                BEM Solutions
              </h3>

              <p className="text-xs text-gray-400">
                Administration
              </p>

            </div>

          </div>

        </div>

      </div>
    </>
  );
}