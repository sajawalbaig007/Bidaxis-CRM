"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, CalendarDays, Cloud, ExternalLink, FileText, Loader2, Sparkles, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import API, { apiErrorMessage } from "@/lib/api";
import AccountsSidebar from "../components/layout/Sidebar";
import { ACCOUNTS_MAIN_OFFSET } from "../components/layout/headerOffset";
import RechartsBox from "@/app/components/charts/RechartsBox";
import { currency } from "../types";
import { useScrollToHash } from "../hooks/useScrollToHash";

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
    banks: { bank: string; balance: number }[];
    monthNet: number;
    closingNet: number;
    asOf: string | null;
  };
  csr: { totalProjects: number; rows: { name: string; projects: number; share: number }[] };
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
 * Word-compatible HTML document — KPI cards, shaded status cells, trend arrows,
 * aur table-based bar charts (Word mai reliably render hote hain).
 */
function buildWordHtml(report: MonthlyReport): string {
  const label = monthLabel(report.month);
  const ins = buildInsights(report);
  const net = report.totals.netProfit;

  const RED = "#B8112D";
  const NAVY = "#0B1220";
  const GREEN = "#12B76A";
  const GREEN_D = "#027A48";
  const RED_TXT = "#DC2626";
  const BLUE = "#0B84F3";
  const TEAL = "#0D9488";
  const PURPLE = "#6D28D9";
  const SLATE = "#334155";

  const th = `style="background:${NAVY};color:#fff;padding:6px 9px;text-align:left;font-size:10px;letter-spacing:0.5px;"`;
  const thR = `style="background:${NAVY};color:#fff;padding:6px 9px;text-align:right;font-size:10px;letter-spacing:0.5px;"`;
  const thC = `style="background:${NAVY};color:#fff;padding:6px 9px;text-align:center;font-size:10px;letter-spacing:0.5px;"`;
  const td = `style="padding:5px 9px;border:1px solid #E2E8F0;font-size:10.5px;"`;
  const tdR = `style="padding:5px 9px;border:1px solid #E2E8F0;font-size:10.5px;text-align:right;"`;
  const sub = `style="padding:3px 9px 3px 26px;border:1px solid #F1F5F9;font-size:9.5px;color:#64748B;background:#FCFCFD;"`;
  const subR = `style="padding:3px 9px;border:1px solid #F1F5F9;font-size:9.5px;color:#64748B;text-align:right;background:#FCFCFD;"`;

  const tdEmpty = (cols: number, text: string) =>
    `<tr><td colspan="${cols}" style="padding:9px;border:1px solid #E2E8F0;font-size:10px;color:#94A3B8;text-align:center;">${text}</td></tr>`;

  /** Highlighted status cell — poora cell shade hota hai (Word mai spans ki background unreliable hai). */
  const statusCell = (text: string, bg: string, color: string) =>
    `<td style="padding:4px 9px;border:1px solid #E2E8F0;text-align:center;background:${bg};"><b style="color:${color};font-size:8.5px;letter-spacing:0.5px;">${text.toUpperCase()}</b></td>`;

  const profitCell = (v: number) =>
    v >= 0 ? statusCell("Profit", "#D1FADF", GREEN_D) : statusCell("Loss", "#FEE4E2", RED_TXT);

  /** Inline badge via single-cell shaded table (header banner ke liye). */
  const badge = (text: string, bg: string, color: string) =>
    `<table cellspacing="0" cellpadding="0" align="right"><tr><td style="background:${bg};color:${color};font-size:8px;font-weight:bold;padding:3px 9px;letter-spacing:0.6px;">${text.toUpperCase()}</td></tr></table>`;

  /** MoM trend arrow — direction + color (goodWhenUp: revenue up = green, cost up = red). */
  const trendArrow = (v: number | null, goodWhenUp: boolean) => {
    if (v == null) return `<span style="color:#94A3B8;font-size:9px;">—</span>`;
    const up = v >= 0;
    const good = goodWhenUp ? up : !up;
    const color = good ? GREEN_D : RED_TXT;
    return `<span style="color:${color};font-size:9px;font-weight:bold;">${up ? "▲" : "▼"} ${signed(v)}</span>`;
  };

  /** KPI card cell — solid brand color, big number, note. */
  const kpiCard = (title: string, value: string, note: string, bg: string) => `
    <td width="33%" valign="top" style="background:${bg};padding:11px 13px;">
      <p style="margin:0;font-size:7.5px;color:#E2E8F0;font-weight:bold;letter-spacing:1.2px;">${title.toUpperCase()}</p>
      <p style="margin:5px 0 0;font-size:16px;color:#FFFFFF;font-weight:bold;">${value}</p>
      <p style="margin:4px 0 0;font-size:8.5px;color:#CBD5E1;">${note}</p>
    </td>`;

  /** Section heading strip with red accent bar. */
  const section = (num: number, title: string) => `
    <table cellspacing="0" cellpadding="0" width="100%" style="margin:20px 0 8px;">
      <tr>
        <td width="5" style="background:${RED};font-size:1px;">&nbsp;</td>
        <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:none;padding:6px 11px;font-size:12.5px;font-weight:bold;color:#0F172A;">${num}. ${title}</td>
      </tr>
    </table>`;

  /** Horizontal bar row — Word-safe chart (nested table, % widths). */
  const barRow = (rowLabel: string, pct: number, color: string, valueTxt: string, valueColor: string) => {
    const width = Math.max(Math.min(Math.round(pct), 100), pct > 0 ? 2 : 0);
    return `<tr>
      <td width="76" style="padding:2px 8px 2px 0;font-size:9px;font-weight:bold;color:${SLATE};">${rowLabel}</td>
      <td style="padding:3px 0;">
        <table cellspacing="0" cellpadding="0" width="100%"><tr>
          ${width > 0 ? `<td width="${width}%" height="10" style="background:${color};font-size:1px;line-height:10px;">&nbsp;</td>` : ""}
          <td height="10" style="background:#F1F5F9;font-size:1px;line-height:10px;">&nbsp;</td>
        </tr></table>
      </td>
      <td width="120" align="right" style="padding:2px 0 2px 9px;font-size:9px;font-weight:bold;color:${valueColor};">${valueTxt}</td>
    </tr>`;
  };

  // ---------- Charts data ----------
  const maxNet = Math.max(...report.history.map(h => Math.abs(h.net)), 1);
  const netTrendBars = report.history
    .map(h =>
      barRow(
        monthShort(h.month) + (h.month === report.month ? " ●" : ""),
        (Math.abs(h.net) / maxNet) * 100,
        h.net >= 0 ? GREEN : "#EF4444",
        signed(h.net),
        h.net >= 0 ? GREEN_D : RED_TXT,
      ),
    )
    .join("");

  const maxRevCost = Math.max(...report.history.flatMap(h => [h.revenue, h.cost]), 1);
  const revCostBars = report.history
    .map(
      h =>
        barRow(monthShort(h.month), (h.revenue / maxRevCost) * 100, BLUE, currency(h.revenue), "#0369A1") +
        barRow("", (h.cost / maxRevCost) * 100, "#F97066", currency(h.cost), RED_TXT) +
        `<tr><td colspan="3" style="font-size:1px;height:5px;">&nbsp;</td></tr>`,
    )
    .join("");

  const costMix: { name: string; total: number; color: string }[] = [
    { name: "Team Salaries", total: report.totals.payroll, color: RED },
    { name: "OPEX", total: report.totals.opex, color: BLUE },
    { name: "Loans", total: report.totals.loans, color: "#F59E0B" },
    { name: "Provident Fund", total: report.totals.pf, color: PURPLE },
  ];
  const maxCostMix = Math.max(...costMix.map(c => c.total), 1);
  const costMixBars = costMix
    .map(c => barRow(c.name, (c.total / maxCostMix) * 100, c.color, pkr(c.total), SLATE))
    .join("");

  // ---------- History table ----------
  const historyRows = report.history
    .map((h, i) => {
      const prev = i > 0 ? report.history[i - 1] : null;
      const isThis = h.month === report.month;
      return `<tr style="background:${isThis ? "#FFF6F8" : "#FFFFFF"};">
        <td ${td}><b>${monthShort(h.month)}</b>${isThis ? ` <b style="color:${RED};font-size:8px;letter-spacing:0.5px;">&nbsp;● THIS REPORT</b>` : ""}</td>
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

  // ---------- Key movements ----------
  const movement = (name: string, v: number | null, goodWhenUp: boolean) => {
    if (v == null) return "";
    const good = goodWhenUp ? v >= 0 : v < 0;
    return `<tr>
      <td ${td}><b>${name}</b></td>
      <td ${tdR}><b style="color:${good ? GREEN_D : RED_TXT};">${signed(v)}</b></td>
      ${good ? statusCell("Favorable", "#D1FADF", GREEN_D) : statusCell("Unfavorable", "#FEE4E2", RED_TXT)}
    </tr>`;
  };
  const movementsTable = ins.prev
    ? `${section(3, `Key Movements — vs ${monthShort(ins.prev.month)}`)}
      <table cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
        <tr><th ${th}>Metric</th><th ${thR}>Change (PKR)</th><th ${thC}>Direction</th></tr>
        ${movement("Revenue", ins.revenueVsPrev, true)}
        ${movement("Total Cost", ins.costVsPrev, false)}
        ${movement("Net Profit Swing", ins.netVsPrev, true)}
      </table>`
    : "";

  // ---------- Category sections ----------
  const categoryRows = (groups: CategoryGroup[]) =>
    groups
      .map(g => {
        const head = `<tr style="background:#FDF5F6;">
          <td ${td}><b>${g.name}</b></td>
          <td ${tdR}><b>${currency(g.total)}</b></td>
        </tr>`;
        const lines = g.lines
          .map(l => `<tr><td ${sub}>– ${l.label}</td><td ${subR}>${currency(l.amount)}</td></tr>`)
          .join("");
        return head + lines;
      })
      .join("");

  const catSection = (num: number, title: string, groups: CategoryGroup[], total: number) => `
    ${section(num, title)}
    <table cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
      <tr><th ${th}>Head</th><th ${thR}>Amount (PKR)</th></tr>
      ${categoryRows(groups) || tdEmpty(2, "No entries this month.")}
      <tr style="background:#FDECEF;"><td ${td}><b>TOTAL</b></td><td ${tdR}><b style="color:${RED};">${currency(total)}</b></td></tr>
    </table>`;

  // ---------- CSR ----------
  const maxShare = Math.max(...report.csr.rows.map(r => r.share), 1);
  const csrRows = report.csr.rows
    .map(r => {
      const status =
        r.share >= 30
          ? statusCell("Top Performer", "#D1FADF", GREEN_D)
          : r.projects > 0
            ? statusCell("Active", "#DBEAFE", "#1D4ED8")
            : statusCell("Below Expectation", "#FEE4E2", RED_TXT);
      const w = Math.max(Math.round((r.share / maxShare) * 100), r.share > 0 ? 3 : 0);
      return `<tr>
        <td ${td}><b>${r.name}</b></td>
        <td ${tdR}>${r.projects}</td>
        <td ${tdR}>${r.share.toFixed(1)}%</td>
        <td style="padding:5px 9px;border:1px solid #E2E8F0;" width="150">
          <table cellspacing="0" cellpadding="0" width="100%"><tr>
            ${w > 0 ? `<td width="${w}%" height="9" style="background:${BLUE};font-size:1px;line-height:9px;">&nbsp;</td>` : ""}
            <td height="9" style="background:#F1F5F9;font-size:1px;line-height:9px;">&nbsp;</td>
          </tr></table>
        </td>
        ${status}
      </tr>`;
    })
    .join("");

  // ---------- Executives ----------
  const execRows = report.executives
    .map(
      e => `<tr>
        <td ${td}><b>${e.name}</b></td>
        <td ${tdR}>${currency(e.basic)}</td>
        <td ${tdR}><b style="color:${PURPLE};">${e.commissionPct}%</b></td>
        <td ${tdR}><span style="color:${GREEN_D};">${currency(e.commission)}</span></td>
        <td ${tdR}><b style="color:${RED};">${currency(e.total)}</b></td>
        <td ${tdR}>${currency(e.loanPositive)}</td>
        <td ${tdR}><span style="color:${RED_TXT};">${currency(e.loanNegative)}</span></td>
        <td ${td}>${e.remarks || "—"}</td>
      </tr>`,
    )
    .join("");
  const execTotal = report.executives.reduce((s, e) => s + e.total, 0);

  const cashRows = report.cash.banks
    .map(b => `<tr><td ${td}><b>${b.bank}</b></td><td ${tdR}>${currency(b.balance)}</td></tr>`)
    .join("");

  // ---------- Executive summary paragraph ----------
  const summaryText = `${label} posted a net ${net >= 0 ? "profit" : "loss"} of ${signed(net)} (${ins.profitNote.toLowerCase()}).${
    ins.revenueVsPrev != null ? ` Revenue moved ${signed(ins.revenueVsPrev)} versus the previous month` : ""
  }${ins.costVsPrev != null ? ` while total cost moved ${signed(ins.costVsPrev)}` : ""}. Net cash position stands at ${pkr(report.cash.closingNet)}${
    report.cash.asOf ? ` as of ${report.cash.asOf}` : ""
  }, with a ${signed(report.cash.monthNet)} cash movement during the month. ${report.daysRecorded} daily income statement entr${report.daysRecorded === 1 ? "y was" : "ies were"} recorded.`;

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8"><title>BEM Executive Summary ${label}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size:8.5in 11.0in; margin:0.55in 0.6in; }
  div.Section1 { page:Section1; }
</style>
</head>
<body style="font-family:Calibri,Arial,sans-serif;color:#1a1a1a;margin:0;">
<div class="Section1">

  <!-- Header banner -->
  <table cellspacing="0" cellpadding="0" width="100%">
    <tr>
      <td style="background:${NAVY};padding:16px 18px;">
        <table cellspacing="0" cellpadding="0" width="100%"><tr>
          <td>
            <p style="margin:0;font-size:21px;font-weight:bold;color:#FFFFFF;letter-spacing:1px;">BEM SOLUTIONS</p>
            <p style="margin:4px 0 0;font-size:10.5px;color:#CBD5E1;">Executive Summary Report &nbsp;|&nbsp; Month of <b style="color:#FFFFFF;">${label}</b></p>
          </td>
          <td align="right" valign="top">
            ${badge("Confidential", RED, "#fff")}
            <p style="margin:6px 0 0;font-size:8.5px;color:#94A3B8;">Generated ${new Date().toISOString().slice(0, 10)}</p>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr><td height="4" style="background:${RED};font-size:1px;">&nbsp;</td></tr>
  </table>

  <!-- KPI cards -->
  <table cellspacing="7" cellpadding="0" width="100%" style="margin-top:10px;">
    <tr>
      ${kpiCard(`${monthShort(report.month)} Revenue`, pkr(report.totals.revenue), ins.revenueVsPrev != null ? `${signed(ins.revenueVsPrev)} vs prev month` : "No previous month data", BLUE)}
      ${kpiCard("Total Cost", pkr(report.totals.totalCost), ins.costVsPrev != null ? `${signed(ins.costVsPrev)} vs prev month` : `Payroll ${pkr(report.totals.payroll)}`, RED)}
      ${kpiCard("Net Profit", signed(net), ins.profitNote, net >= 0 ? GREEN_D : "#B45309")}
    </tr>
    <tr>
      ${kpiCard("Cash (Net)", pkr(report.cash.closingNet), report.cash.asOf ? `As of ${report.cash.asOf}` : "No cash flow entries", TEAL)}
      ${kpiCard("Cash Movement", signed(report.cash.monthNet), "Cash flow rows dated in this month", PURPLE)}
      ${kpiCard("Days Recorded", String(report.daysRecorded), `Daily entries in ${label}`, "#1E293B")}
    </tr>
  </table>

  <!-- Summary paragraph -->
  <table cellspacing="0" cellpadding="0" width="100%" style="margin-top:10px;">
    <tr>
      <td width="5" style="background:${net >= 0 ? GREEN : "#F59E0B"};font-size:1px;">&nbsp;</td>
      <td style="background:#F8FAFC;border:1px solid #E2E8F0;border-left:none;padding:9px 12px;font-size:10px;color:${SLATE};line-height:1.5;">${summaryText}</td>
    </tr>
  </table>

  ${section(1, "Financial Performance — Month by Month")}
  <table cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
    <tr><th ${th}>Month</th><th ${thR}>Revenue (PKR)</th><th ${thR}>Total Cost (PKR)</th><th ${thR}>Net P/L (PKR)</th><th ${thC}>Status</th></tr>
    ${historyRows || tdEmpty(5, "No income statement records yet.")}
    <tr style="background:#EEF2F6;">
      <td ${td}><b>TOTAL</b></td>
      <td ${tdR}><b>${currency(histTotal.revenue)}</b></td>
      <td ${tdR}><b>${currency(histTotal.cost)}</b></td>
      <td ${tdR}><b style="color:${histTotal.net >= 0 ? GREEN_D : RED_TXT};">${signed(histTotal.net)}</b></td>
      ${profitCell(histTotal.net)}
    </tr>
  </table>

  ${section(2, "Net Profit / Loss Trend")}
  <table cellspacing="0" cellpadding="0" width="100%" style="border:1px solid #E2E8F0;">
    <tr><td style="padding:10px 12px;">
      <table cellspacing="0" cellpadding="0" width="100%">${netTrendBars || tdEmpty(1, "No history data.")}</table>
      <p style="margin:8px 0 0;font-size:9.5px;color:#64748B;">
        <b style="color:${GREEN_D};">■</b> Profit &nbsp; <b style="color:#EF4444;">■</b> Loss &nbsp;·&nbsp; ● = this report month
        ${ins.netVsPrev != null ? ` &nbsp;·&nbsp; Swing vs previous month: <b style="color:${ins.netVsPrev >= 0 ? GREEN_D : RED_TXT};">${signed(ins.netVsPrev)}</b>` : ""}
      </p>
    </td></tr>
  </table>

  ${movementsTable}

  ${section(4, "Revenue vs Cost Trend")}
  <table cellspacing="0" cellpadding="0" width="100%" style="border:1px solid #E2E8F0;">
    <tr><td style="padding:10px 12px;">
      <table cellspacing="0" cellpadding="0" width="100%">${revCostBars || tdEmpty(1, "No history data.")}</table>
      <p style="margin:6px 0 0;font-size:9.5px;color:#64748B;"><b style="color:${BLUE};">■</b> Revenue &nbsp; <b style="color:#F97066;">■</b> Total Cost</p>
    </td></tr>
  </table>

  ${section(5, `Cash Position${report.cash.asOf ? ` — as of ${report.cash.asOf}` : ""}`)}
  <table cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
    <tr><th ${th}>Account</th><th ${thR}>Balance (PKR)</th></tr>
    ${cashRows || tdEmpty(2, "No cash flow entries recorded.")}
    <tr style="background:#E6F4F1;"><td ${td}><b>TOTAL AVAILABLE CASH (NET)</b></td><td ${tdR}><b style="color:${TEAL};">${currency(report.cash.closingNet)}</b></td></tr>
  </table>

  ${section(6, `CSR Team Performance — ${label}`)}
  <table cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
    <tr><th ${th}>CSR</th><th ${thR}>Projects</th><th ${thR}>Share %</th><th ${th}>Share</th><th ${thC}>Status</th></tr>
    ${csrRows || tdEmpty(5, "No completed projects recorded this month.")}
    <tr style="background:#EEF2F6;"><td ${td}><b>TOTAL</b></td><td ${tdR}><b>${report.csr.totalProjects}</b></td><td ${tdR}><b>100%</b></td><td ${td}></td><td ${td}></td></tr>
  </table>

  ${section(7, `Cost Mix — ${label} (${pkr(report.totals.totalCost)})`)}
  <table cellspacing="0" cellpadding="0" width="100%" style="border:1px solid #E2E8F0;">
    <tr><td style="padding:10px 12px;">
      <table cellspacing="0" cellpadding="0" width="100%">${costMixBars}</table>
      <p style="margin:6px 0 0;font-size:9.5px;color:#64748B;">
        <b style="color:${RED};">■</b> Team Salaries &nbsp; <b style="color:${BLUE};">■</b> OPEX &nbsp; <b style="color:#F59E0B;">■</b> Loans &nbsp; <b style="color:${PURPLE};">■</b> Provident Fund
      </p>
    </td></tr>
  </table>

  ${catSection(8, `Team Salaries — Cost Breakdown (${pkr(report.totals.payroll)})`, report.salaryTeams, report.totals.payroll)}
  ${catSection(9, `Operating Expenses (${pkr(report.totals.opex)})`, report.opexHeads, report.totals.opex)}
  ${catSection(10, `Loans (${pkr(report.totals.loans)})`, report.loanHeads, report.totals.loans)}
  ${catSection(11, `Provident Fund (${pkr(report.totals.pf)})`, report.pfHeads, report.totals.pf)}

  ${section(12, `Executive Salaries — ${label}`)}
  <table cellspacing="0" cellpadding="0" width="100%" style="border-collapse:collapse;">
    <tr><th ${th}>Executive</th><th ${thR}>Basic (PKR)</th><th ${thR}>Comm. %</th><th ${thR}>Commission (PKR)</th><th ${thR}>Total (PKR)</th><th ${thR}>Loan +ve</th><th ${thR}>Loan −ve</th><th ${th}>Remarks</th></tr>
    ${execRows || tdEmpty(8, "No executive salary entries this month.")}
    ${execRows ? `<tr style="background:#EEF2F6;"><td ${td}><b>TOTAL SALARY</b></td><td ${td} colspan="3"></td><td ${tdR}><b style="color:${RED};">${currency(execTotal)}</b></td><td ${td} colspan="3"></td></tr>` : ""}
  </table>

  <p style="font-size:9px;color:#94A3B8;margin-top:22px;text-align:center;">
    BEM SOLUTIONS &nbsp;|&nbsp; Executive Summary &nbsp;|&nbsp; ${label} &nbsp;|&nbsp; Confidential — Daily aggregate (${report.daysRecorded} day${report.daysRecorded === 1 ? "" : "s"})
  </p>
</div>
</body></html>`;
}

function buildWordBlob(report: MonthlyReport): { blob: Blob; fileName: string } {
  const html = buildWordHtml(report);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const fileName = `BEM-Executive-Summary-${monthLabel(report.month).replace(/\s+/g, "-")}.doc`;
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
  if (v == null) return <span className="text-[9px] text-gray-300">—</span>;
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
    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(pct, pct > 0 ? 3 : 0), 100)}%`, background: color }} />
    </div>
  );
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
      toast.success("Report download + Cloudinary pe archive ho gayi.");
      setSavedVersion(v => v + 1);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Word download ho gaya — Cloudinary save fail hui."));
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

  const kpis = report
    ? [
        { label: `${monthShort(month)} Revenue`, value: pkr(report.totals.revenue), note: ins?.revenueVsPrev != null ? `${signed(ins.revenueVsPrev)} vs prev month` : "No previous month data", cls: "from-[#0B84F3] to-[#0369A1]" },
        { label: "Total Cost", value: pkr(report.totals.totalCost), note: ins?.costVsPrev != null ? `${signed(ins.costVsPrev)} vs prev month` : `Payroll ${pkr(report.totals.payroll)}`, cls: "from-[#B8112D] to-[#8b0d22]" },
        { label: "Net Profit", value: signed(report.totals.netProfit), note: ins?.profitNote ?? "", cls: report.totals.netProfit >= 0 ? "from-[#12B76A] to-[#027A48]" : "from-[#F59E0B] to-[#B45309]" },
        { label: "Cash (Net)", value: pkr(report.cash.closingNet), note: report.cash.asOf ? `As of ${report.cash.asOf}` : "No cash flow entries", cls: "from-[#0D9488] to-[#0F766E]" },
        { label: "Cash Movement (Month)", value: signed(report.cash.monthNet), note: "Cash flow rows dated in this month", cls: "from-[#6D28D9] to-[#4C1D95]" },
        { label: "Days Recorded", value: String(report.daysRecorded), note: report.sourceDate ? `Daily entries · last ${report.sourceDate}` : `No IS records in ${label}`, cls: "from-[#0F172A] to-[#334155]" },
      ]
    : [];

  return (
    <div className="flex min-h-screen accounts-page-bg">
      <AccountsSidebar />
      <main className={`flex-1 min-w-0 overflow-x-hidden ${ACCOUNTS_MAIN_OFFSET}`}>
        <div id="monthly-report" className="max-w-[1200px] mx-auto px-3 sm:px-5 py-5 space-y-4 scroll-mt-[80px]">
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
                    BEM Solutions · Daily aggregate
                    {report?.daysRecorded != null ? ` · ${report.daysRecorded} day(s)` : ""}
                    {report?.sourceDate ? ` · last ${report.sourceDate}` : ""} · Confidential
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
              <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 text-[11px] text-gray-600 leading-relaxed">
                <b className="text-gray-800">Daily mode:</b> Income Statement pe har din jo values add hoti hain,
                woh is month ke sections (Team Salaries, OPEX, Loans, PF, Executives, Revenue) mai{" "}
                <b>sum</b> ho kar aati hain — {report.daysRecorded} day(s) recorded
                {report.sourceDate ? ` · last entry ${report.sourceDate}` : ""}.{" "}
                <b>Save Report</b> Word download + Cloudinary archive karta hai.
              </section>

              {saved.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-100/90 shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[#EFF8FF] to-white flex items-center gap-2">
                    <Cloud size={14} className="text-[#0B84F3]" />
                    <h2 className="font-extrabold text-gray-800 text-sm tracking-tight">Cloudinary Archives — {label}</h2>
                    <span className="text-[10px] text-gray-400 font-semibold">{saved.length} file(s)</span>
                  </div>
                  <ul className="divide-y divide-gray-50">
                    {saved.map(s => (
                      <li key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{s.fileName}</p>
                          <p className="text-[10px] text-gray-400">
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

              <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
                {kpis.map(k => (
                  <div key={k.label} className={`bg-gradient-to-br ${k.cls} rounded-xl sm:rounded-2xl p-3 sm:p-3.5 text-white shadow-md`}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-white/75 leading-snug">{k.label}</p>
                    <p className="text-base sm:text-lg font-extrabold mt-1.5 tabular-nums tracking-tight">{k.value}</p>
                    <p className="text-[9px] text-white/60 mt-1 font-medium leading-snug">{k.note}</p>
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
                <p className="text-xs text-gray-600 leading-relaxed">
                  <b className="text-gray-800">{label}</b> posted a net {report.totals.netProfit >= 0 ? "profit" : "loss"} of{" "}
                  <b className={report.totals.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}>{signed(report.totals.netProfit)}</b>{" "}
                  ({ins?.profitNote.toLowerCase()}).
                  {ins?.revenueVsPrev != null && <> Revenue moved <b>{signed(ins.revenueVsPrev)}</b> vs previous month</>}
                  {ins?.costVsPrev != null && <> while total cost moved <b>{signed(ins.costVsPrev)}</b>.</>}
                  {" "}Net cash stands at <b className="text-teal-700">{pkr(report.cash.closingNet)}</b>
                  {report.cash.asOf ? ` as of ${report.cash.asOf}` : ""} with {signed(report.cash.monthNet)} movement during the month.
                </p>
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
                        report.history.map((h, i) => {
                          const prev = i > 0 ? report.history[i - 1] : null;
                          return (
                            <tr
                              key={h.month}
                              className={`border-b border-gray-50 ${h.month === report.month ? "bg-[#FFF6F8]" : "bg-white"}`}
                            >
                              <td className={`${tdCls} font-bold text-gray-800`}>
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
                        <tr className="border-t-2 border-gray-200 bg-[#FAFBFC]">
                          <td className="px-3 py-2.5 font-extrabold text-gray-800 text-xs">TOTAL</td>
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
                <SectionCard title="2. Net Profit / Loss Trend">
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
                    <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1.5">
                      <TrendingUp size={13} className="text-[#B8112D] shrink-0" />
                      {label}: {signed(report.totals.netProfit)} net — {ins?.profitNote}.
                      {ins?.netVsPrev != null && ` Swing vs previous month: ${signed(ins.netVsPrev)}.`}
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="3. Revenue vs Total Cost">
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
                    <p className="text-[11px] text-gray-500 mt-2">
                      Jab blue bar coral se oopar ho — profit month. {monthShort(report.month)}:{" "}
                      {pkr(report.totals.revenue)} revenue vs {pkr(report.totals.totalCost)} cost.
                    </p>
                  </div>
                </SectionCard>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title={`4. Key Movements${ins?.prev ? ` — vs ${monthShort(ins.prev.month)}` : ""}`}>
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
                            <p className="text-xs font-bold text-gray-700">{m.name}</p>
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
                    <p className="px-4 py-8 text-center text-gray-400 text-xs">Previous month ka data nahi — comparison possible nahi.</p>
                  )}
                </SectionCard>

                <SectionCard title={`5. Cost Mix — ${pkr(report.totals.totalCost)}`}>
                  {costMix.length === 0 ? (
                    <p className="px-4 py-8 text-center text-gray-400 text-xs">No cost entries this month.</p>
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
                            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600">
                              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c.color }} />
                              {c.name}
                            </span>
                            <span className="text-[11px] font-bold tabular-nums text-gray-800">
                              {((c.value / Math.max(report.totals.totalCost, 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SectionCard>
              </div>

              <SectionCard title={`6. Cash Position${report.cash.asOf ? ` — as of ${report.cash.asOf}` : ""}`}>
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

              <SectionCard title={`7. CSR Team Performance — ${label}`}>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-130">
                    <thead className="bg-[#FAFBFC]">
                      <tr className="border-b border-gray-200/80">
                        <th className={`${thCls} text-left`}>CSR</th>
                        <th className={`${thCls} text-right`}>Projects</th>
                        <th className={`${thCls} text-right`}>Share %</th>
                        <th className={`${thCls} text-left w-40`}>Share</th>
                        <th className={`${thCls} text-center w-36`}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.csr.rows.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">No completed projects recorded this month.</td></tr>
                      ) : (
                        report.csr.rows.map(r => (
                          <tr key={r.name} className="border-b border-gray-50">
                            <td className={`${tdCls} font-semibold text-gray-700`}>{r.name}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{r.projects}</td>
                            <td className={`${tdCls} text-right tabular-nums`}>{r.share.toFixed(1)}%</td>
                            <td className={tdCls}>
                              <MiniBar
                                pct={(r.share / Math.max(...report.csr.rows.map(x => x.share), 1)) * 100}
                                color={r.share >= 30 ? "#12B76A" : r.projects > 0 ? "#0B84F3" : "#EF4444"}
                              />
                            </td>
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
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title={`8. Team Salaries — Cost Breakdown (${pkr(report.totals.payroll)})`}>
                <CategoryTable groups={report.salaryTeams} total={report.totals.payroll} />
              </SectionCard>

              <SectionCard title={`9. Operating Expenses (${pkr(report.totals.opex)})`}>
                <CategoryTable groups={report.opexHeads} total={report.totals.opex} />
              </SectionCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard title={`10. Loans (${pkr(report.totals.loans)})`}>
                  <CategoryTable groups={report.loanHeads} total={report.totals.loans} />
                </SectionCard>
                <SectionCard title={`11. Provident Fund (${pkr(report.totals.pf)})`}>
                  <CategoryTable groups={report.pfHeads} total={report.totals.pf} />
                </SectionCard>
              </div>

              <SectionCard title={`12. Executive Salaries — ${label}`}>
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
                    {report.executives.length > 0 && (
                      <tfoot>
                        <tr className="border-t-2 border-[#B8112D]/20 bg-[#B8112D]/5">
                          <td className="px-3 py-2.5 font-extrabold text-gray-800 text-xs">TOTAL SALARY</td>
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
