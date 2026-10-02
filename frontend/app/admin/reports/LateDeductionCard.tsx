"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";

const PARTS = [
  { id: "basic", label: "Basic" },
  { id: "commission", label: "Commission" },
  { id: "overtime", label: "Overtime" },
  { id: "allowance", label: "Allowance" },
] as const;

type PartId = (typeof PARTS)[number]["id"];

type RangeDraft = { key: string; from: string; to: string; percent: string };

type DeptDraft = {
  department: string;
  label: string;
  components: PartId[];
  ranges: RangeDraft[];
  saved: boolean;
  carriedFrom: string | null;
};

function pktMonth() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function newRange(): RangeDraft {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, from: "", to: "", percent: "" };
}

function statusLine(saved: boolean, carriedFrom: string | null) {
  if (saved) return "Saved for this month";
  if (carriedFrom) return `Keeps ${carriedFrom} until you save this month`;
  return "No ranges yet";
}

export default function LateDeductionCard() {
  const pathname = usePathname();
  const ceo = pathname.startsWith("/admin");
  const [month, setMonth] = useState(pktMonth);
  const [departments, setDepartments] = useState<DeptDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");

  const load = useCallback(async (ym: string) => {
    setLoading(true);
    try {
      const res = await API.get("/attendance/late-deductions", { params: { month: ym } });
      const rows = (res.data.departments ?? []) as {
        department: string;
        label: string;
        components?: string[];
        ranges?: { from: string; to: string; percent: number }[];
        saved?: boolean;
        carriedFrom?: string | null;
      }[];
      setDepartments(rows.map((dept) => ({
        department: dept.department,
        label: dept.label,
        components: PARTS.map((part) => part.id).filter((id) => (dept.components ?? []).includes(id)),
        ranges: (dept.ranges ?? []).map((range, index) => ({
          key: `${dept.department}-${index}-${range.from}-${range.to}`,
          from: range.from,
          to: range.to,
          percent: String(range.percent),
        })),
        saved: !!dept.saved,
        carriedFrom: dept.carriedFrom ?? null,
      })));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load deduction ranges."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ceo) return;
    void load(month);
  }, [ceo, load, month]);

  if (!ceo) return null;

  function patch(department: string, next: Partial<DeptDraft>) {
    setDepartments((list) => list.map((dept) => (dept.department === department ? { ...dept, ...next } : dept)));
  }

  async function save(dept: DeptDraft) {
    setBusy(dept.department);
    try {
      await API.put("/attendance/late-deductions", {
        month,
        department: dept.department,
        components: dept.components,
        ranges: dept.ranges.map((range) => ({
          from: range.from,
          to: range.to,
          percent: Number(range.percent),
        })),
      });
      toast.success("Deduction ranges saved.");
      await load(month);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save deduction ranges."));
    } finally {
      setBusy("");
    }
  }

  async function clear(department: string) {
    setBusy(department);
    try {
      await API.delete("/attendance/late-deductions", { params: { month, department } });
      toast.success("This month’s deduction ranges cleared.");
      await load(month);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not clear deduction ranges."));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] p-4 sm:p-5 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-[#0F172A] dark:text-white text-base sm:text-lg tracking-tight">
            Late deduction
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-2xl">
            Pakistan time, per department. Add as many check-in ranges as you need. Choose basic, commission, overtime, and allowance.
            Per day is those monthly amounts divided by 30, and each range cuts its own percent of that day. A blank end time means from that time onward.
            A month you leave blank keeps the previous month.
          </p>
        </div>
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1.5 text-sm text-[#0F172A] dark:text-white"
          />
        </label>
      </div>

      {loading && departments.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading deduction ranges…
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {departments.map((dept) => {
            const deptBusy = busy === dept.department;
            return (
              <div key={dept.department} className="rounded-xl border border-gray-100 dark:border-crm-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A] dark:text-white">{dept.label}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{statusLine(dept.saved, dept.carriedFrom)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={deptBusy}
                      onClick={() => void save(dept)}
                      className="rounded-lg bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {deptBusy ? "Saving…" : "Save department"}
                    </button>
                    {dept.saved ? (
                      <button
                        type="button"
                        disabled={deptBusy}
                        onClick={() => void clear(dept.department)}
                        className="rounded-lg border border-gray-200 dark:border-crm-border px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 disabled:opacity-50"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  {PARTS.map((part) => {
                    const on = dept.components.includes(part.id);
                    return (
                      <label key={part.id} className="inline-flex items-center gap-1.5 text-xs text-[#0F172A] dark:text-white">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => {
                            const components = on
                              ? dept.components.filter((id) => id !== part.id)
                              : [...dept.components, part.id];
                            patch(dept.department, { components });
                          }}
                        />
                        {part.label}
                      </label>
                    );
                  })}
                </div>

                <div className="mt-3 space-y-2">
                  {dept.ranges.map((range) => (
                    <div key={range.key} className="flex flex-wrap items-end gap-2">
                      <label className="text-[11px] text-gray-500 dark:text-gray-400">
                        From
                        <input
                          type="time"
                          value={range.from}
                          onChange={(e) => patch(dept.department, {
                            ranges: dept.ranges.map((row) => row.key === range.key ? { ...row, from: e.target.value } : row),
                          })}
                          className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1 text-sm text-[#0F172A] dark:text-white"
                        />
                      </label>
                      <label className="text-[11px] text-gray-500 dark:text-gray-400">
                        To
                        <input
                          type="time"
                          value={range.to}
                          onChange={(e) => patch(dept.department, {
                            ranges: dept.ranges.map((row) => row.key === range.key ? { ...row, to: e.target.value } : row),
                          })}
                          className="mt-1 block rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1 text-sm text-[#0F172A] dark:text-white"
                        />
                      </label>
                      <label className="text-[11px] text-gray-500 dark:text-gray-400">
                        Percent
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={range.percent}
                          onChange={(e) => patch(dept.department, {
                            ranges: dept.ranges.map((row) => row.key === range.key ? { ...row, percent: e.target.value } : row),
                          })}
                          className="mt-1 block w-20 rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-[#0B1220] px-2 py-1 text-sm text-[#0F172A] dark:text-white"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label="Remove range"
                        onClick={() => patch(dept.department, { ranges: dept.ranges.filter((row) => row.key !== range.key) })}
                        className="mb-1 rounded-lg p-1.5 text-gray-500 hover:text-[#B8112D]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => patch(dept.department, { ranges: [...dept.ranges, newRange()] })}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#0F172A] dark:text-white"
                  >
                    <Plus size={14} /> Add range
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
