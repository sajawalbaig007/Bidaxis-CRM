import { Response } from "express";
import { Prisma } from "@prisma/client";
import streamifier from "streamifier";
import prisma from "../config/db";
import cloudinary from "../config/cloudinary";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  normalizeIncomeStatementData,
  recomputeExecutiveTeamInIncomeStatement,
} from "../utils/incomeStatementNormalize";
import { recomputeTechnicalTeamInIncomeStatement } from "../utils/technicalPayrollDefaults";
import {
  currencyFormulaBreakdownFromDashboard,
  currencyFormulaTotalFromDashboard,
} from "../utils/currencyFormula";
import { ACCOUNTS_CLOUDINARY_FOLDERS } from "../utils/accountsStorage";
import { calcSalesCommission, fixRowProjectCount, type SalesPayrollCalcOpts } from "../utils/salesPayrollFormula";
import type { ProjectSlabKey, SalesCommissionFields } from "../utils/salesPayrollDefaults";
import {
  aggregateAllCollectionMonths,
  applyCollectionsToDashboardData,
  emptyDayCollections,
  listPaidCollectionsForMonth,
  monthStartIso,
  yearMonthFromDate,
} from "../utils/projectCurrencyCollections";
import { defaultAccountsData } from "../utils/accountsDefaults";
import { fetchLiveFxRates } from "../utils/fxRates";

/**
 * Monthly Executive Summary — aggregates ALL daily income_statement records
 * in the selected month into each section (Team Salaries, OPEX, Loans, PF, etc.).
 * Daily adds roll up into that month’s report.
 */

function prepareIncomeStatementData(data: Record<string, unknown>): Record<string, unknown> {
  return recomputeExecutiveTeamInIncomeStatement(
    recomputeTechnicalTeamInIncomeStatement(normalizeIncomeStatementData(data)),
  );
}

type SubHead = {
  label?: string;
  amount?: number;
  salary?: {
    basic?: number;
    commissionPct?: number;
    loanPositive?: number;
    loanNegative?: number;
    remarks?: string;
  };
  salesPayroll?: {
    name?: string;
    code?: string;
    role?: "sales" | "team_lead";
    assignedToLead?: boolean;
    commission?: {
      oldClientProjects?: number;
      oldClientPartialCount?: number;
      newClientProjects?: number;
      fixClientProjects?: {
        id?: string;
        clientName?: string;
        projectPay?: number;
        currency?: "USD" | "CAD";
        fxRate?: number;
        slabKey?: string;
        projectCount?: number;
      }[];
    };
  };
};

type HeadRow = {
  team?: string;
  label?: string;
  amount?: number;
  totalSalary?: number;
  subHeads?: SubHead[];
};

type CashFlowRow = {
  date?: string;
  description?: string;
  netAmount?: number;
  bankAmounts?: Record<string, { debit?: number; credit?: number }>;
};

type CashFlowData = {
  bankHeads?: string[];
  months?: { month?: string; rows?: CashFlowRow[] }[];
};

function lineTotal(row: HeadRow): number {
  if (row.subHeads && row.subHeads.length > 0) {
    return row.subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  }
  return Number(row.amount ?? row.totalSalary) || 0;
}

function isRowExpense(data: Record<string, unknown>): number {
  // Align with Income Statement / dashboard: Total Expense = payroll + OPEX
  // (PF and loans already sit inside net salaries — don't double-count).
  const cats = ["teamSalaries", "opexHeads"] as const;
  return cats.reduce((sum, key) => {
    const rows = (data[key] as HeadRow[]) ?? [];
    return sum + rows.reduce((a, r) => a + lineTotal(r), 0);
  }, 0);
}

type CategoryGroup = {
  name: string;
  total: number;
  lines: { label: string; amount: number }[];
};

