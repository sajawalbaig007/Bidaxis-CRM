"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import API, { apiErrorMessage } from "@/lib/api";
import type { StaffRequestItem } from "@/app/components/StaffRequestButton";
import ReportsSubpage from "../ReportsSubpage";
import RequestDecisionDialog from "./RequestDecisionDialog";

const DEPT_LABEL: Record<string, string> = {
  csr: "CSR",
  estimator: "Estimator",
  chief_estimator: "Chief Estimator",
  admin: "Admin",
  accounts: "Accounts",
  dev: "Dev",
  office_boy: "Office Boy",
  hr: "HR",
  bim_modeler: "BIM Modeler",
};

type RequestRow = StaffRequestItem & { createdAt?: string };

const FILTERS = ["pending", "approved", "declined", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default function EmployeeRequestsPage() {
  const pathname = usePathname();
  const canApprove = pathname.startsWith("/admin");
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<RequestRow | null>(null);
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get("/attendance/requests", { params: { from: "2000-01-01", to: "2100-01-01" } });
      setRows(res.data.requests ?? []);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load requests."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!canApprove || active || loading) return;
    const pending = rows.filter((row) => row.status === "pending");
    const newestOf = (list: RequestRow[]) =>
      [...list].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")))[0];
    if (!primed.current) {
      primed.current = true;
      for (const row of pending) seen.current.add(row.id);
      const newest = newestOf(pending);
      if (newest) setActive(newest);
      return;
    }
    const fresh = newestOf(pending.filter((row) => !seen.current.has(row.id)));
    if (!fresh) return;
    seen.current.add(fresh.id);
    setActive(fresh);
  }, [rows, canApprove, active, loading]);

  const visible = useMemo(
    () => rows.filter((row) => filter === "all" || row.status === filter),
    [rows, filter],
  );
  const pending = rows.filter((row) => row.status === "pending").length;

  return (
    <ReportsSubpage
      title="Employee requests"
      subtitle="Leave, attendance corrections, and other requests from every department show up here."
    >
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`h-9 px-3 rounded-full text-xs font-semibold capitalize ${
              filter === key ? "bg-[#B8112D] text-white" : "bg-white text-gray-600 border border-gray-200 dark:bg-crm-surface dark:text-gray-300 dark:border-crm-border"
            }`}
          >
            {key}{key === "pending" ? ` · ${pending}` : ""}
          </button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-gray-400 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading requests…
        </p>
      ) : error ? (
        <p className="rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm text-red-600">{error}</p>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400 dark:bg-crm-surface dark:border-crm-border">
          {filter === "all" ? "No requests yet." : `No ${filter} requests.`}
        </p>
      ) : (
        <div className="grid gap-3">
          {visible.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                seen.current.add(row.id);
                setActive(row);
              }}
              className="rounded-2xl border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 text-left shadow-[0_10px_40px_-28px_rgba(15,23,42,0.45)]"
            >
              <div className="min-w-0 flex items-center gap-3">
                <span className={`h-10 w-1.5 rounded-full ${row.status === "approved" ? "bg-emerald-500" : row.status === "declined" ? "bg-red-500" : "bg-amber-400"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] dark:text-white">{row.personName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {row.kindLabel} · {DEPT_LABEL[row.department] ?? row.department} · {row.day}
                  </p>
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-500">
                {row.status === "declined" ? "Rejected" : row.status === "approved" ? "Approved" : "Review"}
              </span>
            </button>
          ))}
        </div>
      )}
      {active ? (
        <RequestDecisionDialog
          row={active}
          canApprove={canApprove}
          onClose={() => setActive(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </ReportsSubpage>
  );
}
