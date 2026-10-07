"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import API, { apiErrorMessage } from "@/lib/api";
import { StaffRequestCell, type StaffRequestItem } from "@/app/components/StaffRequestButton";
import ReportsSubpage from "../ReportsSubpage";

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
            <div key={row.id} className="rounded-2xl border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.45)]">
              <div className="min-w-0 flex items-center gap-3">
                <span className={`h-10 w-1.5 rounded-full ${row.status === "approved" ? "bg-emerald-500" : row.status === "declined" ? "bg-red-500" : "bg-amber-400"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F172A] dark:text-white">{row.personName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {DEPT_LABEL[row.department] ?? row.department} · {row.day}
                  </p>
                </div>
              </div>
              <StaffRequestCell items={[row]} canApprove={canApprove} onChanged={() => void load()} />
            </div>
          ))}
        </div>
      )}
    </ReportsSubpage>
  );
}