/** Sum head rows across multiple daily records into per-head + per-line totals. */
function aggregateCategory(
  records: Record<string, unknown>[],
  key: string,
  nameField: "team" | "label",
): CategoryGroup[] {
  const groups = new Map<string, { total: number; lines: Map<string, number> }>();
  for (const data of records) {
    const rows = (data[key] as HeadRow[]) ?? [];
    for (const row of rows) {
      const name = String(row[nameField] ?? "").trim() || "Untitled";
      const g = groups.get(name) ?? { total: 0, lines: new Map<string, number>() };
      g.total += lineTotal(row);
      for (const s of row.subHeads ?? []) {
        const label = String(s.label ?? "").trim() || "—";
        g.lines.set(label, (g.lines.get(label) ?? 0) + (Number(s.amount) || 0));
      }
      groups.set(name, g);
    }
  }
  return [...groups.entries()].map(([name, g]) => ({
    name,
    total: g.total,
    lines: [...g.lines.entries()].map(([label, amount]) => ({ label, amount })),
  }));
}

type ExecutiveLine = {
  name: string;
  basic: number;
  commissionPct: number;
  commission: number;
  total: number;
  loanPositive: number;
  loanNegative: number;
  remarks: string;
};

function aggregateExecutives(records: Record<string, unknown>[]): ExecutiveLine[] {
  const map = new Map<string, ExecutiveLine>();
  for (const data of records) {
    const teams = (data.teamSalaries as HeadRow[]) ?? [];
    const exec = teams.find(t => String(t.team ?? "").toLowerCase().includes("executive"));
    if (!exec) continue;
    for (const s of exec.subHeads ?? []) {
      const name = String(s.label ?? "").trim() || "—";
      const prev = map.get(name) ?? {
        name,
        basic: 0,
        commissionPct: 0,
        commission: 0,
        total: 0,
        loanPositive: 0,
        loanNegative: 0,
        remarks: "",
      };
      const basic = Number(s.salary?.basic) || 0;
      const total = Number(s.amount) || 0;
      const loanPositive = Number(s.salary?.loanPositive) || 0;
      const loanNegative = Number(s.salary?.loanNegative) || 0;
      // amount = basic + commission + loan+ − loan−
      const commission = Math.max(0, total - basic - loanPositive + loanNegative);
      prev.basic += basic;
      prev.total += total;
      prev.commission += commission;
      if (s.salary?.commissionPct != null) prev.commissionPct = Number(s.salary.commissionPct) || 0;
      prev.loanPositive += loanPositive;
      prev.loanNegative += loanNegative;
      if (s.salary?.remarks?.trim()) prev.remarks = s.salary.remarks.trim();
      map.set(name, prev);
    }
  }
  return [...map.values()];
}

function isSalesCsrTeam(teamTitle: string): boolean {
  const t = teamTitle.trim().toLowerCase();
  // Sales Team Salaries + Sales Team Lead Salaries (CSRs)
  return t.includes("sales team");
}

export type CsrPerformanceRow = {
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
  fixClients: { clientName: string; projectPay: number; currency: string }[];
};

export type CsrPerformanceReport = {
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
  rows: CsrPerformanceRow[];
};

function emptyCsrRow(name: string, teamTitle: string, sub: SubHead): CsrPerformanceRow {
  const sp = sub.salesPayroll;
  const role: "sales" | "team_lead" =
    sp?.role === "team_lead" || /lead/i.test(teamTitle) ? "team_lead" : "sales";
  return {
    name,
    code: String(sp?.code ?? "").trim(),
    role,
    roleLabel: role === "team_lead" ? "Team Lead" : "Sales",
    assignedToLead: !!sp?.assignedToLead,
    oldProjects: 0,
    partialCount: 0,
    newProjects: 0,
    fixProjects: 0,
    fixPay: 0,
    projects: 0,
    oldComm: 0,
    newComm: 0,
    fixComm: 0,
    totalCommission: 0,
    share: 0,
    fixClients: [],
  };
}

