"use client";

import { Fragment, useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, Cloud, ExternalLink, Loader2,
  Sparkles, TrendingUp, Wallet, Building2, Activity, PieChart as PieIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import { estCurrentMonthValue, formatEstDateTime } from "@/lib/estTime";
import AccountsSidebar from "../components/layout/Sidebar";
import { ACCOUNTS_MAIN_OFFSET } from "../components/layout/headerOffset";
import AccountsChartCard, { CHART_COLORS } from "../components/AccountsChartCard";
import { bankColor } from "../components/accountsTheme";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { currency } from "../types";
import { useScrollToHash } from "../hooks/useScrollToHash";
import { STAFF_PAGE_PAD, BENTO_CARD } from "@/lib/staffPageLayout";

type CategoryGroup = {
  name: string;
  total: number;
  lines: { label: string; amount: number }[];
};

type SalaryFieldTable = {
  name: string;
  kind: string;
  total: number;
  filledAt?: string;
  columns: string[];
  rows: { employee: string; cells: (string | number)[] }[];
};

type OpexFieldTable = {
  name: string;
  amount: number;
  filledAt: string;
  notes: string;
  lines: { label: string; amount: number; filledAt: string; proofName: string }[];
};

type MonthlyReport = {
  month: string;
  sourceDate?: string | null;
  monthEnd?: string;
  mode?: string;
  totals: {
    revenue: number;
    payroll: number;
    opex: number;
    loans: number;
    pf: number;
    totalCost: number;
    netProfit: number;
  };
  revenueChannels?: {
    key: string;
    label: string;
    usd: number;
    cad: number;
    pkr: number;
    netPkr: number;
  }[];
  history: { month: string; revenue: number; cost: number; net: number; days?: number; lastDate?: string }[];
  salaryTeams: CategoryGroup[];
  salaryTables?: SalaryFieldTable[];
  opexHeads: CategoryGroup[];
  opexTables?: OpexFieldTable[];
  loanHeads: CategoryGroup[];
  loanTables?: OpexFieldTable[];
  pfHeads: CategoryGroup[];
  pfTables?: OpexFieldTable[];
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
    banks: { bank: string; balance: number; debit?: number; credit?: number }[];
    sections?: { name: string; net: number }[];
    monthNet: number;
    closingNet: number;
    monthEntries?: number;
    asOf: string | null;
    ledger?: {
      section: string;
      date: string;
      description: string;
      banks: { bank: string; debit: number; credit: number }[];
      debit: number;
      credit: number;
      net: number;
    }[];
  };
  csr: {
    totalProjects: number;
    totals: {
      oldProjects: number;
      partialCount: number;
      newProjects: number;
      fixProjects: number;
      fixPay: number;
      oldComm: number;
      newComm: number;
      fixComm: number;
      totalCommission: number;
    };
    rows: {
      name: string;
      code: string;
      role: "sales" | "team_lead";
      roleLabel: string;
      assignedToLead: boolean;
      oldProjects: number;
      partialCount: number;
      newProjects: number;
      fixProjects: number;
      fixPay: number;
      projects: number;
      oldComm: number;
      newComm: number;
      fixComm: number;
      totalCommission: number;
      share: number;
      status?: string;
      note?: string;
      fixClients?: { clientName: string; projectPay: number; currency: string }[];
    }[];
  };
  daysRecorded: number;
  budgetCompare?: {
    hasBudget: boolean;
    rows: {
      key: string;
      name: string;
      kind: "core" | "opex_head";
      budget: number;
      actual: number;
      variance: number;
    }[];
    totals: {
      budgetRevenue: number;
      actualRevenue: number;
      budgetExpense: number;
      actualExpense: number;
      variance: number;
    };
  };
};

type SavedMonthlyReport = {
  id: string;
  month: string;
  fileName: string;
  fileUrl: string;
  sourceDate: string | null;
  createdAt: string;
  totals?: MonthlyReport["totals"] | null;
};

