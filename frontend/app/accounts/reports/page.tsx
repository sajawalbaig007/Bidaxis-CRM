"use client";

import { Fragment, useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, Cloud, ExternalLink, Loader2,
  Sparkles, TrendingUp, Wallet, Building2, Activity, PieChart as PieIcon,
} from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
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
  collections?: {
    client: string;
    projectCode: string;
    channel: string;
    channelLabel: string;
    currency: string;
    amount: number;
    paidAt: string;
    type: string;
  }[];
  days?: {
    date: string;
    payroll: number;
    opex: number;
    loans: number;
    pf: number;
    cost: number;
  }[];
  history: { month: string; revenue: number; cost: number; net: number; days?: number; lastDate?: string }[];
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
      fixClients?: { clientName: string; projectPay: number; currency: string }[];
    }[];
  };
  daysRecorded: number;
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
  const AMBER = "#D97706";
  const VIOLET = "#7C3AED";
  const TEAL = "#0D9488";
  const SLATE = "#334155";

  const th = `style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;"`;
  const thR = `style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;text-align:right;"`;
  const thC = `style="background:${NAVY};color:#fff;padding:6px 8px;font-size:10px;text-align:center;"`;
  const td = `style="padding:5px 8px;border:1px solid #E2E8F0;font-size:10px;"`;
  const tdR = `style="padding:5px 8px;border:1px solid #E2E8F0;font-size:10px;text-align:right;"`;
  const tdC = `style="padding:5px 8px;border:1px solid #E2E8F0;font-size:10px;text-align:center;"`;
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

  const card = (title: string, value: string, subTxt: string, bg: string) =>
    `<td width="25%" style="padding:6px;">
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

  const costMix: { name: string; total: number; color: string }[] = [
    { name: "Team Salaries", total: report.totals.payroll, color: RED },
    { name: "OPEX", total: report.totals.opex, color: BLUE },
    { name: "Loans", total: report.totals.loans, color: AMBER },
    { name: "Provident Fund", total: report.totals.pf, color: VIOLET },
  ];
  const maxCostMix = Math.max(...costMix.map(c => c.total), 1);
  const costMixBars = costMix.map(c => barRow(c.name, c.total, maxCostMix, c.color, pkr(c.total))).join("");

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

  const movement = (name: string, v: number | null, goodWhenUp: boolean) => {
    if (v == null) return "";
    const good = goodWhenUp ? v >= 0 : v < 0;
    return `<tr>
      <td ${td}><b>${name}</b></td>
      <td ${tdR}><b style="color:${good ? GREEN_D : RED_TXT};">${signed(v)}</b></td>
      ${good ? statusCell("Favorable", "#D1FADF", GREEN_D) : statusCell("Unfavorable", "#FEE4E2", RED_TXT)}
    </tr>`;
  };

  const categoryRows = (groups: CategoryGroup[]) =>
    groups
      .map(g => {
        const head = `<tr style="background:#FFF1F3;">
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
    <h2>${title}</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr><td ${th}>Head</td><td ${thR}>Amount (PKR)</td></tr>
      ${categoryRows(groups) || tdEmpty(2, "No entries this month.")}
      <tr style="background:#FFF1F3;"><td ${td}><b>TOTAL</b></td><td ${tdR}><b style="color:${RED};">${currency(total)}</b></td></tr>
    </table>`;

  const csrColSpan = 15;
  const csrRows = report.csr.rows
    .map(r => {
      const status =
        r.share >= 30
          ? statusCell("Top Performer", "#D1FADF", GREEN_D)
          : r.projects > 0
            ? statusCell("Active", "#DBEAFE", "#1D4ED8")
            : statusCell("Below Expectation", "#FEE4E2", RED_TXT);
      return `<tr>
        <td ${td}><b>${r.name}</b>${r.code ? `<br/><span style="color:#64748B;font-size:9px;">${r.code}</span>` : ""}</td>
        <td ${td}>${r.roleLabel}</td>
        <td ${tdC}>${r.assignedToLead ? "Yes" : "—"}</td>
        <td ${tdR}>${r.oldProjects}</td>
        <td ${tdR}>${r.partialCount}</td>
        <td ${tdR}>${r.newProjects}</td>
        <td ${tdR}>${r.fixProjects}</td>
        <td ${tdR}>${currency(r.fixPay)}</td>
        <td ${tdR}><b>${r.projects}</b></td>
        <td ${tdR}>${currency(r.oldComm)}</td>
        <td ${tdR}>${currency(r.newComm)}</td>
        <td ${tdR}>${currency(r.fixComm)}</td>
        <td ${tdR}><b style="color:${GREEN_D};">${currency(r.totalCommission)}</b></td>
        <td ${tdR}>${r.share.toFixed(1)}%</td>
        ${status}
      </tr>`;
    })
    .join("");
  const ct = report.csr.totals ?? {
    oldProjects: 0,
    partialCount: 0,
    newProjects: 0,
    fixProjects: 0,
    fixPay: 0,
    oldComm: 0,
    newComm: 0,
    fixComm: 0,
    totalCommission: 0,
  };

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

  const collectionRows = (report.collections ?? [])
    .map(
      c => `<tr>
        <td ${td}>${c.paidAt || "—"}</td>
        <td ${td}><b>${c.client}</b>${c.projectCode ? `<br/><span style="color:#64748B;font-size:9px;">${c.projectCode}</span>` : ""}</td>
        <td ${td}>${c.channelLabel || c.channel}</td>
        <td ${td}>${c.type || "—"}</td>
        <td ${tdC}>${c.currency}</td>
        <td ${tdR}><b>${currency(c.amount)}</b></td>
      </tr>`,
    )
    .join("");

  const dayRows = (report.days ?? [])
    .map(
      d => `<tr>
        <td ${td}>${d.date}</td>
        <td ${tdR}>${currency(d.payroll)}</td>
        <td ${tdR}>${currency(d.opex)}</td>
        <td ${tdR}>${currency(d.loans)}</td>
        <td ${tdR}>${currency(d.pf)}</td>
        <td ${tdR}><b>${currency(d.cost)}</b></td>
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

  const fixRows = report.csr.rows
    .flatMap(r =>
      (r.fixClients ?? []).map(
        p => `<tr>
          <td ${td}><b>${r.name}</b></td>
          <td ${td}>${p.clientName}</td>
          <td ${tdC}>${p.currency}</td>
          <td ${tdR}>${currency(p.projectPay)}</td>
        </tr>`,
      ),
    )
    .join("");

  const generatedAt = new Date().toLocaleString("en-GB");

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
  <h1>Accounts Team — Monthly Report</h1>
  <p class="meta">${label} · Generated ${generatedAt} · BEM Solutions CRM</p>

  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    ${card("Revenue", pkr(report.totals.revenue), ins.revenueVsPrev != null ? `${signed(ins.revenueVsPrev)} vs prev month` : "Month collections", "#EFF6FF")}
    ${card("Total cost", pkr(report.totals.totalCost), ins.costVsPrev != null ? `${signed(ins.costVsPrev)} vs prev month` : `Payroll ${pkr(report.totals.payroll)}`, "#FFF1F3")}
    ${card("Net profit", signed(net), ins.profitNote, net >= 0 ? "#ECFDF5" : "#FFF7ED")}
    ${card("Cash (net)", pkr(report.cash.closingNet), report.cash.asOf ? `As of ${report.cash.asOf}` : "Closing position", "#F5F3FF")}
  </tr></table>

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

  <h2>Revenue — each collection</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>Paid</td><td ${th}>Client / Code</td><td ${th}>Channel</td><td ${th}>Type</td><td ${thC}>Ccy</td><td ${thR}>Amount</td>
    </tr>
    ${collectionRows || tdEmpty(6, "No paid project collections this month.")}
    <tr style="background:#F8FAFC;">
      <td ${td} colspan="5"><b>${(report.collections ?? []).length} payment(s)</b></td>
      <td ${tdR}><b>${currency((report.collections ?? []).reduce((a, c) => a + c.amount, 0))}</b></td>
    </tr>
  </table>

  <h2>Daily income statement — ${label}</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>Date</td><td ${thR}>Payroll</td><td ${thR}>OPEX</td><td ${thR}>Loans</td><td ${thR}>PF</td><td ${thR}>Day cost</td>
    </tr>
    ${dayRows || tdEmpty(6, "No income statement days recorded.")}
    <tr style="background:#FFF1F3;">
      <td ${td}><b>TOTAL (${report.daysRecorded} day${report.daysRecorded === 1 ? "" : "s"})</b></td>
      <td ${tdR}><b>${currency(report.totals.payroll)}</b></td>
      <td ${tdR}><b>${currency(report.totals.opex)}</b></td>
      <td ${tdR}><b>${currency(report.totals.loans)}</b></td>
      <td ${tdR}><b>${currency(report.totals.pf)}</b></td>
      <td ${tdR}><b>${currency(report.totals.totalCost)}</b></td>
    </tr>
  </table>

  <h2>Financial performance — month by month</h2>
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

  ${
    ins.prev
      ? `<h2>Key movements — vs ${monthShort(ins.prev.month)}</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr><td ${th}>Metric</td><td ${thR}>Change (PKR)</td><td ${thC}>Direction</td></tr>
    ${movement("Revenue", ins.revenueVsPrev, true)}
    ${movement("Total Cost", ins.costVsPrev, false)}
    ${movement("Net Profit Swing", ins.netVsPrev, true)}
  </table>`
      : ""
  }

  <h2>Cost mix — ${pkr(report.totals.totalCost)}</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${costMixBars}</table>

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
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>CSR</td>
      <td ${th}>Role</td>
      <td ${thC}>Assigned TL</td>
      <td ${thR}>Old Proj</td>
      <td ${thR}>Partial</td>
      <td ${thR}>New Proj</td>
      <td ${thR}>Fix Proj</td>
      <td ${thR}>Fix Pay</td>
      <td ${thR}>Total Proj</td>
      <td ${thR}>Old Comm</td>
      <td ${thR}>New Comm</td>
      <td ${thR}>Fix Comm</td>
      <td ${thR}>Total Comm</td>
      <td ${thR}>Share %</td>
      <td ${thC}>Status</td>
    </tr>
    ${csrRows || tdEmpty(csrColSpan, "No sales / team-lead CSRs recorded this month.")}
    <tr style="background:#F8FAFC;">
      <td ${td} colspan="3"><b>TOTAL</b></td>
      <td ${tdR}><b>${ct.oldProjects}</b></td>
      <td ${tdR}><b>${ct.partialCount}</b></td>
      <td ${tdR}><b>${ct.newProjects}</b></td>
      <td ${tdR}><b>${ct.fixProjects}</b></td>
      <td ${tdR}><b>${currency(ct.fixPay)}</b></td>
      <td ${tdR}><b>${report.csr.totalProjects}</b></td>
      <td ${tdR}><b>${currency(ct.oldComm)}</b></td>
      <td ${tdR}><b>${currency(ct.newComm)}</b></td>
      <td ${tdR}><b>${currency(ct.fixComm)}</b></td>
      <td ${tdR}><b style="color:${GREEN_D};">${currency(ct.totalCommission)}</b></td>
      <td ${tdR}><b>100%</b></td>
      <td ${td}></td>
    </tr>
  </table>

  <h2>CSR fix projects — each client</h2>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
    <tr>
      <td ${th}>CSR</td><td ${th}>Client</td><td ${thC}>Currency</td><td ${thR}>Project pay</td>
    </tr>
    ${fixRows || tdEmpty(4, "No fix-client projects this month.")}
  </table>

  ${catSection(`Team salaries — cost breakdown (${pkr(report.totals.payroll)})`, report.salaryTeams, report.totals.payroll)}
  ${catSection(`Operating expenses (${pkr(report.totals.opex)})`, report.opexHeads, report.totals.opex)}
  ${catSection(`Loans (${pkr(report.totals.loans)})`, report.loanHeads, report.totals.loans)}
  ${catSection(`Provident fund (${pkr(report.totals.pf)})`, report.pfHeads, report.totals.pf)}

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