function csrRowFromSub(
  teamTitle: string,
  sub: SubHead,
  opts?: SalesPayrollCalcOpts,
): CsrPerformanceRow | null {
  const name = String(sub.salesPayroll?.name || sub.label || "").trim();
  if (!name) return null;
  const row = emptyCsrRow(name, teamTitle, sub);
  const raw = sub.salesPayroll?.commission;
  const commission: SalesCommissionFields = {
    oldClientProjects: Number(raw?.oldClientProjects) || 0,
    oldClientPartialCount: Number(raw?.oldClientPartialCount) || 0,
    newClientProjects: Number(raw?.newClientProjects) || 0,
    fixClientProjects: (raw?.fixClientProjects ?? []).map((p, i) => ({
      id: String(p.id ?? `fix-${i}`),
      clientName: String(p.clientName ?? ""),
      projectPay: Number(p.projectPay) || 0,
      currency: p.currency === "CAD" ? "CAD" : "USD",
      fxRate: Number(p.fxRate) || 0,
      slabKey: p.slabKey as ProjectSlabKey | undefined,
      projectCount: Number(p.projectCount) || undefined,
    })),
  };
  const calc = calcSalesCommission(commission, row.role, opts);
  const fixPay = commission.fixClientProjects.reduce((s, p) => s + (Number(p.projectPay) || 0), 0);
  return {
    ...row,
    oldProjects: Number(commission.oldClientProjects) || 0,
    partialCount: Number(commission.oldClientPartialCount) || 0,
    newProjects: Number(commission.newClientProjects) || 0,
    fixProjects: commission.fixClientProjects.reduce((s, p) => s + fixRowProjectCount(p), 0),
    fixPay,
    projects: calc.totalProjects,
    oldComm: calc.oldComm,
    newComm: calc.newComm,
    fixComm: calc.fixComm,
    totalCommission: calc.totalCommission,
    fixClients: commission.fixClientProjects.map(p => ({
      clientName: String(p.clientName || "—").trim() || "—",
      projectPay: Number(p.projectPay) || 0,
      currency: p.currency === "CAD" ? "CAD" : "USD",
    })),
  };
}

/**
 * CSR Team Performance — every Sales Team + Sales Team Lead person as their own row,
 * with separate columns for each project / commission field.
 * Last daily entry in the month wins per person.
 */
function aggregateCsrFromSalesPayroll(
  records: Record<string, unknown>[],
  opts?: SalesPayrollCalcOpts,
): CsrPerformanceReport {
  const byName = new Map<string, CsrPerformanceRow>();
  for (const data of records) {
    const teams = (data.teamSalaries as HeadRow[]) ?? [];
    for (const team of teams) {
      const title = String(team.team ?? "");
      if (!isSalesCsrTeam(title)) continue;
      for (const s of team.subHeads ?? []) {
        const row = csrRowFromSub(title, s, opts);
        if (!row) continue;
        byName.set(row.name, row);
      }
    }
  }

  const rows = [...byName.values()].sort(
    (a, b) =>
      b.projects - a.projects ||
      b.totalCommission - a.totalCommission ||
      a.name.localeCompare(b.name),
  );

  const totalProjects = rows.reduce((a, r) => a + r.projects, 0);
  const withShare = rows.map(r => ({
    ...r,
    share: totalProjects > 0 ? (r.projects / totalProjects) * 100 : 0,
  }));

  return {
    totalProjects,
    totals: {
      oldProjects: withShare.reduce((a, r) => a + r.oldProjects, 0),
      partialCount: withShare.reduce((a, r) => a + r.partialCount, 0),
      newProjects: withShare.reduce((a, r) => a + r.newProjects, 0),
      fixProjects: withShare.reduce((a, r) => a + r.fixProjects, 0),
      fixPay: withShare.reduce((a, r) => a + r.fixPay, 0),
      oldComm: withShare.reduce((a, r) => a + r.oldComm, 0),
      newComm: withShare.reduce((a, r) => a + r.newComm, 0),
      fixComm: withShare.reduce((a, r) => a + r.fixComm, 0),
      totalCommission: withShare.reduce((a, r) => a + r.totalCommission, 0),
    },
    rows: withShare,
  };
}

function categorySum(data: Record<string, unknown>, key: string): number {
  return ((data[key] as HeadRow[]) ?? []).reduce((a, r) => a + lineTotal(r), 0);
}