function currentMonthIso(): string {
  return estCurrentMonthValue();
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

function monthNameOnly(m: string): string {
  const [y, mm] = m.split("-").map(Number);
  if (!y || !mm) return m;
  return new Date(Date.UTC(y, mm - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
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

const PIE_COLORS: Record<string, string> = {
  AH: "#E11D48",
  SN: "#0B84F3",
  CO: "#0D9488",
  QH: "#F59E0B",
};

function pieKeyForBank(bank: string): "AH" | "SN" | "CO" | "QH" | null {
  const t = bank.trim().toLowerCase();
  if (t.includes("qasim") || t.includes("cheque") || t.includes("chq") || t.includes("qhm")) return "QH";
  if (/\bah\b/.test(t) || t.includes("ahmed") || t.includes("ah paypal")) return "AH";
  if (/\bsn\b/.test(t) || t.includes("sharjeel")) return "SN";
  if (t.includes("habib") || t.includes("metro")) return "CO";
  return null;
}

function reportPieSlices(report: MonthlyReport): { name: string; value: number; color: string }[] {
  const fromBanks: Record<"AH" | "SN" | "CO" | "QH", number> = { AH: 0, SN: 0, CO: 0, QH: 0 };
  for (const b of report.cash.banks ?? []) {
    const key = pieKeyForBank(b.bank);
    if (!key) continue;
    fromBanks[key] += Number(b.debit) || Math.max(0, Number(b.balance) || 0);
  }
  if (Object.values(fromBanks).some(v => v > 0)) {
    return (["AH", "SN", "CO", "QH"] as const).map(name => ({
      name,
      value: fromBanks[name],
      color: PIE_COLORS[name],
    }));
  }
  const fromRev: Record<"AH" | "SN" | "CO" | "QH", number> = { AH: 0, SN: 0, CO: 0, QH: 0 };
  for (const c of report.revenueChannels ?? []) {
    if (c.key === "AH") fromRev.AH += c.netPkr;
    else if (c.key === "SN") fromRev.SN += c.netPkr;
    else if (c.key === "HM") fromRev.CO += c.netPkr;
    else fromRev.QH += c.netPkr;
  }
  return (["AH", "SN", "CO", "QH"] as const).map(name => ({
    name,
    value: fromRev[name],
    color: PIE_COLORS[name],
  }));
}

/** Plain-language month position from the full report (KPIs, budget, cash, history). */
function buildPositionSummary(report: MonthlyReport): string[] {
  const label = monthLabel(report.month);
  const ins = buildInsights(report);
  const t = report.totals;
  const bc = report.budgetCompare;
  const hist3 = report.history.slice(-3);
  const hist6 = report.history;
  const sum = (rows: MonthlyReport["history"]) =>
    rows.reduce((a, h) => ({ revenue: a.revenue + h.revenue, cost: a.cost + h.cost, net: a.net + h.net }), {
      revenue: 0,
      cost: 0,
      net: 0,
    });
  const s3 = sum(hist3);
  const s6 = sum(hist6);
  const targetRev = bc?.totals.budgetRevenue ?? 0;
  const planExp = bc?.totals.budgetExpense ?? 0;
  const revVsTarget = targetRev > 0 ? t.revenue - targetRev : null;
  const expVsPlan = planExp > 0 ? t.totalCost - planExp : null;
  const topOver = [...(bc?.rows ?? [])]
    .filter(r => r.actual > 0 || r.budget > 0)
    .sort((a, b) => b.variance - a.variance)[0];
  const slices = reportPieSlices(report).filter(s => s.value > 0);
  const mixLead = [...slices].sort((a, b) => b.value - a.value)[0];
  const mixNames: Record<string, string> = {
    AH: "Ahmed Hamza",
    SN: "Sharjeel Nasir",
    CO: "CO. Habib Metro",
    QH: "Qasim Habib Metro",
  };

  const p1 = [
    `${label} closed with ${t.netProfit >= 0 ? "a profit" : "a loss"} of ${signed(t.netProfit)} (${ins.profitNote.toLowerCase()}).`,
    `Actual revenue was ${pkr(t.revenue)}${
      revVsTarget != null
        ? ` against a target of ${pkr(targetRev)} (${revVsTarget >= 0 ? "ahead" : "short"} ${signed(revVsTarget)})`
        : ""
    }.`,
    `Total cost was ${pkr(t.totalCost)} (payroll ${pkr(t.payroll)} · OPEX ${pkr(t.opex)})${
      expVsPlan != null
        ? `, ${expVsPlan > 0 ? "over" : expVsPlan < 0 ? "under" : "on"} the expense plan by ${signed(expVsPlan)}`
        : ""
    }.`,
  ].join(" ");

  const p2 = [
    `Net cash stands at ${pkr(report.cash.closingNet)}${report.cash.asOf ? ` as of ${report.cash.asOf}` : ""}, with ${signed(report.cash.monthNet)} movement this month.`,
    mixLead
      ? ` Collections are led by ${mixNames[mixLead.name] ?? mixLead.name} (${pkr(mixLead.value)}).`
      : "",
    topOver && topOver.variance > 0
      ? ` Largest plan overrun is ${topOver.name} (${signed(topOver.variance)} over budget).`
      : topOver && topOver.variance < 0
        ? ` Spend is running under plan on ${topOver.name} (${signed(topOver.variance)}).`
        : "",
  ].join("");

  const p3 = `Last 3 months combined: ${pkr(s3.revenue)} revenue, ${pkr(s3.cost)} cost, net ${signed(s3.net)}. Last 6 months combined: ${pkr(s6.revenue)} revenue, ${pkr(s6.cost)} cost, net ${signed(s6.net)}.${
    ins.revenueVsPrev != null ? ` Versus the prior month, revenue moved ${signed(ins.revenueVsPrev)} and cost moved ${signed(ins.costVsPrev ?? 0)}.` : ""
  }`;

  return [p1, p2.trim(), p3];
}

/**
 * Word-compatible HTML — same light template as Technical Team monthly report:
 * red h1, grey meta, pastel KPI cards, navy table headers, nested-table bars.
 */
function buildWordHtml(report: MonthlyReport): string {
  const label = monthLabel(report.month);
  const ins = buildInsights(report);
  const net = report.totals.netProfit;

  const RED = "#B8112D";
  const NAVY = "#0B1220";
  const GREEN = "#059669";
  const GREEN_D = "#027A48";
  const RED_TXT = "#DC2626";
  const BLUE = "#0B84F3";
  const VIOLET = "#7C3AED";
  const TEAL = "#0D9488";
  const SLATE = "#334155";

  const th = `style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;"`;
  const thR = `style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;text-align:right;"`;
  const thC = `style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;text-align:center;"`;
  const td = `style="padding:5px 8px;border:1px solid #E2E8F0;font-size:10px;"`;
  const tdR = `style="padding:5px 8px;border:1px solid #E2E8F0;font-size:10px;text-align:right;"`;
  const sub = `style="padding:3px 8px 3px 22px;border:1px solid #F1F5F9;font-size:9.5px;color:#64748B;background:#FCFCFD;"`;
  const subR = `style="padding:3px 8px;border:1px solid #F1F5F9;font-size:9.5px;color:#64748B;text-align:right;background:#FCFCFD;"`;

  const tdEmpty = (cols: number, text: string) =>
    `<tr><td colspan="${cols}" style="padding:10px;border:1px solid #E2E8F0;font-size:10px;color:#94A3B8;text-align:center;">${text}</td></tr>`;

  const statusCell = (text: string, bg: string, color: string) =>
    `<td style="padding:4px 8px;border:1px solid #E2E8F0;text-align:center;background:${bg};"><b style="color:${color};font-size:8.5px;letter-spacing:0.5px;">${text.toUpperCase()}</b></td>`;

  const profitCell = (v: number) =>
    v >= 0 ? statusCell("Profit", "#D1FADF", GREEN_D) : statusCell("Loss", "#FEE4E2", RED_TXT);

  const trendArrow = (v: number | null, goodWhenUp: boolean) => {
    if (v == null) return `<span style="color:#94A3B8;font-size:9px;">—</span>`;
    const up = v >= 0;
    const good = goodWhenUp ? up : !up;
    const color = good ? GREEN_D : RED_TXT;
    return `<span style="color:${color};font-size:9px;font-weight:bold;">${up ? "▲" : "▼"} ${signed(v)}</span>`;
  };

  const card = (title: string, value: string, subTxt: string, bg: string, width = "20%") =>
    `<td width="${width}" style="padding:6px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:${bg};border-radius:8px;">
        <tr><td style="padding:12px 14px;">
          <p style="margin:0;font-size:9px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">${title}</p>
          <p style="margin:4px 0 2px;font-size:22px;font-weight:bold;color:#0F172A;">${value}</p>
          <p style="margin:0;font-size:9px;color:#64748B;">${subTxt}</p>
        </td></tr>
      </table>
    </td>`;

  const barRow = (rowLabel: string, value: number, max: number, color: string, valueTxt?: string) => {
    const pct = Math.max(0, Math.min(100, max > 0 ? Math.round((Math.abs(value) / max) * 100) : 0));
    return `<tr>
      <td style="padding:4px 8px;border:1px solid #E2E8F0;font-size:10px;width:140px;">${rowLabel}</td>
      <td style="padding:4px 8px;border:1px solid #E2E8F0;font-size:10px;width:90px;text-align:right;font-weight:bold;color:${value < 0 ? RED_TXT : SLATE};">${valueTxt ?? currency(value)}</td>
      <td style="padding:4px 8px;border:1px solid #E2E8F0;">
        <table cellpadding="0" cellspacing="0" width="100%"><tr>
          <td width="${pct}%" bgcolor="${color}" style="height:14px;font-size:1px;">&nbsp;</td>
          <td width="${100 - pct}%" bgcolor="#F1F5F9" style="height:14px;font-size:1px;">&nbsp;</td>
        </tr></table>
      </td>
    </tr>`;
  };
// Financial performance bar
  const maxNet = Math.max(...report.history.map(h => Math.abs(h.net)), 1);
  const netTrendBars = report.history
    .map(h =>
      barRow(
        monthShort(h.month) + (h.month === report.month ? " ●" : ""),
        h.net,
        maxNet,
        h.net >= 0 ? GREEN : "#EF4444",
        signed(h.net),
      ),
    )
    .join("");

  const maxRevCost = Math.max(...report.history.flatMap(h => [h.revenue, h.cost]), 1);
  const revCostBars = report.history
    .map(
      h =>
        barRow(`${monthShort(h.month)} rev`, h.revenue, maxRevCost, BLUE) +
        barRow(`${monthShort(h.month)} cost`, h.cost, maxRevCost, "#F97066"),
    )
    .join("");

  const cashBanks = report.cash.banks;
  const cashDcMax = Math.max(...cashBanks.flatMap(b => [b.debit ?? 0, b.credit ?? 0]), 1);
  const cashNetMax = Math.max(...cashBanks.map(b => Math.abs(b.balance)), 1);
  const cashDrCrBars = cashBanks
    .flatMap(b => [
      barRow(`${b.bank} Dr`, b.debit ?? 0, cashDcMax, BLUE),
      barRow(`${b.bank} Cr`, b.credit ?? 0, cashDcMax, RED),
    ])
    .join("");
  const cashNetBars = cashBanks
    .map(b => barRow(b.bank, b.balance, cashNetMax, b.balance >= 0 ? GREEN : RED, signed(b.balance)))
    .join("");
  const sectionMax = Math.max(...(report.cash.sections ?? []).map(s => Math.abs(s.net)), 1);
  const sectionBars = (report.cash.sections ?? [])
    .map(s => barRow(s.name, s.net, sectionMax, s.net >= 0 ? GREEN : RED, signed(s.net)))
    .join("");

  const historyRows = report.history
    .map((h, i) => {
      const prev = i > 0 ? report.history[i - 1] : null;
      const isThis = h.month === report.month;
      return `<tr style="background:${isThis ? "#FFF1F3" : "#FFFFFF"};">
        <td ${td}><b>${monthShort(h.month)}</b>${isThis ? ` <span style="color:${RED};font-size:8px;">● THIS</span>` : ""}</td>
        <td ${tdR}>${currency(h.revenue)}<br/>${trendArrow(prev ? h.revenue - prev.revenue : null, true)}</td>
        <td ${tdR}>${currency(h.cost)}<br/>${trendArrow(prev ? h.cost - prev.cost : null, false)}</td>
        <td ${tdR}><b style="color:${h.net >= 0 ? GREEN_D : RED_TXT};">${signed(h.net)}</b></td>
        ${profitCell(h.net)}
      </tr>`;
    })
    .join("");
  const histTotal = report.history.reduce(
    (a, h) => ({ revenue: a.revenue + h.revenue, cost: a.cost + h.cost, net: a.net + h.net }),
    { revenue: 0, cost: 0, net: 0 },
  );
  const hist3 = report.history.slice(-3);
  const historyRows3 = hist3
    .map(h => {
      const idx = report.history.findIndex(x => x.month === h.month);
      const prev = idx > 0 ? report.history[idx - 1] : null;
      const isThis = h.month === report.month;
      return `<tr style="background:${isThis ? "#FFF1F3" : "#FFFFFF"};">
        <td ${td}><b>${monthShort(h.month)}</b>${isThis ? ` <span style="color:${RED};font-size:8px;">● THIS</span>` : ""}</td>
        <td ${tdR}>${currency(h.revenue)}<br/>${trendArrow(prev ? h.revenue - prev.revenue : null, true)}</td>
        <td ${tdR}>${currency(h.cost)}<br/>${trendArrow(prev ? h.cost - prev.cost : null, false)}</td>
        <td ${tdR}><b style="color:${h.net >= 0 ? GREEN_D : RED_TXT};">${signed(h.net)}</b></td>
        ${profitCell(h.net)}
      </tr>`;
    })
    .join("");
  const hist3Total = hist3.reduce(
    (a, h) => ({ revenue: a.revenue + h.revenue, cost: a.cost + h.cost, net: a.net + h.net }),
    { revenue: 0, cost: 0, net: 0 },
  );

  const csrStatusHtml = (status: string) => {
    if (status === "Top Performer") {
      return `<td style="padding:5px 8px;border:1px solid #E2E8F0;text-align:center;"><b style="color:${GREEN_D};font-size:10px;">Top Performer</b></td>`;
    }
    if (status === "Below Expectation") {
      return `<td style="padding:5px 8px;border:1px solid #E2E8F0;text-align:center;"><b style="color:${RED_TXT};font-size:10px;">Below Expectation</b></td>`;
    }
    return `<td style="padding:5px 8px;border:1px solid #E2E8F0;text-align:center;color:${NAVY};font-size:10px;">Active</td>`;
  };
  const csrRows = report.csr.rows
    .map((r, i) => `<tr style="background:${i % 2 === 0 ? "#EFF6FF" : "#FFFFFF"};">
        <td ${td}><b>${r.name}</b></td>
        <td ${tdR}><b>${r.projects}</b></td>
        <td ${tdR}>${r.share.toFixed(1)}%</td>
        ${csrStatusHtml(r.status || (r.projects > 0 ? "Active" : "Below Expectation"))}
        <td ${td}>${r.note || "—"}</td>
      </tr>`)
    .join("");
  const csrBarMax = Math.max(...report.csr.rows.map(r => r.projects), 1);
  const csrBars = report.csr.rows
    .map(r => barRow(r.name, r.projects, csrBarMax, r.projects > 0 ? GREEN : "#F97066", String(r.projects)))
    .join("");

  const salaryTableHtml = (tables: SalaryFieldTable[]) =>
    tables
      .map(t => {
        const head = t.columns.map((c, i) => (i === 0 ? `<td ${th}>${c}</td>` : `<td ${thR}>${c}</td>`)).join("");
        const body = t.rows
          .map(r => {
            const tds = r.cells
              .map((c, i) => {
                const col = t.columns[i] ?? "";
                const txt =
                  typeof c === "number" ? (/%/.test(col) ? `${c}%` : currency(c)) : c;
                return i === 0 ? `<td ${td}><b>${txt}</b></td>` : `<td ${tdR}>${txt}</td>`;
              })
              .join("");
            return `<tr>${tds}</tr>`;
          })
          .join("");
        return `<h3 style="color:${NAVY};font-size:12px;margin:14px 0 6px;">${t.name}</h3>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>${head}</tr>
      ${body || tdEmpty(t.columns.length, "No employees.")}
      <tr style="background:#FFF1F3;"><td ${td}><b>TOTAL</b></td><td ${tdR} colspan="${Math.max(t.columns.length - 1, 1)}"><b style="color:${RED};">${currency(t.total)}</b></td></tr>
    </table>`;
      })
      .join("");

  const opexTableHtml = (title: string, tables: OpexFieldTable[], total: number) => `
    <h2>${title}</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td ${th}>Head</td><td ${th}>Individual</td><td ${th}>Filled date</td><td ${th}>Notes / Image</td><td ${thR}>Amount (PKR)</td></tr>
      ${
        tables.length
          ? tables
              .flatMap(h => {
                const headRow = `<tr style="background:#FFF1F3;">
                  <td ${td}><b>${h.name}</b></td>
                  <td ${td}></td>
                  <td ${td}>${h.filledAt || "—"}</td>
                  <td ${td}>${h.notes || "—"}</td>
                  <td ${tdR}><b>${currency(h.amount)}</b></td>
                </tr>`;
                const lines = h.lines.map(
                  l => `<tr>
                    <td ${sub}></td>
                    <td ${sub}>${l.label}</td>
                    <td ${sub}>${l.filledAt || "—"}</td>
                    <td ${sub}>${l.proofName || "—"}</td>
                    <td ${subR}>${currency(l.amount)}</td>
                  </tr>`,
                );
                return [headRow, ...lines];
              })
              .join("")
          : tdEmpty(5, "No entries this month.")
      }
      <tr style="background:#FFF1F3;"><td ${td} colspan="4"><b>TOTAL</b></td><td ${tdR}><b style="color:${RED};">${currency(total)}</b></td></tr>
    </table>`;

  const execRows = report.executives
    .map(
      e => `<tr>
        <td ${td}><b>${e.name}</b></td>
        <td ${tdR}>${currency(e.basic)}</td>
        <td ${tdR}><b style="color:${VIOLET};">${e.commissionPct}%</b></td>
        <td ${tdR}><span style="color:${GREEN_D};">${currency(e.commission)}</span></td>
        <td ${tdR}><b style="color:${RED};">${currency(e.total)}</b></td>
        <td ${tdR}>${currency(e.loanPositive)}</td>
        <td ${tdR}><span style="color:${RED_TXT};">${currency(e.loanNegative)}</span></td>
        <td ${td}>${e.remarks || "—"}</td>
      </tr>`,
    )
    .join("");
  const execTotal = report.executives.reduce((s, e) => s + e.total, 0);

  const cashRows = cashBanks
    .map(
      b => `<tr>
        <td ${td}><b>${b.bank}</b></td>
        <td ${tdR}>${currency(b.debit ?? 0)}</td>
        <td ${tdR}>${currency(b.credit ?? 0)}</td>
        <td ${tdR}><b style="color:${b.balance >= 0 ? GREEN_D : RED_TXT};">${signed(b.balance)}</b></td>
      </tr>`,
    )
    .join("");

  const channelRows = (report.revenueChannels ?? [])
    .map(
      c => `<tr>
        <td ${td}><b>${c.label}</b></td>
        <td ${tdR}>${currency(c.usd)}</td>
        <td ${tdR}>${currency(c.cad)}</td>
        <td ${tdR}>${currency(c.pkr)}</td>
        <td ${tdR}><b>${currency(c.netPkr)}</b></td>
      </tr>`,
    )
    .join("");

  const ledgerHeads = cashBanks.map(b => b.bank);
  const ledgerColSpan = 3 + ledgerHeads.length * 2 + 1;
  const ledgerRows = (report.cash.ledger ?? [])
    .map(r => {
      const byBank = new Map(r.banks.map(b => [b.bank, b]));
      return `<tr>
        <td ${td}>${r.date || "—"}</td>
        <td ${td}>${r.section}</td>
        <td ${td}>${r.description}</td>
        ${ledgerHeads
          .map(b => {
            const x = byBank.get(b);
            return `<td ${tdR}>${currency(x?.debit ?? 0)}</td><td ${tdR}>${currency(x?.credit ?? 0)}</td>`;
          })
          .join("")}
        <td ${tdR}><b style="color:${r.net >= 0 ? GREEN_D : RED_TXT};">${signed(r.net)}</b></td>
      </tr>`;
    })
    .join("");

  const generatedAt = formatEstDateTime(new Date());
  const bc = report.budgetCompare;
  const budgetRowHtml = (bc?.rows ?? [])
    .map(r => {
      const over = r.variance > 0;
      return `<tr>
        <td ${td}><b>${r.name}</b></td>
        <td ${tdR}>${currency(r.budget)}</td>
        <td ${tdR}>${currency(r.actual)}</td>
        <td ${tdR}><b style="color:${over ? RED_TXT : GREEN_D};">${signed(r.variance)}</b></td>
        <td style="padding:4px 8px;border:1px solid #E2E8F0;text-align:center;font-size:9px;font-weight:bold;color:${over ? RED_TXT : GREEN_D};">${over ? "OVER" : r.variance < 0 ? "UNDER" : "ON PLAN"}</td>
      </tr>`;
    })
    .join("");
  const budgetMax = Math.max(...(bc?.rows ?? []).flatMap(r => [r.budget, r.actual]), 1);
  const budgetBars = (bc?.rows ?? [])
    .map(r => barRow(`${r.name} plan`, r.budget, budgetMax, VIOLET) + barRow(`${r.name} actual`, r.actual, budgetMax, BLUE))
    .join("");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Accounts Report ${label}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #0F172A; margin: 24px; }
  h1 { color: ${RED}; font-size: 22px; margin: 0 0 4px; }
  h2 { color: ${NAVY}; font-size: 14px; margin: 20px 0 8px; border-bottom: 2px solid ${RED}; padding-bottom: 4px; }
  p.meta { color: #64748B; font-size: 10px; margin: 0 0 16px; }
</style></head>
<body>
  <h1>Executive Summary</h1>
  <p class="meta">Accounts Team · ${label} · Generated ${generatedAt} · BEM Solutions CRM</p>

  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    ${card("Targeted Revenue", pkr(bc?.totals.budgetRevenue ?? 0), bc?.hasBudget ? "Income Statement budget" : "No budget plan saved", "#F5F3FF")}
    ${card("Actual Revenue", pkr(report.totals.revenue), ins.revenueVsPrev != null ? `${signed(ins.revenueVsPrev)} vs prev month` : "Month collections", "#EFF6FF")}
    ${card("Total cost", pkr(report.totals.totalCost), report.sourceDate ? `Matches IS Total Expense · ${report.sourceDate}` : ins.costVsPrev != null ? `${signed(ins.costVsPrev)} vs prev month` : `Payroll ${pkr(report.totals.payroll)}`, "#FFF1F3")}
    ${card("Profit / Loss", signed(net), ins.profitNote, net >= 0 ? "#ECFDF5" : "#FFF7ED")}
    ${card("Net balance", pkr(report.cash.closingNet), report.cash.asOf ? `As of ${report.cash.asOf}` : "Closing cash position", "#F0FDFA")}
  </tr></table>

  <h2>Company position — ${label}</h2>
  ${buildPositionSummary(report).map(p => `<p style="font-size:11px;line-height:1.55;color:#334155;margin:0 0 8px;">${p}</p>`).join("")}

  <h2>Revenue — currency channels</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>Channel</td><td ${thR}>USD</td><td ${thR}>CAD</td><td ${thR}>PKR</td><td ${thR}>Net PKR</td>
    </tr>
    ${channelRows || tdEmpty(5, "No channel amounts this month.")}
    <tr style="background:#EFF6FF;">
      <td ${td}><b>TOTAL REVENUE</b></td>
      <td ${tdR}><b>${currency((report.revenueChannels ?? []).reduce((a, c) => a + c.usd, 0))}</b></td>
      <td ${tdR}><b>${currency((report.revenueChannels ?? []).reduce((a, c) => a + c.cad, 0))}</b></td>
      <td ${tdR}><b>${currency((report.revenueChannels ?? []).reduce((a, c) => a + c.pkr, 0))}</b></td>
      <td ${tdR}><b>${currency(report.totals.revenue)}</b></td>
    </tr>
  </table>

  <h2>Budget plan vs actual — ${label}</h2>
  ${
    !bc?.hasBudget
      ? `<p style="font-size:10px;color:#64748B;">No Income Statement budget saved for this month. Set a plan on the Income Statement budget planner first.</p>`
      : `<table width="100%" cellpadding="0" cellspacing="0"><tr>
    ${card("Planned revenue", pkr(bc.totals.budgetRevenue), "Income Statement budget", "#F5F3FF", "25%")}
    ${card("Actual revenue", pkr(bc.totals.actualRevenue), "Collections this month", "#EFF6FF", "25%")}
    ${card("Planned expense", pkr(bc.totals.budgetExpense), "Payroll + OPEX plan", "#FFF7ED", "25%")}
    ${card("Actual expense", pkr(bc.totals.actualExpense), `Spent vs plan ${signed(bc.totals.variance)}`, bc.totals.variance > 0 ? "#FFF1F3" : "#ECFDF5", "25%")}
  </tr></table>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:10px;">
    <tr>
      <td ${th}>Head</td><td ${thR}>Planned budget (PKR)</td><td ${thR}>Actual spent (PKR)</td><td ${thR}>Variance</td><td ${thC}>Status</td>
    </tr>
    ${budgetRowHtml || tdEmpty(5, "No budget / actual lines.")}
    <tr style="background:#F8FAFC;">
      <td ${td}><b>EXPENSE TOTAL</b></td>
      <td ${tdR}><b>${currency(bc.totals.budgetExpense)}</b></td>
      <td ${tdR}><b>${currency(bc.totals.actualExpense)}</b></td>
      <td ${tdR}><b style="color:${bc.totals.variance > 0 ? RED_TXT : GREEN_D};">${signed(bc.totals.variance)}</b></td>
      <td style="padding:4px 8px;border:1px solid #E2E8F0;text-align:center;font-size:9px;font-weight:bold;">${bc.totals.variance > 0 ? "OVER" : bc.totals.variance < 0 ? "UNDER" : "ON PLAN"}</td>
    </tr>
  </table>
  ${budgetBars ? `<p style="margin:12px 0 6px;font-size:11px;font-weight:bold;color:${NAVY};">Plan vs spent by head</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${budgetBars}</table>
  <p style="margin:6px 0 0;font-size:9px;color:#64748B;"><b style="color:${VIOLET};">■</b> Planned &nbsp; <b style="color:${BLUE};">■</b> Actual</p>` : ""}`
  }

  <h2>Financial performance</h2>
  <h3 style="color:${NAVY};font-size:12px;margin:8px 0 6px;">Last 3 months</h3>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>Month</td><td ${thR}>Revenue (PKR)</td><td ${thR}>Total Cost (PKR)</td><td ${thR}>Net P/L (PKR)</td><td ${thC}>Status</td>
    </tr>
    ${historyRows3 || tdEmpty(5, "No income statement records yet.")}
    <tr style="background:#F8FAFC;">
      <td ${td}><b>TOTAL</b></td>
      <td ${tdR}><b>${currency(hist3Total.revenue)}</b></td>
      <td ${tdR}><b>${currency(hist3Total.cost)}</b></td>
      <td ${tdR}><b style="color:${hist3Total.net >= 0 ? GREEN_D : RED_TXT};">${signed(hist3Total.net)}</b></td>
      ${profitCell(hist3Total.net)}
    </tr>
  </table>
  <h3 style="color:${NAVY};font-size:12px;margin:16px 0 6px;">Last 6 months</h3>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>Month</td><td ${thR}>Revenue (PKR)</td><td ${thR}>Total Cost (PKR)</td><td ${thR}>Net P/L (PKR)</td><td ${thC}>Status</td>
    </tr>
    ${historyRows || tdEmpty(5, "No income statement records yet.")}
    <tr style="background:#F8FAFC;">
      <td ${td}><b>TOTAL</b></td>
      <td ${tdR}><b>${currency(histTotal.revenue)}</b></td>
      <td ${tdR}><b>${currency(histTotal.cost)}</b></td>
      <td ${tdR}><b style="color:${histTotal.net >= 0 ? GREEN_D : RED_TXT};">${signed(histTotal.net)}</b></td>
      ${profitCell(histTotal.net)}
    </tr>
  </table>

  <h2>Net profit / loss trend</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${netTrendBars || tdEmpty(3, "No history data.")}</table>
  <p style="margin:6px 0 0;font-size:9px;color:#64748B;"><b style="color:${GREEN};">■</b> Profit &nbsp; <b style="color:#EF4444;">■</b> Loss &nbsp;·&nbsp; ● = this report month</p>

  <h2>Revenue vs total cost</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${revCostBars || tdEmpty(3, "No history data.")}</table>
  <p style="margin:6px 0 0;font-size:9px;color:#64748B;"><b style="color:${BLUE};">■</b> Revenue &nbsp; <b style="color:#F97066;">■</b> Total Cost</p>

  <h2>Cash flow statement${report.cash.asOf ? ` — as of ${report.cash.asOf}` : ""}</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;">
    <tr>
      <td width="40%" style="padding:6px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${RED};border-radius:8px;">
          <tr><td style="padding:14px 16px;">
            <p style="margin:0;font-size:9px;color:#FECACA;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Net cash flow</p>
            <p style="margin:6px 0 4px;font-size:22px;font-weight:bold;color:#FFFFFF;">${currency(report.cash.monthNet)}</p>
            <p style="margin:0;font-size:9px;color:#FECACA;">${report.cash.monthEntries ?? 0} entries in ${label} · closing ${pkr(report.cash.closingNet)}</p>
          </td></tr>
        </table>
      </td>
      <td width="60%" style="padding:6px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFF1F3;border-radius:8px;">
          <tr><td style="padding:12px 14px;">
            <p style="margin:0 0 8px;font-size:9px;color:#64748B;text-transform:uppercase;letter-spacing:0.5px;font-weight:bold;">Bank accounts</p>
            ${
              cashBanks.length
                ? cashBanks
                    .map(
                      (b, i) =>
                        `<span style="display:inline-block;background:${["#0B84F3", "#B8112D", "#12B76A", "#F59E0B", "#0D9488", "#EA580C"][i % 6]};color:#fff;font-size:9px;font-weight:bold;padding:3px 8px;margin:0 4px 4px 0;">${b.bank}</span>`,
                    )
                    .join("")
                : `<span style="font-size:10px;color:#94A3B8;">No bank heads recorded</span>`
            }
          </td></tr>
        </table>
      </td>
    </tr>
  </table>

  ${sectionBars ? `<p style="margin:12px 0 6px;font-size:11px;font-weight:bold;color:${NAVY};">Net by section</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${sectionBars}</table>` : ""}

  <p style="margin:12px 0 6px;font-size:11px;font-weight:bold;color:${NAVY};">Bank debit vs credit</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${cashDrCrBars || tdEmpty(3, "No bank activity this month.")}</table>
  <p style="margin:6px 0 0;font-size:9px;color:#64748B;"><b style="color:${BLUE};">■</b> Debit &nbsp; <b style="color:${RED};">■</b> Credit</p>

  <p style="margin:12px 0 6px;font-size:11px;font-weight:bold;color:${NAVY};">Bank net (debit − credit)</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${cashNetBars || tdEmpty(3, "No bank activity this month.")}</table>

  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:10px;">
    <tr><td ${th}>Bank</td><td ${thR}>Debit (PKR)</td><td ${thR}>Credit (PKR)</td><td ${thR}>Net (PKR)</td></tr>
    ${cashRows || tdEmpty(4, "No cash flow entries recorded.")}
    <tr style="background:#FFF1F3;">
      <td ${td}><b>MONTH NET</b></td>
      <td ${tdR}><b>${currency(cashBanks.reduce((a, b) => a + (b.debit ?? 0), 0))}</b></td>
      <td ${tdR}><b>${currency(cashBanks.reduce((a, b) => a + (b.credit ?? 0), 0))}</b></td>
      <td ${tdR}><b style="color:${report.cash.monthNet >= 0 ? GREEN_D : RED_TXT};">${signed(report.cash.monthNet)}</b></td>
    </tr>
    <tr style="background:#F8FAFC;">
      <td ${td} colspan="3"><b>CLOSING CASH (NET)</b></td>
      <td ${tdR}><b style="color:${TEAL};">${currency(report.cash.closingNet)}</b></td>
    </tr>
  </table>

  <p style="margin:12px 0 6px;font-size:11px;font-weight:bold;color:${NAVY};">Cash flow ledger — each entry</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>Date</td><td ${th}>Section</td><td ${th}>Description</td>
      ${ledgerHeads.map(b => `<td ${thR}>${b} Dr</td><td ${thR}>${b} Cr</td>`).join("")}
      <td ${thR}>Net</td>
    </tr>
    ${ledgerRows || tdEmpty(ledgerColSpan, "No cash flow rows dated in this month.")}
    <tr style="background:#FFF1F3;">
      <td ${td} colspan="${3 + ledgerHeads.length * 2}"><b>MONTH NET (${report.cash.monthEntries ?? 0} entries)</b></td>
      <td ${tdR}><b style="color:${report.cash.monthNet >= 0 ? GREEN_D : RED_TXT};">${signed(report.cash.monthNet)}</b></td>
    </tr>
  </table>

  <h2>CSR team performance — ${label}</h2>
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="62%" valign="top" style="padding-right:10px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td ${th}>CSR</td>
          <td ${thR}>Projects – ${monthNameOnly(report.month)}</td>
          <td ${thR}>Share %</td>
          <td ${thC}>Status</td>
          <td ${th}>Note</td>
        </tr>
        ${csrRows || tdEmpty(5, "No sales / team-lead CSRs recorded this month.")}
        <tr>
          <td style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;"><b>TOTAL</b></td>
          <td style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;text-align:right;"><b>${report.csr.totalProjects}</b></td>
          <td style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;text-align:right;"><b>100%</b></td>
          <td style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;"></td>
          <td style="background:${NAVY};color:#fff;padding:6px 8px;font-size:9px;">Closing rate tracking live from ${monthNameOnly(report.month)}</td>
        </tr>
      </table>
    </td>
    <td width="38%" valign="top">
      <p style="margin:0 0 6px;font-size:11px;font-weight:bold;color:${NAVY};">Projects by CSR</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${csrBars || tdEmpty(3, "No CSR project counts.")}</table>
    </td>
  </tr></table>

  <h2>Team salaries — ${pkr(report.totals.payroll)}</h2>
  ${salaryTableHtml(report.salaryTables ?? []) || `<p style="font-size:10px;color:#94A3B8;">No team salaries on the latest Income Statement for this month.</p>`}

  ${opexTableHtml(`Operating expenses (${pkr(report.totals.opex)})`, report.opexTables ?? [], report.totals.opex)}
  ${opexTableHtml(`Loans (${pkr(report.totals.loans)})`, report.loanTables ?? [], report.totals.loans)}
  ${opexTableHtml(`Provident fund (${pkr(report.totals.pf)})`, report.pfTables ?? [], report.totals.pf)}

  <h2>Executive salaries — ${label}</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>Executive</td><td ${thR}>Basic (PKR)</td><td ${thR}>Comm. %</td><td ${thR}>Commission (PKR)</td>
      <td ${thR}>Total (PKR)</td><td ${thR}>Loan +ve</td><td ${thR}>Loan −ve</td><td ${th}>Remarks</td>
    </tr>
    ${execRows || tdEmpty(8, "No executive salary entries this month.")}
    ${execRows ? `<tr style="background:#F8FAFC;"><td ${td}><b>TOTAL SALARY</b></td><td ${td} colspan="3"></td><td ${tdR}><b style="color:${RED};">${currency(execTotal)}</b></td><td ${td} colspan="3"></td></tr>` : ""}
  </table>

  <p style="margin-top:24px;font-size:9px;color:#94A3B8;">Auto-generated from CRM accounts daily records, cash flow &amp; payroll. ${report.daysRecorded} income-statement day${report.daysRecorded === 1 ? "" : "s"} in ${label}.</p>
</body></html>`;
}

function buildWordBlob(report: MonthlyReport): { blob: Blob; fileName: string } {
  const html = buildWordHtml(report);
  const blob = new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" });
  const fileName = `Accounts-Report-${report.month}.doc`;
  return { blob, fileName };
}

function triggerLocalDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Download Word locally + archive the same file to Cloudinary. */
async function saveAndDownloadWord(report: MonthlyReport): Promise<SavedMonthlyReport | null> {
  const { blob, fileName } = buildWordBlob(report);
  triggerLocalDownload(blob, fileName);

  const form = new FormData();
  form.append("file", blob, fileName);
  form.append("month", report.month);
  if (report.sourceDate) form.append("sourceDate", report.sourceDate);
  form.append("totals", JSON.stringify(report.totals));

  const res = await API.post("/accounts/reports/monthly/save", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return (res.data.report as SavedMonthlyReport) ?? null;
}

/** MoM movement arrow — goodWhenUp: revenue up = green, cost up = red. */
function TrendArrow({ v, goodWhenUp }: { v: number | null; goodWhenUp: boolean }) {
  if (v == null) return <span className="text-[9px] text-crm-text-faint">—</span>;
  const up = v >= 0;
  const good = goodWhenUp ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold ${good ? "text-emerald-600" : "text-red-500"}`}>
      <Icon size={10} className="shrink-0" />
      {signed(v)}
    </span>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${BENTO_CARD} overflow-hidden`}>
      <div className="px-4 sm:px-5 pt-4 pb-2">
        <h2 className="font-extrabold text-[#0B1220] dark:text-crm-text text-sm tracking-tight border-b-2 border-[#B8112D] pb-2">
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

const PIE_LEGEND: { key: "AH" | "SN" | "CO" | "QH"; name: string }[] = [
  { key: "AH", name: "Ahmed Hamza" },
  { key: "SN", name: "Sharjeel Nasir" },
  { key: "CO", name: "CO. Habib Metro" },
  { key: "QH", name: "Qasim Habib Metro" },
];

function HistoryPerformanceHalf({
  title,
  rows,
  allHistory,
  currentMonth,
  chartId,
}: {
  title: string;
  rows: MonthlyReport["history"];
  allHistory: MonthlyReport["history"];
  currentMonth: string;
  chartId: string;
}) {
  const totals = rows.reduce(
    (a, h) => ({ revenue: a.revenue + h.revenue, cost: a.cost + h.cost, net: a.net + h.net }),
    { revenue: 0, cost: 0, net: 0 },
  );
  return (
    <div>
      <div className="px-4 sm:px-5 pt-3 pb-1">
        <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-[#B8112D]">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-160">
          <thead className="bg-[#0B1220]">
            <tr>
              <th className={`${thCls} text-left`}>Month</th>
              <th className={`${thCls} text-right`}>Revenue (PKR)</th>
              <th className={`${thCls} text-right`}>Total Cost (PKR)</th>
              <th className={`${thCls} text-right`}>Net P/L (PKR)</th>
              <th className={`${thCls} text-center w-24`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-crm-text-faint text-xs">
                  No income statement records yet.
                </td>
              </tr>
            ) : (
              rows.map(h => {
                const idx = allHistory.findIndex(x => x.month === h.month);
                const prev = idx > 0 ? allHistory[idx - 1] : null;
                return (
                  <tr
                    key={h.month}
                    className={`border-b border-crm-border-subtle ${h.month === currentMonth ? "bg-[#FFF6F8]" : "bg-crm-surface"}`}
                  >
                    <td className={`${tdCls} font-bold text-crm-text`}>
                      {monthShort(h.month)}
                      {h.month === currentMonth && (
                        <span className="ml-2 text-[9px] font-bold text-[#B8112D] uppercase">This report</span>
                      )}
                    </td>
                    <td className={`${tdCls} text-right tabular-nums`}>
                      {currency(h.revenue)}
                      <div>
                        <TrendArrow v={prev ? h.revenue - prev.revenue : null} goodWhenUp />
                      </div>
                    </td>
                    <td className={`${tdCls} text-right tabular-nums`}>
                      {currency(h.cost)}
                      <div>
                        <TrendArrow v={prev ? h.cost - prev.cost : null} goodWhenUp={false} />
                      </div>
                    </td>
                    <td className={`${tdCls} text-right font-bold tabular-nums ${h.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {signed(h.net)}
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          h.net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                        }`}
                      >
                        {h.net >= 0 ? "Profit" : "Loss"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-crm-border bg-[#FAFBFC]">
                <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">TOTAL</td>
                <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(totals.revenue)}</td>
                <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(totals.cost)}</td>
                <td className={`px-3 py-2.5 text-right font-extrabold tabular-nums text-xs ${totals.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {signed(totals.net)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      totals.net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                    }`}
                  >
                    {totals.net >= 0 ? "Profit" : "Loss"}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length > 0 && (
        <div className="px-3 pb-3 pt-1" id={chartId}>
          <RechartsBox height={140}>
            <BarChart data={rows.map(h => ({ name: monthShort(h.month), net: h.net }))} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={v => pkr(Number(v ?? 0))} />
              <Bar dataKey="net" name="Net P/L" radius={[8, 8, 0, 0]}>
                {rows.map(h => (
                  <Cell key={h.month} fill={h.net >= 0 ? "#12B76A" : "#EF4444"} />
                ))}
              </Bar>
            </BarChart>
          </RechartsBox>
        </div>
      )}
    </div>
  );
}

function BudgetVsActualBars({
  data,
  label,
  chartId = "report-chart-budget",
}: {
  data: NonNullable<MonthlyReport["budgetCompare"]>;
  label: string;
  chartId?: string;
}) {
  if (data.rows.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-xs text-crm-text-faint">No budget / actual lines for this month.</p>
    );
  }
  return (
    <div className="px-1 sm:px-2" id={chartId}>
      <RechartsBox height={Math.max(280, data.rows.length * 32)}>
        <BarChart
          data={data.rows.map(r => ({
            name: r.name.replace(/\s*\(incl\.[^)]*\)/gi, "").slice(0, 22),
            Planned: r.budget,
            Actual: r.actual,
          }))}
          layout="vertical"
          barSize={10}
          margin={{ left: 4, right: 12, top: 4, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 10, fontWeight: 600 }} />
          <Tooltip formatter={v => pkr(Number(v ?? 0))} />
          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
          <Bar dataKey="Planned" fill="#7C3AED" radius={[0, 6, 6, 0]} />
          <Bar dataKey="Actual" fill="#0B84F3" radius={[0, 6, 6, 0]} />
        </BarChart>
      </RechartsBox>
      <p className="text-[11px] text-crm-text-muted mt-1 px-2">
        Purple = Planned. Blue = Actual — latest IS day for {label}.
      </p>
    </div>
  );
}

const thCls = "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white";
const tdCls = "px-3 py-2 text-xs";

function formatSalaryCell(col: string, value: string | number) {
  if (typeof value === "string") return value;
  if (/%/.test(col)) return `${value}%`;
  return currency(value);
}

function SalaryFieldTableView({ table }: { table: SalaryFieldTable }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-200">
        <thead className="bg-[#0B1220]">
          <tr className="border-b border-crm-border/80">
            {table.columns.map((c, i) => (
              <th key={c} className={`${thCls} ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.length === 0 ? (
            <tr>
              <td colSpan={table.columns.length} className="px-3 py-6 text-center text-crm-text-faint text-xs">
                No employees on this Income Statement head.
              </td>
            </tr>
          ) : (
            table.rows.map(r => (
              <tr key={r.employee} className="border-b border-crm-border-subtle">
                {r.cells.map((c, i) => (
                  <td
                    key={`${r.employee}-${table.columns[i] ?? i}`}
                    className={`${tdCls} ${i === 0 ? "font-semibold text-crm-text" : "text-right tabular-nums"} ${i === r.cells.length - 1 ? "font-bold text-[#B8112D]" : ""}`}
                  >
                    {formatSalaryCell(table.columns[i] ?? "", c)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#B8112D]/20 bg-[#B8112D]/5">
            <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">TOTAL</td>
            <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-[#B8112D] text-xs" colSpan={Math.max(table.columns.length - 1, 1)}>
              {currency(table.total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OpexFieldTableView({ tables, total }: { tables: OpexFieldTable[]; total: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-160">
        <thead className="bg-[#0B1220]">
          <tr className="border-b border-crm-border/80">
            <th className={`${thCls} text-left`}>Head</th>
            <th className={`${thCls} text-left`}>Individual</th>
            <th className={`${thCls} text-center`}>Filled date</th>
            <th className={`${thCls} text-left`}>Notes / Image</th>
            <th className={`${thCls} text-right`}>Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          {tables.length === 0 ? (
            <tr><td colSpan={5} className="px-3 py-6 text-center text-crm-text-faint text-xs">No entries this month.</td></tr>
          ) : (
            tables.flatMap(h => [
              <tr key={h.name} className="border-b border-crm-border-subtle bg-crm-surface">
                <td className={`${tdCls} font-bold text-crm-text`}>{h.name}</td>
                <td className={tdCls} />
                <td className={`${tdCls} text-center text-crm-text-muted`}>{h.filledAt || "—"}</td>
                <td className={`${tdCls} text-crm-text-muted`}>{h.notes || "—"}</td>
                <td className={`${tdCls} text-right font-bold tabular-nums`}>{currency(h.amount)}</td>
              </tr>,
              ...h.lines.map(l => (
                <tr key={`${h.name}-${l.label}-${l.filledAt}`} className="border-b border-crm-border-subtle bg-[#FCFCFD]">
                  <td className={tdCls} />
                  <td className="px-3 py-1.5 pl-6 text-[11px] text-crm-text-muted">{l.label}</td>
                  <td className="px-3 py-1.5 text-center text-[11px] text-crm-text-faint">{l.filledAt || "—"}</td>
                  <td className="px-3 py-1.5 text-[11px] text-crm-text-faint">{l.proofName || "—"}</td>
                  <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-crm-text-muted">{currency(l.amount)}</td>
                </tr>
              )),
            ])
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#B8112D]/20 bg-[#B8112D]/5">
            <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs" colSpan={4}>TOTAL</td>
            <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-[#B8112D] text-xs">{currency(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function BudgetComparePanel({
  data,
  label,
  showChart = true,
  showMinis = true,
}: {
  data: NonNullable<MonthlyReport["budgetCompare"]>;
  label: string;
  showChart?: boolean;
  showMinis?: boolean;
}) {
  return (
    <>
      {showMinis && (
      <div className="px-4 pb-3 grid grid-cols-2 xl:grid-cols-4 gap-2.5">
        {[
          { label: "Planned revenue", value: data.totals.budgetRevenue, note: "IS budget", cls: "text-violet-700" },
          { label: "Actual revenue", value: data.totals.actualRevenue, note: "Collections", cls: "text-sky-700" },
          { label: "Planned expense", value: data.totals.budgetExpense, note: "Payroll + OPEX plan", cls: "text-amber-700" },
          { label: "Actual expense", value: data.totals.actualExpense, note: `Vs plan ${signed(data.totals.variance)}`, cls: data.totals.variance > 0 ? "text-red-600" : "text-emerald-700" },
        ].map(c => (
          <div key={c.label} className="rounded-xl border border-crm-border-subtle bg-[#FAFBFC] px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-crm-text-faint">{c.label}</p>
            <p className={`text-base font-extrabold tabular-nums mt-1 ${c.cls}`}>{pkr(c.value)}</p>
            <p className="text-[10px] text-crm-text-muted mt-0.5">{c.note}</p>
          </div>
        ))}
      </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-160">
          <thead className="bg-[#0B1220]">
            <tr>
              <th className={`${thCls} text-left`}>Head</th>
              <th className={`${thCls} text-right`}>Planned budget (PKR)</th>
              <th className={`${thCls} text-right`}>Actual spent (PKR)</th>
              <th className={`${thCls} text-right`}>Variance</th>
              <th className={`${thCls} text-center w-24`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-crm-text-faint text-xs">
                  No budget / actual lines for this month.
                </td>
              </tr>
            ) : (
              data.rows.map(r => {
                const over = r.variance > 0;
                return (
                  <tr key={r.key} className="border-b border-crm-border-subtle">
                    <td className={`${tdCls} font-bold text-crm-text`}>{r.name}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{currency(r.budget)}</td>
                    <td className={`${tdCls} text-right tabular-nums`}>{currency(r.actual)}</td>
                    <td className={`${tdCls} text-right font-bold tabular-nums ${over ? "text-red-600" : "text-emerald-600"}`}>
                      {signed(r.variance)}
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        over ? "bg-red-50 text-red-600" : r.variance < 0 ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}>
                        {over ? "Over" : r.variance < 0 ? "Under" : "On plan"}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {data.rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-violet-200 bg-violet-50/40">
                <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">EXPENSE TOTAL</td>
                <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(data.totals.budgetExpense)}</td>
                <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(data.totals.actualExpense)}</td>
                <td className={`px-3 py-2.5 text-right font-extrabold tabular-nums text-xs ${data.totals.variance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {signed(data.totals.variance)}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    data.totals.variance > 0 ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {data.totals.variance > 0 ? "Over" : data.totals.variance < 0 ? "Under" : "On plan"}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {showChart && <BudgetVsActualBars data={data} label={label} />}
    </>
  );
}

export default function AccountsReportsPage() {
  const [month, setMonth] = useState<string>(currentMonthIso());
  const [result, setResult] = useState<{ month: string; report: MonthlyReport | null } | null>(null);
  const [saved, setSaved] = useState<SavedMonthlyReport[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedVersion, setSavedVersion] = useState(0);

  // Loading is derived — true until the fetched result matches the selected month
  const loading = result?.month !== month;
  const report = result?.month === month ? result.report : null;
  useScrollToHash(!loading);

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

  useEffect(() => {
    let cancelled = false;
    API.get(`/accounts/reports/monthly/saved?month=${month}`)
      .then(res => {
        if (!cancelled) setSaved((res.data.reports as SavedMonthlyReport[]) ?? []);
      })
      .catch(() => {
        if (!cancelled) setSaved([]);
      });
    return () => {
      cancelled = true;
    };
  }, [month, savedVersion]);

  const handleSaveReport = async () => {
    if (!report) return;
    setSaving(true);
    try {
      await saveAndDownloadWord(report);
      toast.success("Report downloaded and archived to Cloudinary.");
      setSavedVersion(v => v + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Word downloaded, but Cloudinary save failed."));
    } finally {
      setSaving(false);
    }
  };

  const ins = report ? buildInsights(report) : null;
  const label = monthLabel(month);

  const pieSlices = report ? reportPieSlices(report) : [];
  const pieHasData = pieSlices.some(s => s.value > 0);
  const positionSummary = report ? buildPositionSummary(report) : [];

  const kpis = report
    ? [
        {
          label: "Targeted Revenue",
          value: pkr(report.budgetCompare?.totals.budgetRevenue ?? 0),
          note: report.budgetCompare?.hasBudget ? "Income Statement budget" : "No budget plan saved",
          bg: "bg-[#F5F3FF]",
        },
        {
          label: "Actual Revenue",
          value: pkr(report.totals.revenue),
          note: ins?.revenueVsPrev != null ? `${signed(ins.revenueVsPrev)} vs prev month` : "Month collections",
          bg: "bg-[#EFF6FF]",
        },
        {
          label: "Total cost",
          value: pkr(report.totals.totalCost),
          note:
            report.sourceDate
              ? `Matches IS Total Expense · ${report.sourceDate}`
              : ins?.costVsPrev != null
                ? `${signed(ins.costVsPrev)} vs prev month`
                : `Payroll ${pkr(report.totals.payroll)}`,
          bg: "bg-[#FFF1F3]",
        },
        {
          label: "Profit / Loss",
          value: signed(report.totals.netProfit),
          note: ins?.profitNote ?? "",
          bg: report.totals.netProfit >= 0 ? "bg-[#ECFDF5]" : "bg-[#FFF7ED]",
        },
        {
          label: "Net balance",
          value: pkr(report.cash.closingNet),
          note: report.cash.asOf ? `As of ${report.cash.asOf}` : "Closing cash position",
          bg: "bg-[#F0FDFA]",
        },
      ]
    : [];

  const bankChart = (report?.cash.banks ?? [])
    .map((b, i) => ({
      name: b.bank.length > 14 ? `${b.bank.slice(0, 12)}…` : b.bank,
      full: b.bank,
      net: b.balance,
      debit: b.debit ?? 0,
      credit: b.credit ?? 0,
      color: bankColor(i),
    }))
    .filter(b => b.debit !== 0 || b.credit !== 0 || b.net !== 0);

  const sectionChart = (report?.cash.sections ?? []).map(s => ({
    name: s.name.slice(0, 12),
    net: s.net,
  }));

  return (
    <div className="flex min-h-screen accounts-page-bg">
      <AccountsSidebar />
      <main className={`flex-1 min-w-0 overflow-x-hidden ${ACCOUNTS_MAIN_OFFSET}`}>
        <div id="monthly-report" className={`${STAFF_PAGE_PAD} scroll-mt-[80px]`}>
          <div className={`${BENTO_CARD} px-4 sm:px-5 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-end gap-3`}>
            <div className="min-w-0 flex-1">
              <h1 className="font-bold text-[#B8112D] text-xl sm:text-2xl tracking-tight leading-none">
                Executive Summary
              </h1>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-2">
                Accounts Team · {label}
                {report?.daysRecorded != null ? ` · ${report.daysRecorded} day(s) recorded` : ""}
                {report?.sourceDate ? ` · last ${report.sourceDate}` : ""} · BEM Solutions CRM
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <label className="inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-crm-border bg-[#F8FAFC] text-xs font-bold text-crm-text-secondary">
                <CalendarDays size={14} className="text-[#B8112D]" />
                <input
                  type="month"
                  value={month}
                  max={currentMonthIso()}
                  onChange={e => setMonth(e.target.value || currentMonthIso())}
                  className="bg-transparent outline-none text-sm font-semibold text-crm-text"
                />
              </label>
              <button
                type="button"
                disabled={!report || loading || saving}
                onClick={() => void handleSaveReport()}
                className="h-10 px-4 rounded-xl bg-[#2B579A] text-white text-xs font-bold inline-flex items-center gap-2 hover:bg-[#1e4278] disabled:opacity-50 transition-colors shadow-md shadow-[#2B579A]/25"
                title="Download Word + archive to Cloudinary"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Cloud size={15} />}
                {saving ? "Saving…" : "Save Report"}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="bg-crm-surface rounded-2xl border border-crm-border-subtle/90 py-24 flex flex-col items-center justify-center gap-3 text-crm-text-faint">
              <Loader2 size={28} className="animate-spin text-[#B8112D]" />
              <p className="text-sm font-semibold">Building {label} report…</p>
            </div>
          ) : !report ? (
            <div className="bg-crm-surface rounded-2xl border border-crm-border-subtle/90 py-24 text-center text-crm-text-faint text-sm">
              Report did not load — select a month or try again.
            </div>
          ) : (
            <>
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-[11px] text-crm-text-secondary leading-relaxed">
                <b className="text-crm-text">Month compile:</b> Revenue is that month&apos;s project collections
                (once). Total cost, team salaries, OPEX, loans and PF match the latest Income Statement
                day in the month{report.sourceDate ? ` (${report.sourceDate})` : ""} — same Total Expense as
                that IS card. Budget plan vs actual uses the Income Statement budget planner for this month.
                Financial performance splits last 3 months and last 6 months in one block. The position box
                reads this month&apos;s full report automatically.{" "}
                <b>Save Report</b> downloads a Word file and archives it to Cloudinary.
              </section>

              {saved.length > 0 && (
                <section className={`${BENTO_CARD} overflow-hidden`}>
                  <div className="px-4 py-3 border-b border-crm-border-subtle bg-gradient-to-r from-[#EFF8FF] to-white flex items-center gap-2">
                    <Cloud size={14} className="text-[#0B84F3]" />
                    <h2 className="font-extrabold text-crm-text text-sm tracking-tight">Cloudinary Archives — {label}</h2>
                    <span className="text-[10px] text-crm-text-faint font-semibold">{saved.length} file(s)</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {saved.map(s => (
                      <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-crm-text truncate">{s.fileName}</p>
                          <p className="text-[10px] text-crm-text-faint">
                            {formatEstDateTime(s.createdAt)}
                            {s.sourceDate ? ` · through ${s.sourceDate}` : ""}
                          </p>
                        </div>
                        <a
                          href={s.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 px-3 rounded-lg bg-[#EAF5FF] text-[#0B84F3] text-[11px] font-bold inline-flex items-center gap-1.5 hover:bg-[#D6EBFF] shrink-0"
                        >
                          <ExternalLink size={12} /> Open
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
                {kpis.map(k => (
                  <div key={k.label} className={`${k.bg} rounded-xl sm:rounded-2xl p-3 sm:p-4`}>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#64748B] leading-snug">{k.label}</p>
                    <p className="text-lg sm:text-xl font-extrabold mt-1.5 tabular-nums tracking-tight text-[#0F172A]">{k.value}</p>
                    <p className="text-[9px] sm:text-[10px] text-[#64748B] mt-1 font-medium leading-snug">{k.note}</p>
                  </div>
                ))}
              </section>

              <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
                <AccountsChartCard
                  title="Revenue mix"
                  subtitle="AH · SN · CO · QH collections this month"
                  accent="#B8112D"
                  icon={<PieIcon size={16} />}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
                    <RechartsBox height={280}>
                      <PieChart>
                        <Pie
                          data={pieHasData ? pieSlices : pieSlices.map(s => ({ ...s, value: 1 }))}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={0}
                          outerRadius={108}
                          paddingAngle={1}
                          stroke="#fff"
                          strokeWidth={3}
                          label={({ name, percent }) =>
                            (percent ?? 0) >= 0.06 ? String(name) : ""
                          }
                          labelLine={false}
                        >
                          {pieSlices.map(s => (
                            <Cell key={s.name} fill={s.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v, name) => [
                            pieHasData ? pkr(Number(v ?? 0)) : "No collections",
                            PIE_LEGEND.find(l => l.key === name)?.name ?? String(name ?? ""),
                          ]}
                        />
                      </PieChart>
                    </RechartsBox>
                    <ul className="space-y-2 px-2 pb-2">
                      {PIE_LEGEND.map(l => {
                        const slice = pieSlices.find(s => s.name === l.key);
                        return (
                          <li key={l.key} className="flex items-center gap-2 min-w-36">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[l.key] }} />
                            <div className="min-w-0">
                              <p className="text-[11px] font-extrabold text-crm-text leading-none">{l.key}</p>
                              <p className="text-[10px] text-crm-text-muted truncate">{l.name}</p>
                              <p className="text-[10px] font-bold tabular-nums text-crm-text">{pkr(slice?.value ?? 0)}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  {!pieHasData && (
                    <p className="px-3 text-[11px] text-crm-text-faint">No AH / SN / CO / QH collections recorded for {label}.</p>
                  )}
                </AccountsChartCard>

                <AccountsChartCard
                  title={`Budget plan vs actual — ${label}`}
                  subtitle="As of this month · purple planned · blue actual"
                  accent="#7C3AED"
                  icon={<TrendingUp size={16} />}
                >
                  {report.budgetCompare && report.budgetCompare.hasBudget ? (
                    <BudgetVsActualBars data={report.budgetCompare} label={label} />
                  ) : (
                    <p className="px-3 py-8 text-xs text-crm-text-muted text-center">
                      Is month ka Income Statement budget plan save nahi hai. Pehle Income Statement page par budget planner
                      mein plan set karein.
                    </p>
                  )}
                </AccountsChartCard>
              </section>

              <SectionCard title="Financial performance">
                <HistoryPerformanceHalf
                  title="Last 3 months"
                  rows={report.history.slice(-3)}
                  allHistory={report.history}
                  currentMonth={report.month}
                  chartId="report-chart-net3"
                />
                <div className="border-t-2 border-[#B8112D]/15">
                  <HistoryPerformanceHalf
                    title="Last 6 months"
                    rows={report.history}
                    allHistory={report.history}
                    currentMonth={report.month}
                    chartId="report-chart-net6"
                  />
                </div>
              </SectionCard>

              <section
                className={`rounded-2xl border p-4 sm:p-5 ${
                  report.totals.netProfit >= 0
                    ? "bg-emerald-50/50 border-emerald-100"
                    : "bg-amber-50/50 border-amber-100"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`w-9 h-9 rounded-xl inline-flex items-center justify-center text-white shrink-0 ${
                      report.totals.netProfit >= 0 ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  >
                    <Sparkles size={16} />
                  </span>
                  <div className="min-w-0 space-y-2">
                    <h2 className="font-extrabold text-crm-text text-sm tracking-tight">
                      Company position — {label}
                    </h2>
                    {positionSummary.map((p, i) => (
                      <p key={i} className="text-xs text-crm-text-secondary leading-relaxed">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              </section>

              <SectionCard title="Revenue — currency channels">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-140">
                    <thead className="bg-[#0B1220]">
                      <tr>
                        <th className={`${thCls} text-left`}>Channel</th>
                        <th className={`${thCls} text-right`}>USD</th>
                        <th className={`${thCls} text-right`}>CAD</th>
                        <th className={`${thCls} text-right`}>PKR</th>
                        <th className={`${thCls} text-right`}>Net PKR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.revenueChannels ?? []).length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-crm-text-faint text-xs">No channel amounts this month.</td></tr>
                      ) : (
                        (report.revenueChannels ?? []).map(c => (
                          <tr key={c.key} className="border-b border-crm-border-subtle">
                            <td className={`${tdCls} font-bold text-crm-text`}>{c.label}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(c.usd)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(c.cad)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(c.pkr)}</td>
                            <td className={`${tdCls} text-right tabular-nums font-bold`}>{currency(c.netPkr)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#0B84F3]/20 bg-[#EFF6FF]">
                        <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">TOTAL REVENUE</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency((report.revenueChannels ?? []).reduce((a, c) => a + c.usd, 0))}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency((report.revenueChannels ?? []).reduce((a, c) => a + c.cad, 0))}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency((report.revenueChannels ?? []).reduce((a, c) => a + c.pkr, 0))}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs text-[#0B84F3]">{currency(report.totals.revenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title={`Budget plan vs actual — ${label}`}>
                {report.budgetCompare && report.budgetCompare.hasBudget ? (
                  <BudgetComparePanel data={report.budgetCompare} label={label} showChart={false} showMinis={false} />
                ) : (
                  <p className="px-4 pb-4 text-xs text-crm-text-muted">
                    Is month ka Income Statement budget plan save nahi hai. Pehle Income Statement page par budget planner
                    mein plan set karein.
                  </p>
                )}
              </SectionCard>

              <SectionCard title={`Cash flow statement${report.cash.asOf ? ` — as of ${report.cash.asOf}` : ""}`}>
                <div className="p-4 space-y-4">
                  <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 rounded-2xl border-2 border-[#B8112D]/20 p-5 text-white bg-gradient-to-br from-[#B8112D] to-[#8b0d22] shadow-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet size={18} className="text-white/80" />
                        <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">Net Cash Flow</p>
                      </div>
                      <p className="text-3xl font-extrabold tabular-nums">{currency(report.cash.monthNet)}</p>
                      <p className="text-[11px] text-white/60 mt-2">
                        {report.cash.monthEntries ?? 0} entries in {label} · closing {currency(report.cash.closingNet)}
                      </p>
                    </div>
                    <div className="lg:col-span-8 bg-crm-surface rounded-2xl border-2 border-[#B8112D]/20 p-4 sm:p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 size={16} className="text-[#B8112D]" />
                        <h3 className="font-bold text-sm text-crm-text">Bank Accounts</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {report.cash.banks.length === 0 ? (
                          <p className="text-xs text-crm-text-faint">No bank heads recorded this month.</p>
                        ) : (
                          report.cash.banks.map((b, i) => (
                            <span
                              key={b.bank}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white"
                              style={{ backgroundColor: bankColor(i) }}
                            >
                              {b.bank}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </section>

                  <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <AccountsChartCard
                      title="Net by Section"
                      subtitle="Cash movement across month sections"
                      accent="#B8112D"
                      icon={<Activity size={16} />}
                    >
                      <RechartsBox height={230}>
                        <AreaChart data={sectionChart.length ? sectionChart : [{ name: "—", net: 0 }]}>
                          <defs>
                            <linearGradient id="reportCfArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#B8112D" stopOpacity={0.4} />
                              <stop offset="100%" stopColor="#B8112D" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={v => currency(Number(v ?? 0))} />
                          <Area type="monotone" dataKey="net" stroke="#B8112D" fill="url(#reportCfArea)" strokeWidth={2.5} />
                        </AreaChart>
                      </RechartsBox>
                    </AccountsChartCard>

                    <AccountsChartCard
                      title="Bank Activity"
                      subtitle="Volume share per bank"
                      accent="#0B84F3"
                      icon={<PieIcon size={16} />}
                    >
                      <RechartsBox height={230}>
                        {bankChart.length > 0 ? (
                          <PieChart>
                            <Pie
                              data={bankChart.map(b => ({
                                name: b.name,
                                value: Math.abs(b.net) || Math.abs(b.debit) + Math.abs(b.credit) || 1,
                                color: b.color,
                              }))}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={55}
                              outerRadius={88}
                              paddingAngle={3}
                              stroke="#fff"
                              strokeWidth={2}
                            >
                              {bankChart.map((b, i) => (
                                <Cell key={b.full} fill={b.color || CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={v => currency(Number(v ?? 0))} />
                          </PieChart>
                        ) : (
                          <BarChart data={[{ name: "No activity", value: 0 }]}>
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Bar dataKey="value" fill="#E2E8F0" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        )}
                      </RechartsBox>
                    </AccountsChartCard>
                  </section>

                  {bankChart.length > 0 && (
                    <AccountsChartCard
                      title="Bank Debit vs Credit"
                      subtitle="Side-by-side activity"
                      accent="#12B76A"
                      icon={<Wallet size={16} />}
                    >
                      <RechartsBox height={220}>
                        <BarChart data={bankChart} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip formatter={v => currency(Number(v ?? 0))} />
                          <Bar dataKey="debit" name="Debit" fill="#0B84F3" radius={[8, 8, 0, 0]} />
                          <Bar dataKey="credit" name="Credit" fill="#B8112D" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </RechartsBox>
                    </AccountsChartCard>
                  )}

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-140">
                      <thead className="bg-[#0B1220]">
                        <tr>
                          <th className={`${thCls} text-left`}>Bank</th>
                          <th className={`${thCls} text-right`}>Debit (PKR)</th>
                          <th className={`${thCls} text-right`}>Credit (PKR)</th>
                          <th className={`${thCls} text-right`}>Net (PKR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.cash.banks.length === 0 ? (
                          <tr><td colSpan={4} className="px-3 py-6 text-center text-crm-text-faint text-xs">No cash flow entries recorded.</td></tr>
                        ) : (
                          report.cash.banks.map(b => (
                            <tr key={b.bank} className="border-b border-crm-border-subtle">
                              <td className={`${tdCls} font-semibold text-crm-text-secondary`}>{b.bank}</td>
                              <td className={`${tdCls} text-right tabular-nums`}>{currency(b.debit ?? 0)}</td>
                              <td className={`${tdCls} text-right tabular-nums`}>{currency(b.credit ?? 0)}</td>
                              <td className={`${tdCls} text-right tabular-nums font-bold ${b.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {signed(b.balance)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#B8112D]/20 bg-[#FFF1F3]">
                          <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">MONTH NET</td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">
                            {currency(report.cash.banks.reduce((a, b) => a + (b.debit ?? 0), 0))}
                          </td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">
                            {currency(report.cash.banks.reduce((a, b) => a + (b.credit ?? 0), 0))}
                          </td>
                          <td className={`px-3 py-2.5 text-right font-extrabold tabular-nums text-xs ${report.cash.monthNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {signed(report.cash.monthNet)}
                          </td>
                        </tr>
                        <tr className="bg-[#F8FAFC]">
                          <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs" colSpan={3}>CLOSING CASH (NET)</td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-[#0D9488] text-xs">{currency(report.cash.closingNet)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="overflow-x-auto">
                    <p className="text-[11px] font-bold text-[#0B1220] mb-2">Cash flow ledger — each entry</p>
                    <table className="w-full text-sm" style={{ minWidth: `${520 + report.cash.banks.length * 140}px` }}>
                      <thead className="bg-[#0B1220]">
                        <tr>
                          <th className={`${thCls} text-left`}>Date</th>
                          <th className={`${thCls} text-left`}>Section</th>
                          <th className={`${thCls} text-left`}>Description</th>
                          {report.cash.banks.map((b, i) => (
                            <th key={b.bank} colSpan={2} className={`${thCls} text-center`} style={{ borderBottom: `3px solid ${bankColor(i)}` }}>
                              {b.bank}
                              <span className="block text-[9px] font-semibold text-white/70 normal-case tracking-normal">Dr / Cr</span>
                            </th>
                          ))}
                          <th className={`${thCls} text-right`}>Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.cash.ledger ?? []).length === 0 ? (
                          <tr>
                            <td colSpan={4 + report.cash.banks.length * 2} className="px-3 py-6 text-center text-crm-text-faint text-xs">
                              No cash flow rows dated in this month.
                            </td>
                          </tr>
                        ) : (
                          (report.cash.ledger ?? []).map((r, i) => {
                            const byBank = new Map(r.banks.map(b => [b.bank, b]));
                            return (
                              <tr key={`${r.date}-${r.description}-${i}`} className="border-b border-crm-border-subtle">
                                <td className={`${tdCls} text-crm-text-secondary whitespace-nowrap`}>{r.date || "—"}</td>
                                <td className={`${tdCls} text-crm-text-muted`}>{r.section}</td>
                                <td className={`${tdCls} font-semibold text-crm-text`}>{r.description}</td>
                                {report.cash.banks.map(b => {
                                  const x = byBank.get(b.bank);
                                  return (
                                    <Fragment key={b.bank}>
                                      <td className={`${tdCls} text-right tabular-nums`}>{currency(x?.debit ?? 0)}</td>
                                      <td className={`${tdCls} text-right tabular-nums`}>{currency(x?.credit ?? 0)}</td>
                                    </Fragment>
                                  );
                                })}
                                <td className={`${tdCls} text-right tabular-nums font-bold ${r.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                  {signed(r.net)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-[#B8112D]/20 bg-[#FFF1F3]">
                          <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs" colSpan={3 + report.cash.banks.length * 2}>
                            MONTH NET ({report.cash.monthEntries ?? 0} entries)
                          </td>
                          <td className={`px-3 py-2.5 text-right font-extrabold tabular-nums text-xs ${report.cash.monthNet >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {signed(report.cash.monthNet)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </SectionCard>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
                <div className="xl:col-span-7">
                  <SectionCard title={`CSR team performance — ${label}`}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-140">
                        <thead className="bg-[#0B1220]">
                          <tr className="border-b border-crm-border/80">
                            <th className={`${thCls} text-left`}>CSR</th>
                            <th className={`${thCls} text-right`}>Projects – {monthNameOnly(report.month)}</th>
                            <th className={`${thCls} text-right`}>Share %</th>
                            <th className={`${thCls} text-center`}>Status</th>
                            <th className={`${thCls} text-left`}>Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.csr.rows.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-3 py-6 text-center text-crm-text-faint text-xs">
                                No sales / team-lead CSRs recorded this month.
                              </td>
                            </tr>
                          ) : (
                            report.csr.rows.map((r, i) => {
                              const status = r.status || (r.projects > 0 ? "Active" : "Below Expectation");
                              return (
                                <tr key={`${r.code}-${r.name}`} className={`border-b border-crm-border-subtle ${i % 2 === 0 ? "bg-[#EFF6FF]" : "bg-crm-surface"}`}>
                                  <td className={`${tdCls} font-semibold text-crm-text`}>{r.name}</td>
                                  <td className={`${tdCls} text-right tabular-nums font-bold`}>{r.projects}</td>
                                  <td className={`${tdCls} text-right tabular-nums`}>{r.share.toFixed(1)}%</td>
                                  <td className={`${tdCls} text-center`}>
                                    <span className={`text-[11px] font-bold ${
                                      status === "Top Performer"
                                        ? "text-emerald-600"
                                        : status === "Below Expectation"
                                          ? "text-red-600"
                                          : "text-crm-text"
                                    }`}>
                                      {status}
                                    </span>
                                  </td>
                                  <td className={`${tdCls} text-crm-text-secondary`}>{r.note || "—"}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 bg-[#0B1220]">
                            <td className="px-3 py-2.5 font-extrabold text-white text-xs">TOTAL</td>
                            <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-white text-xs">{report.csr.totalProjects}</td>
                            <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-white text-xs">100%</td>
                            <td />
                            <td className="px-3 py-2.5 text-[10px] text-white/70">Closing rate tracking live from {monthNameOnly(report.month)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </SectionCard>
                </div>
                <div className="xl:col-span-5">
                  <SectionCard title="Projects by CSR">
                    <div className="p-4">
                      <RechartsBox height={Math.max(220, report.csr.rows.length * 36)}>
                        <BarChart
                          data={report.csr.rows.map(r => ({ name: r.name, projects: r.projects }))}
                          layout="vertical"
                          margin={{ left: 8, right: 12 }}
                          barSize={14}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10, fontWeight: 600 }} />
                          <Tooltip />
                          <Bar dataKey="projects" name="Projects" fill="#0B84F3" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </RechartsBox>
                    </div>
                  </SectionCard>
                </div>
              </div>

              {(report.salaryTables ?? []).length === 0 ? (
                <SectionCard title={`Team salaries (${pkr(report.totals.payroll)})`}>
                  <p className="px-4 py-6 text-center text-xs text-crm-text-faint">
                    No employees on the latest Income Statement for this month.
                  </p>
                </SectionCard>
              ) : (
                (report.salaryTables ?? []).map(t => (
                  <SectionCard key={t.name} title={`${t.name} (${pkr(t.total)})`}>
                    <SalaryFieldTableView table={t} />
                  </SectionCard>
                ))
              )}

              <SectionCard title={`Operating expenses (${pkr(report.totals.opex)})`}>
                <OpexFieldTableView tables={report.opexTables ?? []} total={report.totals.opex} />
              </SectionCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title={`Loans (${pkr(report.totals.loans)})`}>
                  <OpexFieldTableView tables={report.loanTables ?? []} total={report.totals.loans} />
                </SectionCard>
                <SectionCard title={`Provident fund (${pkr(report.totals.pf)})`}>
                  <OpexFieldTableView tables={report.pfTables ?? []} total={report.totals.pf} />
                </SectionCard>
              </div>

              <SectionCard title={`Executive salaries — ${label}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-200">
                    <thead className="bg-[#0B1220]">
                      <tr className="border-b border-crm-border/80">
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
                        <tr><td colSpan={8} className="px-3 py-6 text-center text-crm-text-faint text-xs">No executive salary entries this month.</td></tr>
                      ) : (
                        report.executives.map(e => (
                          <tr key={e.name} className="border-b border-crm-border-subtle">
                            <td className={`${tdCls} font-semibold text-crm-text-secondary`}>{e.name}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(e.basic)}</td>
                            <td className={`${tdCls} text-right tabular-nums text-indigo-600 font-bold`}>{e.commissionPct}%</td>
                            <td className={`${tdCls} text-right tabular-nums text-emerald-700`}>{currency(e.commission)}</td>
                            <td className={`${tdCls} text-right tabular-nums font-bold text-[#B8112D]`}>{currency(e.total)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(e.loanPositive)}</td>
                            <td className={`${tdCls} text-right tabular-nums text-red-600`}>{currency(e.loanNegative)}</td>
                            <td className={`${tdCls} text-crm-text-muted max-w-45 truncate`} title={e.remarks || undefined}>{e.remarks || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {report.executives.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#B8112D]/20 bg-[#B8112D]/5">
                          <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">TOTAL SALARY</td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.executives.reduce((s, e) => s + e.basic, 0))}</td>
                          <td />
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs text-emerald-700">{currency(report.executives.reduce((s, e) => s + e.commission, 0))}</td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs text-[#B8112D]">{currency(report.executives.reduce((s, e) => s + e.total, 0))}</td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </SectionCard>

              <p className="text-center text-[10px] text-[#94A3B8] pb-6">
                Auto-generated from CRM accounts daily records, cash flow & payroll · {label}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
