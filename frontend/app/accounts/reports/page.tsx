"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, FileDown, FileText, Loader2, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import AccountsSidebar from "../components/layout/Sidebar";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { currency } from "../types";

type CategoryGroup = {
  name: string;
  total: number;
  lines: { label: string; amount: number }[];
};

type MonthlyReport = {
  month: string;
  totals: {
    revenue: number;
    payroll: number;
    opex: number;
    loans: number;
    pf: number;
    totalCost: number;
    netProfit: number;
  };
  history: { month: string; revenue: number; cost: number; net: number }[];
  salaryTeams: CategoryGroup[];
  opexHeads: CategoryGroup[];
  loanHeads: CategoryGroup[];
  pfHeads: CategoryGroup[];
  executives: {
    name: string;
    basic: number;
    commissionPct: number;
    commission: number;
    total: number;
    loanPositive: number;
    loanNegative: number;
    remarks: string;
  }[];
  cash: {
    banks: { bank: string; balance: number }[];
    monthNet: number;
    closingNet: number;
    asOf: string | null;
  };
  csr: { totalProjects: number; rows: { name: string; projects: number; share: number }[] };
  daysRecorded: number;
};

function currentMonthIso(): string {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  if (!y || !mm) return m;
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function monthShort(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  if (!y || !mm) return m;
  const name = new Date(Date.UTC(y, mm - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${name} '${String(y).slice(2)}`;
}

const pkr = (n: number) => `PKR ${currency(n)}`;
const signed = (n: number) => `${n >= 0 ? "+" : "–"}PKR ${currency(Math.abs(n))}`;

/** Auto commentary: streak + month-over-month movement. */
function buildInsights(report: MonthlyReport) {
  const idx = report.history.findIndex(h => h.month === report.month);
  const prev = idx > 0 ? report.history[idx - 1] : null;
  const net = report.totals.netProfit;

  let lossStreak = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (report.history[i].net < 0) lossStreak++;
    else break;
  }
  let profitStreak = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (report.history[i].net >= 0) profitStreak++;
    else break;
  }

  const profitNote =
    net >= 0
      ? lossStreak > 0
        ? `1st profit month after ${lossStreak} straight loss${lossStreak > 1 ? "es" : ""}`
        : "Profit month"
      : profitStreak > 0
        ? `Loss after ${profitStreak} profitable month${profitStreak > 1 ? "s" : ""}`
        : "Loss month";

  return {
    prev,
    profitNote,
    revenueVsPrev: prev ? report.totals.revenue - prev.revenue : null,
    costVsPrev: prev ? report.totals.totalCost - prev.cost : null,
    netVsPrev: prev ? net - prev.net : null,
  };
}

/** Word-compatible HTML document for the full report. */
function buildWordHtml(report: MonthlyReport): string {
  const label = monthLabel(report.month);
  const ins = buildInsights(report);
  const th = `style="background:#B8112D;color:#fff;padding:6px 8px;text-align:left;font-size:11px;"`;
  const td = `style="padding:5px 8px;border:1px solid #ddd;font-size:11px;"`;
  const tdR = `style="padding:5px 8px;border:1px solid #ddd;font-size:11px;text-align:right;"`;
  const sub = `style="padding:4px 8px 4px 24px;border:1px solid #eee;font-size:10px;color:#555;"`;
  const subR = `style="padding:4px 8px;border:1px solid #eee;font-size:10px;color:#555;text-align:right;"`;
  const h2 = `style="font-size:14px;color:#B8112D;margin:22px 0 8px;"`;

  const historyRows = report.history
    .map(
      h => `<tr>
        <td ${td}>${monthShort(h.month)}${h.month === report.month ? " (this report)" : ""}</td>
        <td ${tdR}>${currency(h.revenue)}</td>
        <td ${tdR}>${currency(h.cost)}</td>
        <td ${tdR}>${signed(h.net)}</td>
        <td ${td}>${h.net >= 0 ? "Profit" : "Loss"}</td>
      </tr>`,
    )
    .join("");
  const histTotal = report.history.reduce(
    (a, h) => ({ revenue: a.revenue + h.revenue, cost: a.cost + h.cost, net: a.net + h.net }),
    { revenue: 0, cost: 0, net: 0 },
  );

  const categoryRows = (groups: CategoryGroup[]) =>
    groups
      .map(g => {
        const head = `<tr>
          <td ${td}><b>${g.name}</b></td>
          <td ${tdR}><b>${currency(g.total)}</b></td>
        </tr>`;
        const lines = g.lines
          .map(l => `<tr><td ${sub}>– ${l.label}</td><td ${subR}>${currency(l.amount)}</td></tr>`)
          .join("");
        return head + lines;
      })
      .join("");

  const catSection = (title: string, groups: CategoryGroup[], total: number) => `
    <h2 ${h2}>${title}</h2>
    <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
      <tr><th ${th}>Head</th><th ${th} style="text-align:right;">Amount (PKR)</th></tr>
      ${categoryRows(groups)}
      <tr><td ${td}><b>TOTAL</b></td><td ${tdR}><b>${currency(total)}</b></td></tr>
    </table>`;

  const execRows = report.executives
    .map(
      e => `<tr>
        <td ${td}>${e.name}</td>
        <td ${tdR}>${currency(e.basic)}</td>
        <td ${tdR}>${e.commissionPct}%</td>
        <td ${tdR}>${currency(e.commission)}</td>
        <td ${tdR}><b>${currency(e.total)}</b></td>
        <td ${tdR}>${currency(e.loanPositive)}</td>
        <td ${tdR}>${currency(e.loanNegative)}</td>
        <td ${td}>${e.remarks || "—"}</td>
      </tr>`,
    )
    .join("");

  const csrRows = report.csr.rows
    .map(
      r => `<tr>
        <td ${td}>${r.name}</td>
        <td ${tdR}>${r.projects}</td>
        <td ${tdR}>${r.share.toFixed(1)}%</td>
        <td ${td}>${r.share >= 30 ? "Top Performer" : r.projects > 0 ? "Active" : "Below Expectation"}</td>
      </tr>`,
    )
    .join("");

  const cashRows = report.cash.banks
    .map(b => `<tr><td ${td}>${b.bank}</td><td ${tdR}>${currency(b.balance)}</td></tr>`)
    .join("");

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>BEM Executive Summary ${label}</title></head>
<body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a;">
  <p style="font-size:10px;color:#888;margin:0;">BEM SOLUTIONS | Executive Summary | ${label} | Confidential</p>
  <h1 style="font-size:20px;margin:6px 0 2px;color:#0F172A;">BEM SOLUTIONS</h1>
  <p style="font-size:12px;margin:0 0 16px;color:#B8112D;"><b>Executive Summary Report | Month of ${label} | Confidential</b></p>

  <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
    <tr><th ${th}>Metric</th><th ${th} style="text-align:right;">Value</th><th ${th}>Note</th></tr>
    <tr><td ${td}><b>${monthShort(report.month)} Revenue</b></td><td ${tdR}>${pkr(report.totals.revenue)}</td><td ${td}>${ins.revenueVsPrev != null ? `${signed(ins.revenueVsPrev)} vs previous month` : "—"}</td></tr>
    <tr><td ${td}><b>Total Cost</b></td><td ${tdR}>${pkr(report.totals.totalCost)}</td><td ${td}>${ins.costVsPrev != null ? `${signed(ins.costVsPrev)} vs previous month` : "—"}</td></tr>
    <tr><td ${td}><b>Net Profit</b></td><td ${tdR}>${signed(report.totals.netProfit)}</td><td ${td}>${ins.profitNote}</td></tr>
    <tr><td ${td}><b>Cash (Net)</b></td><td ${tdR}>${pkr(report.cash.closingNet)}</td><td ${td}>As of ${report.cash.asOf ?? "—"} · month movement ${signed(report.cash.monthNet)}</td></tr>
    <tr><td ${td}><b>Payroll</b></td><td ${tdR}>${pkr(report.totals.payroll)}</td><td ${td}>OPEX ${pkr(report.totals.opex)} · Loans ${pkr(report.totals.loans)} · PF ${pkr(report.totals.pf)}</td></tr>
    <tr><td ${td}><b>Days Recorded</b></td><td ${tdR}>${report.daysRecorded}</td><td ${td}>Daily income statement entries in ${label}</td></tr>
  </table>

  <h2 ${h2}>1. Financial Performance — Month by Month</h2>
  <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
    <tr><th ${th}>Month</th><th ${th} style="text-align:right;">Revenue (PKR)</th><th ${th} style="text-align:right;">Total Cost (PKR)</th><th ${th} style="text-align:right;">Net P/L (PKR)</th><th ${th}>Status</th></tr>
    ${historyRows}
    <tr><td ${td}><b>TOTAL</b></td><td ${tdR}><b>${currency(histTotal.revenue)}</b></td><td ${tdR}><b>${currency(histTotal.cost)}</b></td><td ${tdR}><b>${signed(histTotal.net)}</b></td><td ${td}></td></tr>
  </table>

  <h2 ${h2}>2. Cash Position${report.cash.asOf ? ` — as of ${report.cash.asOf}` : ""}</h2>
  <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
    <tr><th ${th}>Account</th><th ${th} style="text-align:right;">Balance (PKR)</th></tr>
    ${cashRows || `<tr><td ${td} colspan="2">No cash flow entries recorded.</td></tr>`}
    <tr><td ${td}><b>TOTAL AVAILABLE CASH (NET)</b></td><td ${tdR}><b>${currency(report.cash.closingNet)}</b></td></tr>
  </table>

  <h2 ${h2}>3. CSR Team Performance — ${label}</h2>
  <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
    <tr><th ${th}>CSR</th><th ${th} style="text-align:right;">Projects</th><th ${th} style="text-align:right;">Share %</th><th ${th}>Status</th></tr>
    ${csrRows || `<tr><td ${td} colspan="4">No completed projects recorded this month.</td></tr>`}
    <tr><td ${td}><b>TOTAL</b></td><td ${tdR}><b>${report.csr.totalProjects}</b></td><td ${tdR}><b>100%</b></td><td ${td}></td></tr>
  </table>

  ${catSection("4. Team Salaries — Cost Breakdown", report.salaryTeams, report.totals.payroll)}
  ${catSection("5. Operating Expenses", report.opexHeads, report.totals.opex)}
  ${catSection("6. Loans", report.loanHeads, report.totals.loans)}
  ${catSection("7. Provident Fund", report.pfHeads, report.totals.pf)}

  <h2 ${h2}>8. Executive Salaries — ${label}</h2>
  <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;">
    <tr><th ${th}>Executive</th><th ${th} style="text-align:right;">Basic (PKR)</th><th ${th} style="text-align:right;">Comm. %</th><th ${th} style="text-align:right;">Commission (PKR)</th><th ${th} style="text-align:right;">Total (PKR)</th><th ${th} style="text-align:right;">Loan +ve</th><th ${th} style="text-align:right;">Loan −ve</th><th ${th}>Remarks</th></tr>
    ${execRows || `<tr><td ${td} colspan="8">No executive salary entries this month.</td></tr>`}
  </table>

  <p style="font-size:10px;color:#888;margin-top:24px;">Generated from CRM Accounts · ${new Date().toISOString().slice(0, 10)} · Confidential</p>
</body></html>`;
}

function downloadWord(report: MonthlyReport) {
  const html = buildWordHtml(report);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `BEM-Executive-Summary-${monthLabel(report.month).replace(" ", "-")}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100/90 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#FFF8F9] to-white">
        <h2 className="font-extrabold text-gray-800 text-sm tracking-tight">{title}</h2>
      </div>
      {children}
    </div>
  );
}