function monthEndIso(month: string): string {
  const [y, mm] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
}

export async function getMonthlyAccountsReport(req: AuthRequest, res: Response) {
  try {
    const month = String(req.query.month ?? "").trim(); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: "Invalid month. Use YYYY-MM." });
    }
    const monthEnd = monthEndIso(month);

    const isRecords = await prisma.accountsRecord.findMany({
      where: { page: "income_statement" },
      select: { recordDate: true, data: true },
      orderBy: { recordDate: "asc" },
    });

    const dashRecords = await prisma.accountsRecord.findMany({
      where: { page: "dashboard" },
      select: { recordDate: true, data: true },
    });
    const dashByDate = new Map(
      dashRecords.map(r => [r.recordDate, r.data as Record<string, unknown>]),
    );

    const collectionsByMonth = await aggregateAllCollectionMonths();
    const dashForMonth = (ym: string) => {
      const monthStart = monthStartIso(ym);
      const raw =
        dashByDate.get(monthStart) ??
        [...dashByDate.entries()].find(([d]) => yearMonthFromDate(d) === ym)?.[1] ??
        defaultAccountsData("dashboard");
      return applyCollectionsToDashboardData(
        raw,
        collectionsByMonth.get(ym) ?? emptyDayCollections(),
      );
    };
    const revenueForMonth = (ym: string) => currencyFormulaTotalFromDashboard(dashForMonth(ym));

    const byMonth = new Map<string, { revenue: number; cost: number; days: number; lastDate: string }>();
    const monthRecords: Record<string, unknown>[] = [];
    const dayLines: {
      date: string;
      payroll: number;
      opex: number;
      loans: number;
      pf: number;
      cost: number;
    }[] = [];
    let lastDateInMonth: string | null = null;

    const allMonths = new Set<string>([
      month,
      ...[...collectionsByMonth.keys()],
      ...dashRecords.map(r => yearMonthFromDate(r.recordDate)),
      ...isRecords.map(r => yearMonthFromDate(r.recordDate)),
    ]);

    for (const ym of allMonths) {
      byMonth.set(ym, {
        revenue: revenueForMonth(ym),
        cost: 0,
        days: 0,
        lastDate: monthStartIso(ym),
      });
    }

    for (const rec of isRecords) {
      const data = prepareIncomeStatementData(rec.data as Record<string, unknown>);
      const m = rec.recordDate.slice(0, 7);
      const entry = byMonth.get(m) ?? {
        revenue: revenueForMonth(m),
        cost: 0,
        days: 0,
        lastDate: rec.recordDate,
      };
      entry.cost += isRowExpense(data);
      entry.days += 1;
      if (rec.recordDate > entry.lastDate) entry.lastDate = rec.recordDate;
      byMonth.set(m, entry);
      if (m === month) {
        monthRecords.push({ ...data, totalRevenue: entry.revenue });
        if (!lastDateInMonth || rec.recordDate > lastDateInMonth) lastDateInMonth = rec.recordDate;
        const payroll = categorySum(data, "teamSalaries");
        const opex = categorySum(data, "opexHeads");
        const loans = categorySum(data, "loanHeads");
        const pf = categorySum(data, "providentFundHeads");
        dayLines.push({
          date: rec.recordDate,
          payroll,
          opex,
          loans,
          pf,
          cost: payroll + opex,
        });
      }
    }

    const history = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, v]) => ({
        month: m,
        revenue: v.revenue,
        cost: v.cost,
        net: v.revenue - v.cost,
        days: v.days,
        lastDate: v.lastDate,
      }))
      .filter(h => h.revenue !== 0 || h.cost !== 0 || h.month === month);

    if (!history.some(h => h.month === month)) {
      history.push({
        month,
        revenue: revenueForMonth(month),
        cost: 0,
        net: revenueForMonth(month),
        days: 0,
        lastDate: monthEnd,
      });
      history.sort((a, b) => a.month.localeCompare(b.month));
    }

    const monthEntry = byMonth.get(month);
    const revenue = monthEntry?.revenue ?? revenueForMonth(month);
    const revenueChannels = currencyFormulaBreakdownFromDashboard(dashForMonth(month));
    const collections = await listPaidCollectionsForMonth(month);
    const salaryTeams = aggregateCategory(monthRecords, "teamSalaries", "team");
    const opexHeads = aggregateCategory(monthRecords, "opexHeads", "label");
    const loanHeads = aggregateCategory(monthRecords, "loanHeads", "label");
    const pfHeads = aggregateCategory(monthRecords, "providentFundHeads", "label");
    const executives = aggregateExecutives(monthRecords);

    const payroll = salaryTeams.reduce((a, t) => a + t.total, 0);
    const opex = opexHeads.reduce((a, t) => a + t.total, 0);
    const loans = loanHeads.reduce((a, t) => a + t.total, 0);
    const pf = pfHeads.reduce((a, t) => a + t.total, 0);
    const totalCost = payroll + opex;
    const netProfit = revenue - totalCost;

    const cfRecords = await prisma.accountsRecord.findMany({
      where: { page: "cash_flow" },
      select: { recordDate: true, data: true },
      orderBy: { recordDate: "desc" },
    });
    const cfInMonth = cfRecords.filter(r => r.recordDate.startsWith(month));
    const cfRecord =
      cfInMonth[0] ??
      cfRecords.find(r => r.recordDate <= monthEnd) ??
      cfRecords[0] ??
      null;

    const bankDebit = new Map<string, number>();
    const bankCredit = new Map<string, number>();
    const sectionNets = new Map<string, number>();
    const cashLedger: {
      section: string;
      date: string;
      description: string;
      banks: { bank: string; debit: number; credit: number }[];
      debit: number;
      credit: number;
      net: number;
    }[] = [];
    let closingNet = 0;
    let monthNet = 0;
    let monthEntries = 0;
    let bankHeads: string[] = [];

    const rowNet = (row: CashFlowRow): number => {
      let debit = 0;
      let credit = 0;
      for (const amt of Object.values(row.bankAmounts ?? {})) {
        debit += Number(amt?.debit) || 0;
        credit += Number(amt?.credit) || 0;
      }
      if (debit === 0 && credit === 0) return Number(row.netAmount) || 0;
      return debit - credit;
    };

    if (cfRecord) {
      const cf = cfRecord.data as CashFlowData;
      bankHeads = cf.bankHeads ?? [];
      for (const m of cf.months ?? []) {
        const sectionName = String(m.month || "Section");
        for (const row of m.rows ?? []) {
          const date = String(row.date ?? "");
          if (date && date > monthEnd) continue;
          const net = rowNet(row);
          closingNet += net;
          const inMonth = !date || date.startsWith(month);
          if (inMonth) {
            monthNet += net;
            monthEntries += 1;
            sectionNets.set(sectionName, (sectionNets.get(sectionName) ?? 0) + net);
            let debit = 0;
            let credit = 0;
            const heads = bankHeads.length ? bankHeads : Object.keys(row.bankAmounts ?? {});
            const banks = heads.map(bank => {
              const amt = row.bankAmounts?.[bank];
              const d = Number(amt?.debit) || 0;
              const c = Number(amt?.credit) || 0;
              debit += d;
              credit += c;
              bankDebit.set(bank, (bankDebit.get(bank) ?? 0) + d);
              bankCredit.set(bank, (bankCredit.get(bank) ?? 0) + c);
              return { bank, debit: d, credit: c };
            });
            cashLedger.push({
              section: sectionName,
              date,
              description: String(row.description ?? "").trim() || "—",
              banks,
              debit,
              credit,
              net,
            });
          }
        }
      }
    }

    const cashBanks = (bankHeads.length ? bankHeads : [...new Set([...bankDebit.keys(), ...bankCredit.keys()])]).map(bank => {
      const debit = bankDebit.get(bank) ?? 0;
      const credit = bankCredit.get(bank) ?? 0;
      return { bank, debit, credit, balance: debit - credit };
    });
    const cashSections = [...sectionNets.entries()].map(([name, net]) => ({
      name: name.slice(0, 24),
      net,
    }));

    const csrOpts: SalesPayrollCalcOpts = { recordDate: `${month}-01` };
    if (month >= "2026-08") {
      try {
        const fx = await fetchLiveFxRates();
        csrOpts.usdToPkr = fx.usdToPkr;
        csrOpts.cadToPkr = fx.cadToPkr;
      } catch {
        /* stored project fxRate still applies */
      }
    }
    const csr = aggregateCsrFromSalesPayroll(monthRecords, csrOpts);

    return res.json({
      success: true,
      month,
      sourceDate: lastDateInMonth,
      monthEnd,
      mode: "daily_aggregate",
      totals: { revenue, payroll, opex, loans, pf, totalCost, netProfit },
      revenueChannels,
      collections,
      days: dayLines,
      history,
      salaryTeams,
      opexHeads,
      loanHeads,
      pfHeads,
      executives,
      cash: {
        banks: cashBanks,
        sections: cashSections,
        monthNet,
        closingNet,
        monthEntries,
        asOf: cfRecord?.recordDate ?? null,
        ledger: cashLedger,
      },
      csr,
      daysRecorded: monthRecords.length,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to build monthly report." });
  }
}

