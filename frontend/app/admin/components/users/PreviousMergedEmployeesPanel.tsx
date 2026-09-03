"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitMerge, Loader2, RefreshCw, Search, Unlink, Users } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import { payrollHeadShortLabel } from "@/app/admin/utils/accountsPayrollHeads";
import type { StaffEmployeeRow } from "./AllEmployeesPanel";

type PreviousRow = {
  id: string;
  previousName: string;
  currentName: string | null;
  currentStaffId: string | null;
  payrollHead: string | null;
  firstSeen: string | null;
  lastSeen: string | null;
  status: "previous" | "merged";
  pfAllTime: number;
  mergedAt: string | null;
};

function money(n: number): string {
  return Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function ymLabel(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.slice(0, 7);
  return m;
}

type Props = {
  currentEmployees: StaffEmployeeRow[];
};

export default function PreviousMergedEmployeesPanel({ currentEmployees }: Props) {
  const [rows, setRows] = useState<PreviousRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [search, setSearch] = useState("");
  const [merging, setMerging] = useState<PreviousRow | null>(null);
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const applyList = (list: PreviousRow[]) => setRows(list);

  const load = useCallback(async (scan: boolean) => {
    if (scan) setScanning(true);
    else setLoading(true);
    try {
      const res = scan
        ? await API.post("/admin/staff-employees/previous/scan")
        : await API.get("/admin/staff-employees/previous?scan=1");
      applyList((res.data?.previous as PreviousRow[]) ?? []);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Failed to load previous employees"));
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      [r.previousName, r.currentName, r.payrollHead]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const previous = filtered.filter(r => r.status !== "merged");
  const merged = filtered.filter(r => r.status === "merged");

  const mergeTargets = useMemo(() => {
    const from = merging?.previousName.trim().toLowerCase();
    return currentEmployees
      .filter(e => e.name.trim() && e.name.trim().toLowerCase() !== from)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentEmployees, merging]);

  const confirmMerge = async () => {
    if (!merging) return;
    const target = mergeTargets.find(e => e.id === targetId);
    if (!target) {
      toast.error("Select a current employee");
      return;
    }
    if (
      !confirm(
        `Merge “${merging.previousName}” into “${target.name}”? All PF under the previous name will count toward ${target.name} All time.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await API.post(`/admin/staff-employees/previous/${merging.id}/merge`, {
        currentStaffId: target.id,
        currentName: target.name,
      });
      applyList((res.data?.previous as PreviousRow[]) ?? []);
      toast.success(`Merged ${merging.previousName} → ${target.name}`);
      setMerging(null);
      setTargetId("");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Merge failed"));
    } finally {
      setSaving(false);
    }
  };

  const unmerge = async (row: PreviousRow) => {
    if (!confirm(`Undo merge of “${row.previousName}” from “${row.currentName}”?`)) return;
    try {
      const res = await API.post(`/admin/staff-employees/previous/${row.id}/unmerge`);
      applyList((res.data?.previous as PreviousRow[]) ?? []);
      toast.success("Merge undone");
    } catch (err) {
      toast.error(apiErrorMessage(err, "Unmerge failed"));
    }
  };

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-start gap-2.5 px-0.5">
        <span className="w-1 h-10 rounded-full bg-[#0F766E] shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold text-[#0F172A] text-sm tracking-tight">
            Previous &amp; merged employees
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
            Names from Accounts Mar–Jul 2026 that are not on the current roster. Merge a previous
            name into a current employee so that person’s PF All time includes everything recorded
            under the old name.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search previous names…"
            className="w-full h-10 pl-10 pr-3 rounded-2xl border border-gray-200 bg-white text-sm outline-none focus:ring-2 focus:ring-[#0F766E]/20"
          />
        </div>
        <button
          type="button"
          disabled={scanning}
          onClick={() => void load(true)}
          className="h-10 px-4 rounded-2xl text-sm font-semibold bg-white border border-gray-200 text-gray-800 hover:bg-gray-50 inline-flex items-center gap-2 disabled:opacity-50"
        >
          {scanning ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
          Scan Accounts (Mar–Jul)
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Previous</p>
          <p className="text-xl font-extrabold text-amber-700 mt-0.5">
            {rows.filter(r => r.status !== "merged").length}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-3.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Merged</p>
          <p className="text-xl font-extrabold text-teal-700 mt-0.5">
            {rows.filter(r => r.status === "merged").length}
          </p>
        </div>
      </div>

      <SectionTable
        title="Previous names"
        empty="No leftover names from Mar–Jul. Scan Accounts if people are missing."
        loading={loading}
        rows={previous}
        merged={false}
        onMerge={row => {
          setMerging(row);
          setTargetId("");
        }}
        onUnmerge={unmerge}
      />

      <SectionTable
        title="Merged"
        empty="No merges yet. Pick a previous name and merge it into the current employee."
        loading={loading}
        rows={merged}
        merged
        onMerge={() => undefined}
        onUnmerge={unmerge}
      />

      {merging && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-extrabold text-[#0F172A] text-sm">Merge previous employee</h3>
              <p className="text-[11px] text-gray-400 mt-1">
                PF recorded as <span className="font-bold text-gray-600">{merging.previousName}</span>
                {merging.pfAllTime ? ` (${money(merging.pfAllTime)})` : ""} will add to the current
                name’s All time.
              </p>
            </div>
            <div className="p-5 space-y-3">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Merge into current employee
              </label>
              <select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                className="w-full h-11 rounded-2xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#0F766E]/20"
              >
                <option value="">Select employee…</option>
                {mergeTargets.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.payrollHead ? ` · ${payrollHeadShortLabel(e.payrollHead)}` : ""}
                  </option>
                ))}
              </select>
              {mergeTargets.length === 0 && (
                <p className="text-xs text-amber-700">Add the new-name employee to All Employees first.</p>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMerging(null);
                  setTargetId("");
                }}
                className="flex-1 h-10 rounded-2xl text-sm font-bold bg-gray-50 text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !targetId}
                onClick={() => void confirmMerge()}
                className="flex-1 h-10 rounded-2xl text-sm font-bold bg-[#0F766E] text-white hover:bg-[#0d5f58] disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <GitMerge size={15} />}
                Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionTable({
  title,
  empty,
  loading,
  rows,
  merged,
  onMerge,
  onUnmerge,
}: {
  title: string;
  empty: string;
  loading: boolean;
  rows: PreviousRow[];
  merged: boolean;
  onMerge: (row: PreviousRow) => void;
  onUnmerge: (row: PreviousRow) => void;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 bg-[#FAFBFC]">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-white border-b border-gray-100">
              <th className="px-5 py-3">Previous name</th>
              {merged && <th className="px-4 py-3">Merged into</th>}
              <th className="px-4 py-3">Seen</th>
              <th className="px-4 py-3 text-right">PF (old name)</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [1, 2].map(i => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="px-5 py-4" colSpan={merged ? 5 : 4}>
                    <div className="h-9 bg-gray-100 rounded-xl animate-pulse" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={merged ? 5 : 4} className="px-5 py-12 text-center">
                  <Users size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">{empty}</p>
                </td>
              </tr>
            ) : (
              rows.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-[#FAFBFC]">
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-[#0F172A]">{r.previousName}</p>
                    {r.payrollHead && (
                      <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                        {payrollHeadShortLabel(r.payrollHead)}
                      </p>
                    )}
                  </td>
                  {merged && (
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-1 rounded-lg bg-teal-50 text-teal-800 text-[11px] font-bold">
                        {r.currentName || "—"}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {ymLabel(r.firstSeen)} → {ymLabel(r.lastSeen)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-800">
                    {money(r.pfAllTime)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {merged ? (
                      <button
                        type="button"
                        onClick={() => onUnmerge(r)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold text-gray-600 bg-gray-50 hover:bg-gray-100 inline-flex items-center gap-1.5"
                      >
                        <Unlink size={13} />
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onMerge(r)}
                        className="h-8 px-3 rounded-xl text-[11px] font-bold text-white bg-[#0F766E] hover:bg-[#0d5f58] inline-flex items-center gap-1.5"
                      >
                        <GitMerge size={13} />
                        Merge
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
