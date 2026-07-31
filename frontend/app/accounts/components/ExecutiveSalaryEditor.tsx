"use client";

import { computeExecutiveSalary, type EmployeeSalaryDetail } from "../utils/payrollFormula";
import { currency } from "../types";

type Props = {
  name: string;
  value: EmployeeSalaryDetail;
  onChange: (next: EmployeeSalaryDetail) => void;
  /** Net profit (before executive salaries) — commission base */
  profitBase: number;
  teamHint?: string;
};

function Num({
  label,
  value,
  onChange,
  step = "any",
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
  hint?: string;
}) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={e => onChange(Number(e.target.value || 0))}
        className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-sm tabular-nums outline-none focus:border-[#B8112D]"
      />
      {hint && <span className="block mt-0.5 text-[9px] font-normal normal-case tracking-normal text-gray-400">{hint}</span>}
    </label>
  );
}

function Read({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-[#F8FAFC] px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-0.5 text-sm font-bold tabular-nums ${accent ?? "text-gray-800"}`}>{value}</p>
    </div>
  );
}

export default function ExecutiveSalaryEditor({ name, value, onChange, profitBase, teamHint }: Props) {
  const d = value;
  const b = computeExecutiveSalary(d, profitBase);
  const set = <K extends keyof EmployeeSalaryDetail>(key: K, val: EmployeeSalaryDetail[K]) => {
    onChange({ ...d, [key]: val });
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-gray-800">{name || "Executive"}</p>
          {teamHint && <p className="text-[10px] text-gray-400">{teamHint}</p>}
        </div>
        <p className="text-xs font-extrabold text-[#B8112D] tabular-nums">Total Salary: {currency(b.totalSalary)}</p>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-800">Commission (from Net Profit)</p>
        <p className="text-[10px] text-emerald-700/80">
          Commission = % of net profit (revenue − all other expenses). No commission on loss. Remaining profit stays with the company.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Read label="Net Profit (base)" value={currency(b.commissionBase)} />
          <Num label="Commission %" value={d.commissionPct ?? 0} onChange={v => set("commissionPct", v)} step="0.5" />
          <Read label="Commission Amount" value={currency(b.commission)} accent="text-emerald-700" />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Num label="Basic Salary" value={d.basic} onChange={v => set("basic", v)} />
        <Read label="Commission" value={currency(b.commission)} accent="text-emerald-700" />
        <Read label="Total Salary (Basic + Commission)" value={currency(b.totalSalary)} accent="text-[#B8112D]" />
      </div>

      <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-2.5 space-y-2">
        <p className="text-[10px] font-extrabold uppercase tracking-wide text-orange-800">Loan Ledger</p>
        <div className="grid grid-cols-2 gap-2">
          <Num
            label="Loan +ve (company owes them)"
            value={d.loanPositive ?? 0}
            onChange={v => set("loanPositive", v)}
            hint="Loan jo company ne inhe dena hai"
          />
          <Num
            label="Loan −ve (they owe company)"
            value={d.loanNegative ?? 0}
            onChange={v => set("loanNegative", v)}
            hint="Loan jo inho ne company ko dena hai"
          />
        </div>
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Remarks
        <textarea
          value={d.remarks}
          onChange={e => set("remarks", e.target.value)}
          rows={2}
          placeholder="Manual remarks…"
          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none resize-none focus:border-[#B8112D]"
        />
      </label>
    </div>
  );
}