/** POST — upload generated Word report to Cloudinary + DB archive. */
export async function saveMonthlyAccountsReport(
  req: AuthRequest & { file?: Express.Multer.File },
  res: Response,
) {
  try {
    const month = String(req.body?.month ?? req.query.month ?? "").trim();
    const sourceDate = String(req.body?.sourceDate ?? "").trim() || null;
    const file = req.file;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: "Invalid month. Use YYYY-MM." });
    }
    if (!file) {
      return res.status(400).json({ success: false, message: "No report file uploaded." });
    }
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized." });
    }

    let totals: Prisma.InputJsonValue | undefined;
    if (req.body?.totals) {
      try {
        totals =
          typeof req.body.totals === "string"
            ? (JSON.parse(req.body.totals) as Prisma.InputJsonValue)
            : (req.body.totals as Prisma.InputJsonValue);
      } catch {
        totals = undefined;
      }
    }

    const publicId = `bem-exec-${month}-${Date.now()}`;
    const uploaded = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: ACCOUNTS_CLOUDINARY_FOLDERS.monthlyReports,
          resource_type: "raw",
          public_id: publicId,
          format: "doc",
        },
        (error, result) => {
          if (error || !result) reject(error ?? new Error("Cloudinary upload failed"));
          else resolve(result as { secure_url: string; public_id: string });
        },
      );
      streamifier.createReadStream(file.buffer).pipe(stream);
    });

    const row = await prisma.accountsMonthlyReport.create({
      data: {
        month,
        fileName: file.originalname || `BEM-Executive-Summary-${month}.doc`,
        fileUrl: uploaded.secure_url,
        mimeType: file.mimetype || "application/msword",
        sourceDate,
        cloudinaryPublicId: uploaded.public_id,
        totals: totals ?? undefined,
        uploadedBy: req.user.id,
      },
    });

    return res.json({
      success: true,
      report: {
        id: row.id,
        month: row.month,
        fileName: row.fileName,
        fileUrl: row.fileUrl,
        sourceDate: row.sourceDate,
        createdAt: row.createdAt,
        totals: row.totals,
      },
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to save monthly report to Cloudinary." });
  }
}

/** GET — list archived monthly reports (optional ?month=YYYY-MM). */
export async function listMonthlyAccountsReports(req: AuthRequest, res: Response) {
  try {
    const month = String(req.query.month ?? "").trim();
    const where = /^\d{4}-\d{2}$/.test(month) ? { month } : {};
    const rows = await prisma.accountsMonthlyReport.findMany({
      where,
      orderBy: [{ month: "desc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        month: true,
        fileName: true,
        fileUrl: true,
        sourceDate: true,
        createdAt: true,
        totals: true,
      },
    });
    return res.json({ success: true, reports: rows });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: "Failed to list saved reports." });
  }
}
