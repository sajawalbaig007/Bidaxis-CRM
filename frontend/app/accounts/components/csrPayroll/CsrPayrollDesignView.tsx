"use client";

import { useState } from "react";
import { Users, UserCog, Calendar, Save, Upload, Info } from "lucide-react";
import CsrPayrollEmployeePanel from "./CsrPayrollEmployeePanel";
import { MOCK_CSR_TEAM, MOCK_TEAM_LEADS } from "./mockData";
import { fmt } from "./uiHelpers";

type Tab = "csr" | "team_lead";

export default function CsrPayrollDesignView() {
  const [tab, setTab] = useState<Tab>("csr");
  const employees = tab === "csr" ? MOCK_CSR_TEAM : MOCK_TEAM_LEADS;

  const totalNet = employees.reduce((s, e) => {
    const comm =
      e.oldClientProjects * 1000 +
      e.newClientProjects * 3000 +
      e.fixClientProjects.reduce((x, p) => x + p.projectPay * 0.025, 0);
    const earning = e.basicSalary + e.allowance + comm;
    const ded = e.lateDeduction + e.unpaidLeaveDeduction + e.loanThisMonth + e.basicSalary * 0.08 + e.incomeTax;
    const tl = e.assignedCsrs?.filter(a => a.assigned).reduce((x, a) => x + a.tlCommission, 0) ?? 0;
    return s + earning - ded + tl;
  }, 0);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6 space-y-5">
      {/* Hero */}
      <header className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-white/60 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.12)]">
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-[#0B84F3] via-[#6366F1] to-[#7C3AED]" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-5 sm:px-6 py-5">
          <div className="min-w-0 pl-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0B84F3]/80 mb-1">Accounts · Payroll Design</p>
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-extrabold text-[#0F172A] tracking-tight">CSR Payroll</h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 max-w-2xl leading-relaxed">
              Frontend design preview — CSR Team & Team Lead commission, salary, deductions & remarks. No backend wiring yet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pl-2 lg:pl-0">
            <button type="button" className="h-10 px-4 rounded-xl bg-[#F3EEFF] text-[#7C3AED] text-sm font-semibold inline-flex items-center gap-2 opacity-60 cursor-not-allowed">
              <Upload size={16} /> Upload File
            </button>
            <button type="button" className="h-10 px-4 rounded-xl bg-[#B8112D] text-white text-sm font-semibold inline-flex items-center gap-2 opacity-60 cursor-not-allowed shadow-md shadow-[#B8112D]/20">
              <Save size={16} /> Save
            </button>
          </div>
        </div>
      </header>

      {/* Month + tabs */}
      <section className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <label className="text-xs font-semibold text-gray-600">
            <span className="inline-flex items-center gap-1 mb-1"><Calendar size={12} /> Payroll Month</span>
            <input type="month" defaultValue="2026-07" className="mt-1 h-10 w-full sm:w-48 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/20" />
          </label>

          <div className="inline-flex p-1 rounded-2xl bg-[#F4F5F8] border border-gray-100">
            <button
              type="button"
              onClick={() => setTab("csr")}
              className={`h-10 px-4 sm:px-5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all ${
                tab === "csr" ? "bg-[#0B84F3] text-white shadow-md shadow-[#0B84F3]/25" : "text-gray-600 hover:bg-white"
              }`}
            >
              <Users size={16} /> CSR Team
            </button>
            <button
              type="button"
              onClick={() => setTab("team_lead")}
              className={`h-10 px-4 sm:px-5 rounded-xl text-sm font-bold inline-flex items-center gap-2 transition-all ${
                tab === "team_lead" ? "bg-[#7C3AED] text-white shadow-md shadow-[#7C3AED]/25" : "text-gray-600 hover:bg-white"
              }`}
            >
              <UserCog size={16} /> CSR Team Lead
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-2.5 text-[11px] text-blue-800 leading-relaxed">
          <Info size={14} className="shrink-0 mt-0.5" />
          <p>
            {tab === "csr" ? (
              <>
                <strong>CSR Team:</strong> Old client $1,000/project (partial 50%) · New client $3,000 · Fix client 2.5% ·
                Assign to Lead → TL gets $1,000/project (fix client: 0.5% for TL).
              </>
            ) : (
              <>
                <strong>Team Lead:</strong> Own projects (New × $3,000 + Old + Fix 2.5%) plus commission from assigned CSRs
                ($1,000 × their monthly projects; fix client 0.5% for TL).
              </>
            )}
          </p>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Employees", value: String(employees.length), cls: "from-[#EAF5FF] to-white border-[#0B84F3]/20 text-[#0B84F3]" },
          { label: "Total Net (preview)", value: fmt(totalNet), cls: "from-[#ECFDF3] to-white border-emerald-200 text-emerald-700" },
          { label: "Commission Rate (New)", value: "$3,000 / project", cls: "from-[#F3EEFF] to-white border-violet-200 text-violet-700" },
          { label: tab === "csr" ? "Old Client Rate" : "TL Assign Rate", value: tab === "csr" ? "$1,000 / project" : "$1,000 / CSR project", cls: "from-[#FFF1F3] to-white border-[#B8112D]/20 text-[#B8112D]" },
        ].map(c => (
          <div key={c.label} className={`rounded-2xl border bg-gradient-to-br p-4 ${c.cls}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{c.label}</p>
            <p className="text-lg sm:text-xl font-extrabold mt-1 tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      {/* Employee panels */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="text-sm font-extrabold text-gray-800">
            {tab === "csr" ? "CSR Team Members" : "CSR Team Leads"}
          </h2>
          <button type="button" className="h-9 px-3 rounded-xl bg-[#EAF5FF] text-[#0B84F3] text-xs font-bold opacity-60 cursor-not-allowed">
            + Add Employee
          </button>
        </div>

        {employees.map((emp, i) => (
          <CsrPayrollEmployeePanel
            key={emp.id}
            employee={emp}
            variant={tab}
            defaultOpen={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
