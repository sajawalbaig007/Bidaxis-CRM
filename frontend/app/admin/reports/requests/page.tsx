"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import API, { apiErrorMessage } from "@/lib/api";
import { getAuthMe, peekAuthMe } from "@/lib/authMeCache";
import type { StaffRequestItem } from "@/app/components/StaffRequestButton";
import TechnicalPageShell from "@/app/technical/components/TechnicalPageShell";
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

const FILTER_LABEL: Record<Filter, string> = {
  pending: "Pending",
  approved: "Approved",
  declined: "Rejected",
  all: "All",
};

const CARD =
  "rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)]";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function RequestMessage({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);

  return (
    <div className="mt-1 min-w-0 max-w-full">
      <p
        ref={ref}
        className={`text-xs leading-4 text-slate-500 break-words dark:text-slate-400 ${open ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {overflows || open ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className="mt-0.5 text-[11px] font-semibold text-[#B8112D] hover:underline"
        >
          {open ? "View less" : "View more"}
        </button>
      ) : null}
    </div>
  );
}

export default function EmployeeRequestsPage() {
  const pathname = usePathname();
  const onTechnical = pathname.startsWith("/technical");
  const [role, setRole] = useState(() => peekAuthMe()?.role ?? "");
  const chief = onTechnical && role === "technical_manager";
  const canApprove = pathname.startsWith("/admin") || pathname.startsWith("/manager") || chief;
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<RequestRow | null>(null);
  const [savingId, setSavingId] = useState("");
  const seen = useRef(new Set<string>());
  const primed = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get("/attendance/requests", {
        params: {
          from: "2000-01-01",
          to: "2100-01-01",
          ...(onTechnical ? { department: "estimator" } : {}),
        },
      });
      const list = (res.data.requests ?? []) as RequestRow[];
      setRows(list);
      setError("");
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load requests."));
    } finally {
      setLoading(false);
    }
  }, [onTechnical]);

  const changeStatus = async (row: RequestRow, status: string) => {
    if (!canApprove || status === row.status) return;
    const action = status === "approved" ? "approve" : status === "declined" ? "decline" : "reopen";
    setSavingId(row.id);
    setError("");
    try {
      await API.post(`/attendance/requests/${row.id}/review`, { action });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Could not update this status."));
    } finally {
      setSavingId("");
    }
  };

  useEffect(() => {
    void getAuthMe().then((user) => setRole(user?.role ?? ""));
  }, []);

  useEffect(() => {
    if (onTechnical && !role) return;
    if (onTechnical && role !== "technical_manager") {
      setLoading(false);
      setError("Estimator requests are reviewed by the Chief Estimator.");
      return;
    }
    void load();
    const timer = window.setInterval(() => void load(), 20000);
    return () => window.clearInterval(timer);
  }, [load, onTechnical, role]);

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
  const approved = rows.filter((row) => row.status === "approved").length;
  const rejected = rows.filter((row) => row.status === "declined").length;

  const list = (
    <>
      <section className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {[
          { label: "Pending", value: pending, accent: "#D97706" },
          { label: "Approved", value: approved, accent: "#059669" },
          { label: "Rejected", value: rejected, accent: "#B8112D" },
        ].map((tile) => (
          <div key={tile.label} className={`${CARD} relative p-3 sm:p-4`}>
            <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ background: tile.accent }} />
            <p className="pl-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{tile.label}</p>
            <p className="pl-2 mt-1 text-2xl font-extrabold tabular-nums text-[#0F172A] dark:text-white">{tile.value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl sm:rounded-[28px] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)] dark:border-crm-border dark:bg-crm-surface">
      <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`h-10 px-4 rounded-2xl text-xs font-semibold ${
              filter === key
                ? "bg-[#B8112D] text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 dark:bg-transparent dark:text-gray-300 dark:border-crm-border"
            }`}
          >
            {FILTER_LABEL[key]}
          </button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-gray-400 inline-flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading requests…
        </p>
      ) : error ? (
        <p className="mx-3 mb-3 rounded-2xl border border-red-100 bg-[#FFF1F3] px-4 py-3 text-sm text-[#B8112D] sm:mx-4">{error}</p>
      ) : visible.length === 0 ? (
        <p className="mx-3 mb-3 rounded-2xl border border-dashed border-gray-200 bg-[#F8FAFC] px-4 py-8 text-center text-sm text-gray-400 dark:bg-[#0B1220] dark:border-crm-border sm:mx-4">
          {filter === "all" ? "No requests yet." : `No ${FILTER_LABEL[filter].toLowerCase()} requests.`}
        </p>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100 dark:border-white/5">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead className="bg-[#B8112D]">
              <tr>
                {["Employee", "Department", "Request", "Date", "Detail", "Status"].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-white/90">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.id}
                  tabIndex={0}
                  onClick={() => {
                    seen.current.add(row.id);
                    setActive(row);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    seen.current.add(row.id);
                    setActive(row);
                  }}
                  className="cursor-pointer border-b border-slate-100/90 last:border-0 even:bg-slate-50/50 hover:bg-[#F8FBFF] hover:shadow-[inset_3px_0_0_#B8112D] transition-colors dark:border-white/5 dark:even:bg-white/[0.02] dark:hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FFF1F3] text-[11px] font-bold text-[#B8112D]">
                        {initials(row.personName)}
                      </span>
                      <p className="font-semibold text-[#0F172A] dark:text-white truncate">{row.personName}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:bg-white/10 dark:text-slate-300">
                      {DEPT_LABEL[row.department] ?? row.department}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-[#0F172A] dark:text-white">{row.kindLabel}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums text-slate-500">{row.day}</td>
                  <td className="px-4 py-3 w-[16rem] max-w-[16rem]">
                    <p className="truncate text-slate-600 dark:text-slate-300">{row.summary || "—"}</p>
                    {row.detail && row.detail !== row.summary ? <RequestMessage text={row.detail} /> : null}
                  </td>
                  <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                    {canApprove ? (
                      <select
                        value={row.status}
                        disabled={savingId === row.id}
                        onChange={(event) => void changeStatus(row, event.target.value)}
                        className={`h-8 rounded-lg border px-2 text-[11px] font-bold uppercase tracking-wide outline-none ${
                          row.status === "approved"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : row.status === "declined"
                              ? "border-[#FECACA] bg-[#FFF1F3] text-[#B8112D]"
                              : "border-amber-200 bg-amber-50 text-amber-800"
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="declined">Rejected</option>
                      </select>
                    ) : (
                      <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                        row.status === "approved"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : row.status === "declined"
                            ? "border border-[#FECACA] bg-[#FFF1F3] text-[#B8112D]"
                            : "border border-amber-200 bg-amber-50 text-amber-800"
                      }`}>
                        {row.status === "declined" ? "Rejected" : row.status === "approved" ? "Approved" : "Pending"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>
      {active ? (
        <RequestDecisionDialog
          row={active}
          canApprove={canApprove}
          onClose={() => setActive(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </>
  );

  if (onTechnical) {
    return (
      <TechnicalPageShell>
        <div className="w-full px-3 sm:px-5 lg:px-6 xl:px-8 py-4 sm:py-6 space-y-4">
          <header>
            <Link href="/technical/reports" className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-gray-200 bg-white px-3 text-xs font-semibold text-[#B8112D] shadow-sm dark:border-crm-border dark:bg-crm-surface">
              <ArrowLeft size={14} /> Reports
            </Link>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#B8112D]/80">Chief Estimator · Reports</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-crm-text">Employee requests</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-crm-text-muted">
              Leave, attendance corrections, and other requests waiting for a decision.
            </p>
          </header>
          {list}
        </div>
      </TechnicalPageShell>
    );
  }

  return (
    <ReportsSubpage
      title="Employee requests"
      subtitle="Leave, attendance corrections, and other requests from every department show up here."
    >
      {list}
    </ReportsSubpage>
  );
}