const thCls = "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400";
const tdCls = "px-3 py-2 text-xs";

function CategoryTable({ groups, total }: { groups: CategoryGroup[]; total: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-130">
        <thead className="bg-[#FAFBFC]">
          <tr className="border-b border-gray-200/80">
            <th className={`${thCls} text-left`}>Head</th>
            <th className={`${thCls} text-right w-40`}>Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr><td colSpan={2} className="px-3 py-6 text-center text-gray-400 text-xs">No entries this month.</td></tr>
          ) : (
            groups.map(g => (
              <FragmentRows key={g.name} group={g} />
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#B8112D]/20 bg-[#B8112D]/5">
            <td className="px-3 py-2.5 font-extrabold text-gray-800 text-xs">TOTAL</td>
            <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-[#B8112D] text-xs">{currency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FragmentRows({ group }: { group: CategoryGroup }) {
  return (
    <>
      <tr className="border-b border-gray-50 bg-white">
        <td className={`${tdCls} font-bold text-gray-800`}>{group.name}</td>
        <td className={`${tdCls} text-right font-bold tabular-nums text-gray-900`}>{currency(group.total)}</td>
      </tr>
      {group.lines.map(l => (
        <tr key={`${group.name}-${l.label}`} className="border-b border-gray-50 bg-[#FCFCFD]">
          <td className="px-3 py-1.5 pl-8 text-[11px] text-gray-500">– {l.label}</td>
          <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-gray-500">{currency(l.amount)}</td>
        </tr>
      ))}
    </>
  );
}

export default function AccountsReportsPage() {
  const [month, setMonth] = useState<string>(currentMonthIso());
  const [result, setResult] = useState<{ month: string; report: MonthlyReport | null } | null>(null);

  // Loading is derived — true until the fetched result matches the selected month
  const loading = result?.month !== month;
  const report = result?.month === month ? result.report : null;

  useEffect(() => {
    let cancelled = false;
    API.get(`/accounts/reports/monthly?month=${month}`)
      .then(res => {
        if (!cancelled) setResult({ month, report: res.data as MonthlyReport });
      })
      .catch(err => {
        if (!cancelled) {
          toast.error(apiErrorMessage(err, "Failed to load monthly report."));
          setResult({ month, report: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const ins = report ? buildInsights(report) : null;
  const label = monthLabel(month);

  const kpis = report
    ? [
        { label: `${monthShort(month)} Revenue`, value: pkr(report.totals.revenue), note: ins?.revenueVsPrev != null ? `${signed(ins.revenueVsPrev)} vs prev month` : "No previous month data", cls: "from-[#0B84F3] to-[#0369A1]" },
        { label: "Total Cost", value: pkr(report.totals.totalCost), note: ins?.costVsPrev != null ? `${signed(ins.costVsPrev)} vs prev month` : `Payroll ${pkr(report.totals.payroll)}`, cls: "from-[#B8112D] to-[#8b0d22]" },
        { label: "Net Profit", value: signed(report.totals.netProfit), note: ins?.profitNote ?? "", cls: report.totals.netProfit >= 0 ? "from-[#12B76A] to-[#027A48]" : "from-[#F59E0B] to-[#B45309]" },
        { label: "Cash (Net)", value: pkr(report.cash.closingNet), note: report.cash.asOf ? `As of ${report.cash.asOf}` : "No cash flow entries", cls: "from-[#0D9488] to-[#0F766E]" },
        { label: "Cash Movement (Month)", value: signed(report.cash.monthNet), note: "Cash flow rows dated in this month", cls: "from-[#6D28D9] to-[#4C1D95]" },
        { label: "Days Recorded", value: String(report.daysRecorded), note: `Daily entries in ${label}`, cls: "from-[#0F172A] to-[#334155]" },
      ]
    : [];

  return (
    <div className="flex min-h-screen bg-[radial-gradient(ellipse_at_top,_#F8FAFC_0%,_#EEF1F7_45%,_#E8ECF4_100%)]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="max-w-[1200px] mx-auto px-3 sm:px-5 py-5 space-y-4">
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100/90 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.1)] px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-[#B8112D] text-white inline-flex items-center justify-center shadow-md shadow-[#B8112D]/25">
                  <FileText size={16} />
                </span>
                <div>
                  <h1 className="font-extrabold text-gray-900 text-base sm:text-lg tracking-tight leading-none">
                    Executive Summary Report
                  </h1>
                  <p className="text-[11px] text-gray-400 mt-1">
                    BEM Solutions · Month of {label} · Confidential
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-gray-200 bg-[#F8FAFC] text-xs font-bold text-gray-600">
                <CalendarDays size={14} className="text-[#B8112D]" />
                <input
                  type="month"
                  value={month}
                  max={currentMonthIso()}
                  onChange={e => setMonth(e.target.value || currentMonthIso())}
                  className="bg-transparent outline-none text-sm font-semibold text-gray-800"
                />
              </label>
              <button
                type="button"
                disabled={!report || loading}
                onClick={() => report && downloadWord(report)}
                className="h-10 px-4 rounded-xl bg-[#2B579A] text-white text-xs font-bold inline-flex items-center gap-2 hover:bg-[#1e4278] disabled:opacity-50 transition-colors shadow-md shadow-[#2B579A]/25"
                title="Download as Word document"
              >
                <FileDown size={15} />
                Save to Word
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-gray-100/90 py-24 flex flex-col items-center justify-center gap-3 text-gray-400">
              <Loader2 size={28} className="animate-spin text-[#B8112D]" />
              <p className="text-sm font-semibold">Building {label} report…</p>
            </div>
          ) : !report ? (
            <div className="bg-white rounded-2xl border border-gray-100/90 py-24 text-center text-gray-400 text-sm">
              Report load nahi hui — month select karein ya dobara try karein.
            </div>
          ) : (
            <>
              <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
                {kpis.map(k => (
                  <div key={k.label} className={`bg-gradient-to-br ${k.cls} rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-white shadow-md`}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/75 leading-snug">{k.label}</p>
                    <p className="text-base sm:text-lg font-extrabold mt-1.5 tabular-nums tracking-tight">{k.value}</p>
                    <p className="text-[9px] text-white/60 mt-1 font-medium leading-snug">{k.note}</p>
                  </div>
                ))}
              </section>

              <SectionCard title="1. Financial Performance — Month by Month">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-160">
                    <thead className="bg-[#FAFBFC]">
                      <tr className="border-b border-gray-200/80">
                        <th className={`${thCls} text-left`}>Month</th>
                        <th className={`${thCls} text-right`}>Revenue (PKR)</th>
                        <th className={`${thCls} text-right`}>Total Cost (PKR)</th>
                        <th className={`${thCls} text-right`}>Net P/L (PKR)</th>
                        <th className={`${thCls} text-center w-24`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.history.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400 text-xs">No income statement records yet.</td></tr>
                      ) : (
                        report.history.map(h => (
                          <tr
                            key={h.month}
                            className={`border-b border-gray-50 ${h.month === report.month ? "bg-[#FFF6F8]" : "bg-white"}`}
                          >
                            <td className={`${tdCls} font-bold text-gray-800`}>
                              {monthShort(h.month)}
                              {h.month === report.month && <span className="ml-2 text-[9px] font-bold text-[#B8112D] uppercase">This report</span>}
                            </td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(h.revenue)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(h.cost)}</td>
                            <td className={`${tdCls} text-right font-bold tabular-nums ${h.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{signed(h.net)}</td>
                            <td className={`${tdCls} text-center`}>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${h.net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                {h.net >= 0 ? "Profit" : "Loss"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="2. Net Profit / Loss Trend">
                <div className="p-4">
                  <RechartsBox height={230}>
                    <BarChart data={report.history.map(h => ({ name: monthShort(h.month), net: h.net }))} barSize={30}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={v => pkr(Number(v ?? 0))} />
                      <Bar dataKey="net" radius={[8, 8, 0, 0]}>
                        {report.history.map(h => (
                          <Cell key={h.month} fill={h.net >= 0 ? "#12B76A" : "#EF4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </RechartsBox>
                  <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-[#B8112D] shrink-0" />
                    {label}: {signed(report.totals.netProfit)} net — {ins?.profitNote}.
                    {ins?.netVsPrev != null && ` Swing vs previous month: ${signed(ins.netVsPrev)}.`}
                  </p>
                </div>
              </SectionCard>

              <SectionCard title={`3. Cash Position${report.cash.asOf ? ` — as of ${report.cash.asOf}` : ""}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-100">
                    <thead className="bg-[#FAFBFC]">
                      <tr className="border-b border-gray-200/80">
                        <th className={`${thCls} text-left`}>Account</th>
                        <th className={`${thCls} text-right w-44`}>Balance (PKR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.cash.banks.length === 0 ? (
                        <tr><td colSpan={2} className="px-3 py-6 text-center text-gray-400 text-xs">No cash flow entries recorded.</td></tr>
                      ) : (
                        report.cash.banks.map(b => (
                          <tr key={b.bank} className="border-b border-gray-50">
                            <td className={`${tdCls} font-semibold text-gray-700`}>{b.bank}</td>
                            <td className={`${tdCls} text-right tabular-nums font-semibold`}>{currency(b.balance)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#0D9488]/25 bg-[#0D9488]/5">
                        <td className="px-3 py-2.5 font-extrabold text-gray-800 text-xs">TOTAL AVAILABLE CASH (NET)</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-[#0D9488] text-xs">{currency(report.cash.closingNet)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title={`4. CSR Team Performance — ${label}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-120">
                    <thead className="bg-[#FAFBFC]">
                      <tr className="border-b border-gray-200/80">
                        <th className={`${thCls} text-left`}>CSR</th>
                        <th className={`${thCls} text-right`}>Projects</th>
                        <th className={`${thCls} text-right`}>Share %</th>
                        <th className={`${thCls} text-center w-36`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.csr.rows.length === 0 ? (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400 text-xs">No completed projects recorded this month.</td></tr>
                      ) : (
                        report.csr.rows.map(r => (
                          <tr key={r.name} className="border-b border-gray-50">
                            <td className={`${tdCls} font-semibold text-gray-700`}>{r.name}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{r.projects}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{r.share.toFixed(1)}%</td>
                            <td className={`${tdCls} text-center`}>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                r.share >= 30
                                  ? "bg-emerald-50 text-emerald-700"
                                  : r.projects > 0
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-red-50 text-red-600"
                              }`}>
                                {r.share >= 30 ? "Top Performer" : r.projects > 0 ? "Active" : "Below Expectation"}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-[#FAFBFC]">
                        <td className="px-3 py-2.5 font-extrabold text-gray-800 text-xs">TOTAL</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{report.csr.totalProjects}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">100%</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title={`5. Team Salaries — Cost Breakdown (${pkr(report.totals.payroll)})`}>
                <CategoryTable groups={report.salaryTeams} total={report.totals.payroll} />
              </SectionCard>

              <SectionCard title={`6. Operating Expenses (${pkr(report.totals.opex)})`}>
                <CategoryTable groups={report.opexHeads} total={report.totals.opex} />
              </SectionCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title={`7. Loans (${pkr(report.totals.loans)})`}>
                  <CategoryTable groups={report.loanHeads} total={report.totals.loans} />
                </SectionCard>
                <SectionCard title={`8. Provident Fund (${pkr(report.totals.pf)})`}>
                  <CategoryTable groups={report.pfHeads} total={report.totals.pf} />
                </SectionCard>
              </div>

              <SectionCard title={`9. Executive Salaries — ${label}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-200">
                    <thead className="bg-[#FAFBFC]">
                      <tr className="border-b border-gray-200/80">
                        <th className={`${thCls} text-left`}>Executive</th>
                        <th className={`${thCls} text-right`}>Basic (PKR)</th>
                        <th className={`${thCls} text-right`}>Comm. %</th>
                        <th className={`${thCls} text-right`}>Commission (PKR)</th>
                        <th className={`${thCls} text-right`}>Total (PKR)</th>
                        <th className={`${thCls} text-right`}>Loan +ve</th>
                        <th className={`${thCls} text-right`}>Loan −ve</th>
                        <th className={`${thCls} text-left`}>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.executives.length === 0 ? (
                        <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-400 text-xs">No executive salary entries this month.</td></tr>
                      ) : (
                        report.executives.map(e => (
                          <tr key={e.name} className="border-b border-gray-50">
                            <td className={`${tdCls} font-semibold text-gray-700`}>{e.name}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(e.basic)}</td>
                            <td className={`${tdCls} text-right tabular-nums text-indigo-600 font-bold`}>{e.commissionPct}%</td>
                            <td className={`${tdCls} text-right tabular-nums text-emerald-700`}>{currency(e.commission)}</td>
                            <td className={`${tdCls} text-right tabular-nums font-bold text-[#B8112D]`}>{currency(e.total)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(e.loanPositive)}</td>
                            <td className={`${tdCls} text-right tabular-nums text-red-600`}>{currency(e.loanNegative)}</td>
                            <td className={`${tdCls} text-gray-500 max-w-45 truncate`} title={e.remarks || undefined}>{e.remarks || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <p className="text-center text-[10px] text-gray-400 pb-6">
                Generated from CRM Accounts daily records · {label} · Confidential
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