/** Slim horizontal share bar. */
function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-2 rounded-full bg-crm-muted overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(pct, pct > 0 ? 3 : 0), 100)}%`, background: color }} />
    </div>
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

const thCls = "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white";
const tdCls = "px-3 py-2 text-xs";

function CategoryTable({ groups, total }: { groups: CategoryGroup[]; total: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-130">
        <thead className="bg-[#0B1220]">
          <tr className="border-b border-crm-border/80">
            <th className={`${thCls} text-left`}>Head</th>
            <th className={`${thCls} text-right w-40`}>Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr><td colSpan={2} className="px-3 py-6 text-center text-crm-text-faint text-xs">No entries this month.</td></tr>
          ) : (
            groups.map(g => (
              <FragmentRows key={g.name} group={g} />
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-[#B8112D]/20 bg-[#B8112D]/5">
            <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">TOTAL</td>
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
      <tr className="border-b border-crm-border-subtle bg-crm-surface">
        <td className={`${tdCls} font-bold text-crm-text`}>{group.name}</td>
        <td className={`${tdCls} text-right font-bold tabular-nums text-crm-text`}>{currency(group.total)}</td>
      </tr>
      {group.lines.map(l => (
        <tr key={`${group.name}-${l.label}`} className="border-b border-crm-border-subtle bg-[#FCFCFD]">
          <td className="px-3 py-1.5 pl-8 text-[11px] text-crm-text-muted">– {l.label}</td>
          <td className="px-3 py-1.5 text-right text-[11px] tabular-nums text-crm-text-muted">{currency(l.amount)}</td>
        </tr>
      ))}
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

  const histTotals = (report?.history ?? []).reduce(
    (a, h) => ({ revenue: a.revenue + h.revenue, cost: a.cost + h.cost, net: a.net + h.net }),
    { revenue: 0, cost: 0, net: 0 },
  );

  const costMix = report
    ? [
        { name: "Team Salaries", value: report.totals.payroll, color: "#B8112D" },
        { name: "OPEX", value: report.totals.opex, color: "#0B84F3" },
        { name: "Loans", value: report.totals.loans, color: "#F59E0B" },
        { name: "Provident Fund", value: report.totals.pf, color: "#6D28D9" },
      ].filter(c => c.value > 0)
    : [];
  const costMixSum = costMix.reduce((a, c) => a + c.value, 0);

  const kpis = report
    ? [
        {
          label: "Revenue",
          value: pkr(report.totals.revenue),
          note: ins?.revenueVsPrev != null ? `${signed(ins.revenueVsPrev)} vs prev month` : "Month collections",
          bg: "bg-[#EFF6FF]",
        },
        {
          label: "Total cost",
          value: pkr(report.totals.totalCost),
          note: ins?.costVsPrev != null ? `${signed(ins.costVsPrev)} vs prev month` : `Payroll ${pkr(report.totals.payroll)}`,
          bg: "bg-[#FFF1F3]",
        },
        {
          label: "Net profit",
          value: signed(report.totals.netProfit),
          note: ins?.profitNote ?? "",
          bg: report.totals.netProfit >= 0 ? "bg-[#ECFDF5]" : "bg-[#FFF7ED]",
        },
        {
          label: "Cash (net)",
          value: pkr(report.cash.closingNet),
          note: report.cash.asOf ? `As of ${report.cash.asOf}` : "Closing position",
          bg: "bg-[#F5F3FF]",
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
                Accounts Team — Monthly Report
              </h1>
              <p className="text-[11px] sm:text-xs text-[#64748B] mt-2">
                {label}
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
                (once, not per day). Team Salaries, OPEX, Loans, PF and Executives are summed from every
                Income Statement day in the month
                — {report.daysRecorded} day(s) recorded
                {report.sourceDate ? ` · last entry ${report.sourceDate}` : ""}.{" "}
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
                            {new Date(s.createdAt).toLocaleString()}
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

              <section className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {kpis.map(k => (
                  <div key={k.label} className={`${k.bg} rounded-xl sm:rounded-2xl p-3 sm:p-4`}>
                    <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-[#64748B] leading-snug">{k.label}</p>
                    <p className="text-lg sm:text-xl font-extrabold mt-1.5 tabular-nums tracking-tight text-[#0F172A]">{k.value}</p>
                    <p className="text-[9px] sm:text-[10px] text-[#64748B] mt-1 font-medium leading-snug">{k.note}</p>
                  </div>
                ))}
              </section>

              <section
                className={`rounded-2xl border p-3.5 sm:p-4 flex items-start gap-3 ${
                  report.totals.netProfit >= 0
                    ? "bg-emerald-50/60 border-emerald-100"
                    : "bg-amber-50/60 border-amber-100"
                }`}
              >
                <span
                  className={`w-8 h-8 rounded-xl inline-flex items-center justify-center text-white shrink-0 ${
                    report.totals.netProfit >= 0 ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                >
                  <Sparkles size={15} />
                </span>
                <p className="text-xs text-crm-text-secondary leading-relaxed">
                  <b className="text-crm-text">{label}</b> posted a net {report.totals.netProfit >= 0 ? "profit" : "loss"} of{" "}
                  <b className={report.totals.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}>{signed(report.totals.netProfit)}</b>{" "}
                  ({ins?.profitNote.toLowerCase()}).
                  {ins?.revenueVsPrev != null && <> Revenue moved <b>{signed(ins.revenueVsPrev)}</b> vs previous month</>}
                  {ins?.costVsPrev != null && <> while total cost moved <b>{signed(ins.costVsPrev)}</b>.</>}
                  {" "}Net cash stands at <b className="text-teal-700">{pkr(report.cash.closingNet)}</b>
                  {report.cash.asOf ? ` as of ${report.cash.asOf}` : ""} with {signed(report.cash.monthNet)} movement during the month.
                </p>
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

              <SectionCard title={`Revenue — each collection (${(report.collections ?? []).length})`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-180">
                    <thead className="bg-[#0B1220]">
                      <tr>
                        <th className={`${thCls} text-left`}>Paid</th>
                        <th className={`${thCls} text-left`}>Client / Code</th>
                        <th className={`${thCls} text-left`}>Channel</th>
                        <th className={`${thCls} text-left`}>Type</th>
                        <th className={`${thCls} text-center`}>Ccy</th>
                        <th className={`${thCls} text-right`}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.collections ?? []).length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-crm-text-faint text-xs">No paid project collections this month.</td></tr>
                      ) : (
                        (report.collections ?? []).map((c, i) => (
                          <tr key={`${c.client}-${c.paidAt}-${i}`} className="border-b border-crm-border-subtle">
                            <td className={`${tdCls} text-crm-text-secondary`}>{c.paidAt || "—"}</td>
                            <td className={`${tdCls} font-semibold text-crm-text`}>
                              {c.client}
                              {c.projectCode ? <span className="block text-[10px] font-normal text-crm-text-faint">{c.projectCode}</span> : null}
                            </td>
                            <td className={`${tdCls} text-crm-text-secondary`}>{c.channelLabel || c.channel}</td>
                            <td className={`${tdCls} text-crm-text-muted`}>{c.type || "—"}</td>
                            <td className={`${tdCls} text-center`}>{c.currency}</td>
                            <td className={`${tdCls} text-right tabular-nums font-bold`}>{currency(c.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#0B84F3]/20 bg-[#EFF6FF]">
                        <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs" colSpan={5}>{(report.collections ?? []).length} payment(s)</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency((report.collections ?? []).reduce((a, c) => a + c.amount, 0))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title={`Daily income statement — ${label}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-160">
                    <thead className="bg-[#0B1220]">
                      <tr>
                        <th className={`${thCls} text-left`}>Date</th>
                        <th className={`${thCls} text-right`}>Payroll</th>
                        <th className={`${thCls} text-right`}>OPEX</th>
                        <th className={`${thCls} text-right`}>Loans</th>
                        <th className={`${thCls} text-right`}>PF</th>
                        <th className={`${thCls} text-right`}>Day cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(report.days ?? []).length === 0 ? (
                        <tr><td colSpan={6} className="px-3 py-6 text-center text-crm-text-faint text-xs">No income statement days recorded.</td></tr>
                      ) : (
                        (report.days ?? []).map(d => (
                          <tr key={d.date} className="border-b border-crm-border-subtle">
                            <td className={`${tdCls} font-bold text-crm-text`}>{d.date}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(d.payroll)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(d.opex)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(d.loans)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(d.pf)}</td>
                            <td className={`${tdCls} text-right tabular-nums font-bold`}>{currency(d.cost)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#B8112D]/20 bg-[#FFF1F3]">
                        <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">TOTAL ({report.daysRecorded} day{report.daysRecorded === 1 ? "" : "s"})</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.totals.payroll)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.totals.opex)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.totals.loans)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.totals.pf)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs text-[#B8112D]">{currency(report.totals.totalCost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="Financial performance — month by month">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-160">
                    <thead className="bg-[#0B1220]">
                      <tr className="border-b border-crm-border/80">
                        <th className={`${thCls} text-left`}>Month</th>
                        <th className={`${thCls} text-right`}>Revenue (PKR)</th>
                        <th className={`${thCls} text-right`}>Total Cost (PKR)</th>
                        <th className={`${thCls} text-right`}>Net P/L (PKR)</th>
                        <th className={`${thCls} text-center w-24`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.history.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-8 text-center text-crm-text-faint text-xs">No income statement records yet.</td></tr>
                      ) : (
                        report.history.map((h, i) => {
                          const prev = i > 0 ? report.history[i - 1] : null;
                          return (
                            <tr
                              key={h.month}
                              className={`border-b border-crm-border-subtle ${h.month === report.month ? "bg-[#FFF6F8]" : "bg-crm-surface"}`}
                            >
                              <td className={`${tdCls} font-bold text-crm-text`}>
                                {monthShort(h.month)}
                                {h.month === report.month && <span className="ml-2 text-[9px] font-bold text-[#B8112D] uppercase">This report</span>}
                              </td>
                              <td className={`${tdCls} text-right tabular-nums`}>
                                {currency(h.revenue)}
                                <div><TrendArrow v={prev ? h.revenue - prev.revenue : null} goodWhenUp /></div>
                              </td>
                              <td className={`${tdCls} text-right tabular-nums`}>
                                {currency(h.cost)}
                                <div><TrendArrow v={prev ? h.cost - prev.cost : null} goodWhenUp={false} /></div>
                              </td>
                              <td className={`${tdCls} text-right font-bold tabular-nums ${h.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{signed(h.net)}</td>
                              <td className={`${tdCls} text-center`}>
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${h.net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                  {h.net >= 0 ? "Profit" : "Loss"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {report.history.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-crm-border bg-[#FAFBFC]">
                          <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs">TOTAL</td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(histTotals.revenue)}</td>
                          <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(histTotals.cost)}</td>
                          <td className={`px-3 py-2.5 text-right font-extrabold tabular-nums text-xs ${histTotals.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{signed(histTotals.net)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${histTotals.net >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                              {histTotals.net >= 0 ? "Profit" : "Loss"}
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </SectionCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title="Net profit / loss trend">
                  <div className="p-4" id="report-chart-net">
                    <RechartsBox height={230}>
                      <BarChart data={report.history.map(h => ({ name: monthShort(h.month), net: h.net }))} barSize={26}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={v => pkr(Number(v ?? 0))} />
                        <Bar dataKey="net" name="Net P/L" radius={[8, 8, 0, 0]}>
                          {report.history.map(h => (
                            <Cell key={h.month} fill={h.net >= 0 ? "#12B76A" : "#EF4444"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </RechartsBox>
                    <p className="text-[11px] text-crm-text-muted mt-2 flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-[#B8112D] shrink-0" />
                      {label}: {signed(report.totals.netProfit)} net — {ins?.profitNote}.
                      {ins?.netVsPrev != null && ` Swing vs previous month: ${signed(ins.netVsPrev)}.`}
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="Revenue vs total cost">
                  <div className="p-4" id="report-chart-revcost">
                    <RechartsBox height={230}>
                      <BarChart
                        data={report.history.map(h => ({ name: monthShort(h.month), revenue: h.revenue, cost: h.cost }))}
                        barSize={12}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 600 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={v => pkr(Number(v ?? 0))} />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
                        <Bar dataKey="revenue" name="Revenue" fill="#0B84F3" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="cost" name="Total Cost" fill="#F97066" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </RechartsBox>
                    <p className="text-[11px] text-crm-text-muted mt-2">
                      When the blue bar is above coral — profit month. {monthShort(report.month)}:{" "}
                      {pkr(report.totals.revenue)} revenue vs {pkr(report.totals.totalCost)} cost.
                    </p>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title={`Key movements${ins?.prev ? ` — vs ${monthShort(ins.prev.month)}` : ""}`}>
                  {ins?.prev ? (
                    <div className="divide-y divide-gray-50">
                      {[
                        { name: "Revenue", v: ins.revenueVsPrev ?? 0, goodWhenUp: true },
                        { name: "Total Cost", v: ins.costVsPrev ?? 0, goodWhenUp: false },
                        { name: "Net Profit Swing", v: ins.netVsPrev ?? 0, goodWhenUp: true },
                      ].map(m => {
                        const good = m.goodWhenUp ? m.v >= 0 : m.v < 0;
                        return (
                          <div key={m.name} className="px-4 py-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-bold text-crm-text-secondary">{m.name}</p>
                            <div className="flex items-center gap-2.5">
                              <span className={`text-sm font-extrabold tabular-nums ${good ? "text-emerald-600" : "text-red-500"}`}>
                                {signed(m.v)}
                              </span>
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                                {good ? "Favorable" : "Unfavorable"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="px-4 py-8 text-center text-crm-text-faint text-xs">No previous-month data — comparison is not available.</p>
                  )}
                </SectionCard>

                <SectionCard title={`Cost mix — ${pkr(report.totals.totalCost)}`}>
                  {costMix.length === 0 ? (
                    <p className="px-4 py-8 text-center text-crm-text-faint text-xs">No cost entries this month.</p>
                  ) : (
                    <div className="p-4" id="report-chart-costmix">
                      <RechartsBox height={200}>
                        <PieChart>
                          <Pie data={costMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} strokeWidth={2}>
                            {costMix.map(c => (
                              <Cell key={c.name} fill={c.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={v => pkr(Number(v ?? 0))} />
                        </PieChart>
                      </RechartsBox>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2">
                        {costMix.map(c => (
                          <div key={c.name} className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-crm-text-secondary">
                              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
                              {c.name}
                            </span>
                            <span className="text-[11px] font-bold tabular-nums text-crm-text">
                              {((c.value / Math.max(costMixSum, 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>

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

              <SectionCard title={`CSR team performance — ${label}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[1100px]">
                    <thead className="bg-[#0B1220]">
                      <tr className="border-b border-crm-border/80">
                        <th className={`${thCls} text-left`}>CSR</th>
                        <th className={`${thCls} text-left`}>Role</th>
                        <th className={`${thCls} text-center`}>Assigned TL</th>
                        <th className={`${thCls} text-right`}>Old Proj</th>
                        <th className={`${thCls} text-right`}>Partial</th>
                        <th className={`${thCls} text-right`}>New Proj</th>
                        <th className={`${thCls} text-right`}>Fix Proj</th>
                        <th className={`${thCls} text-right`}>Fix Pay</th>
                        <th className={`${thCls} text-right`}>Total Proj</th>
                        <th className={`${thCls} text-right`}>Old Comm</th>
                        <th className={`${thCls} text-right`}>New Comm</th>
                        <th className={`${thCls} text-right`}>Fix Comm</th>
                        <th className={`${thCls} text-right`}>Total Comm</th>
                        <th className={`${thCls} text-right`}>Share %</th>
                        <th className={`${thCls} text-center`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.csr.rows.length === 0 ? (
                        <tr>
                          <td colSpan={15} className="px-3 py-6 text-center text-crm-text-faint text-xs">
                            No sales / team-lead CSRs recorded this month.
                          </td>
                        </tr>
                      ) : (
                        report.csr.rows.map(r => (
                          <tr key={`${r.code}-${r.name}`} className="border-b border-crm-border-subtle">
                            <td className={`${tdCls} font-semibold text-crm-text-secondary`}>
                              {r.name}
                              {r.code ? <span className="block text-[10px] font-normal text-crm-text-faint">{r.code}</span> : null}
                            </td>
                            <td className={`${tdCls} text-crm-text-secondary`}>{r.roleLabel}</td>
                            <td className={`${tdCls} text-center text-crm-text-secondary`}>{r.assignedToLead ? "Yes" : "—"}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{r.oldProjects}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{r.partialCount}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{r.newProjects}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{r.fixProjects}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(r.fixPay)}</td>
                            <td className={`${tdCls} text-right tabular-nums font-bold`}>{r.projects}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(r.oldComm)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(r.newComm)}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{currency(r.fixComm)}</td>
                            <td className={`${tdCls} text-right tabular-nums font-bold text-emerald-700`}>{currency(r.totalCommission)}</td>
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
                      <tr className="border-t-2 border-crm-border bg-[#FAFBFC]">
                        <td className="px-3 py-2.5 font-extrabold text-crm-text text-xs" colSpan={3}>TOTAL</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{report.csr.totals?.oldProjects ?? 0}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{report.csr.totals?.partialCount ?? 0}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{report.csr.totals?.newProjects ?? 0}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{report.csr.totals?.fixProjects ?? 0}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.csr.totals?.fixPay ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{report.csr.totalProjects}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.csr.totals?.oldComm ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.csr.totals?.newComm ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">{currency(report.csr.totals?.fixComm ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs text-emerald-700">{currency(report.csr.totals?.totalCommission ?? 0)}</td>
                        <td className="px-3 py-2.5 text-right font-extrabold tabular-nums text-xs">100%</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="CSR fix projects — each client">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-140">
                    <thead className="bg-[#0B1220]">
                      <tr>
                        <th className={`${thCls} text-left`}>CSR</th>
                        <th className={`${thCls} text-left`}>Client</th>
                        <th className={`${thCls} text-center`}>Currency</th>
                        <th className={`${thCls} text-right`}>Project pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.csr.rows.every(r => !(r.fixClients ?? []).length) ? (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-crm-text-faint text-xs">No fix-client projects this month.</td></tr>
                      ) : (
                        report.csr.rows.flatMap(r =>
                          (r.fixClients ?? []).map((p, i) => (
                            <tr key={`${r.name}-${p.clientName}-${i}`} className="border-b border-crm-border-subtle">
                              <td className={`${tdCls} font-semibold text-crm-text`}>{r.name}</td>
                              <td className={`${tdCls} text-crm-text-secondary`}>{p.clientName}</td>
                              <td className={`${tdCls} text-center`}>{p.currency}</td>
                              <td className={`${tdCls} text-right tabular-nums font-bold`}>{currency(p.projectPay)}</td>
                            </tr>
                          )),
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title={`Team salaries — cost breakdown (${pkr(report.totals.payroll)})`}>
                <CategoryTable groups={report.salaryTeams} total={report.totals.payroll} />
              </SectionCard>

              <SectionCard title={`Operating expenses (${pkr(report.totals.opex)})`}>
                <CategoryTable groups={report.opexHeads} total={report.totals.opex} />
              </SectionCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title={`Loans (${pkr(report.totals.loans)})`}>
                  <CategoryTable groups={report.loanHeads} total={report.totals.loans} />
                </SectionCard>
                <SectionCard title={`Provident fund (${pkr(report.totals.pf)})`}>
                  <CategoryTable groups={report.pfHeads} total={report.totals.pf} />
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
