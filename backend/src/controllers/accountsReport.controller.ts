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
import { currencyFormulaTotalFromDashboard } from "../utils/currencyFormula";
import { ACCOUNTS_CLOUDINARY_FOLDERS } from "../utils/accountsStorage";

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
  netAmount?: number;
  bankAmounts?: Record<string, { debit?: number; credit?: number }>;
};

type CashFlowData = {
  bankHeads?: string[];
  months?: { rows?: CashFlowRow[] }[];
};

function lineTotal(row: HeadRow): number {
  if (row.subHeads && row.subHeads.length > 0) {
    return row.subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  }
  return Number(row.amount ?? row.totalSalary) || 0;
}

function isRowExpense(data: Record<string, unknown>): number {
  const cats = ["teamSalaries", "opexHeads", "loanHeads", "providentFundHeads"] as const;
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
    lines: [...g.lines.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .filter(l => l.amount !== 0 || g.lines.size <= 12),
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
      prev.basic += basic;
      prev.total += total;
      prev.commission += Math.max(0, total - basic);
      if (s.salary?.commissionPct != null) prev.commissionPct = Number(s.salary.commissionPct) || 0;
      prev.loanPositive += Number(s.salary?.loanPositive) || 0;
      prev.loanNegative += Number(s.salary?.loanNegative) || 0;
      if (s.salary?.remarks?.trim()) prev.remarks = s.salary.remarks.trim();
      map.set(name, prev);
    }
  }
  return [...map.values()];
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

    const byMonth = new Map<string, { revenue: number; cost: number; days: number; lastDate: string }>();
    const monthRecords: Record<string, unknown>[] = [];
    let lastDateInMonth: string | null = null;

    for (const rec of isRecords) {
      const data = prepareIncomeStatementData(rec.data as Record<string, unknown>);
      const revenue = currencyFormulaTotalFromDashboard(dashByDate.get(rec.recordDate));
      const synced = { ...data, totalRevenue: revenue };
      const m = rec.recordDate.slice(0, 7);
      const entry = byMonth.get(m) ?? { revenue: 0, cost: 0, days: 0, lastDate: rec.recordDate };
      entry.revenue += revenue;
      entry.cost += isRowExpense(synced);
      entry.days += 1;
      if (rec.recordDate > entry.lastDate) entry.lastDate = rec.recordDate;
      byMonth.set(m, entry);
      if (m === month) {
        monthRecords.push(synced);
        if (!lastDateInMonth || rec.recordDate > lastDateInMonth) lastDateInMonth = rec.recordDate;
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
        revenue: 0,
        cost: 0,
        net: 0,
        days: 0,
        lastDate: monthEnd,
      });
      history.sort((a, b) => a.month.localeCompare(b.month));
    }

    const revenue = monthRecords.reduce((a, d) => a + (Number(d.totalRevenue) || 0), 0);
    const salaryTeams = aggregateCategory(monthRecords, "teamSalaries", "team");
    const opexHeads = aggregateCategory(monthRecords, "opexHeads", "label");
    const loanHeads = aggregateCategory(monthRecords, "loanHeads", "label");
    const pfHeads = aggregateCategory(monthRecords, "providentFundHeads", "label");
    const executives = aggregateExecutives(monthRecords);

    const payroll = salaryTeams.reduce((a, t) => a + t.total, 0);
    const opex = opexHeads.reduce((a, t) => a + t.total, 0);
    const loans = loanHeads.reduce((a, t) => a + t.total, 0);
    const pf = pfHeads.reduce((a, t) => a + t.total, 0);
    const totalCost = payroll + opex + loans + pf;
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

    const bankTotals = new Map<string, number>();
    let closingNet = 0;
    let monthNet = 0;
    let bankHeads: string[] = [];

    if (cfRecord) {
      const cf = cfRecord.data as CashFlowData;
      bankHeads = cf.bankHeads ?? [];
      for (const m of cf.months ?? []) {
        for (const row of m.rows ?? []) {
          const date = String(row.date ?? "");
          if (date && date > monthEnd) continue;
          closingNet += Number(row.netAmount) || 0;
          if (date.startsWith(month)) monthNet += Number(row.netAmount) || 0;
          for (const [bank, amt] of Object.entries(row.bankAmounts ?? {})) {
            const delta = (Number(amt?.credit) || 0) - (Number(amt?.debit) || 0);
            bankTotals.set(bank, (bankTotals.get(bank) ?? 0) + delta);
          }
        }
      }
    }

    const cashBanks = (bankHeads.length ? bankHeads : [...bankTotals.keys()]).map(bank => ({
      bank,
      balance: bankTotals.get(bank) ?? 0,
    }));

    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const nextMonth = new Date(monthStart);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

    const completedLogs = await prisma.callLog.findMany({
      where: {
        status: "completed",
        createdAt: { gte: monthStart, lt: nextMonth },
      },
      select: {
        leadId: true,
        csr: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const seenLeads = new Set<string>();
    const csrCounts = new Map<string, number>();
    for (const log of completedLogs) {
      if (seenLeads.has(log.leadId)) continue;
      seenLeads.add(log.leadId);
      const name = log.csr?.name ?? "Unknown";
      csrCounts.set(name, (csrCounts.get(name) ?? 0) + 1);
    }
    const totalProjects = [...csrCounts.values()].reduce((a, n) => a + n, 0);
    const csrPerformance = [...csrCounts.entries()]
      .map(([name, projects]) => ({
        name,
        projects,
        share: totalProjects > 0 ? (projects / totalProjects) * 100 : 0,
      }))
      .sort((a, b) => b.projects - a.projects);

    return res.json({
      success: true,
      month,
      sourceDate: lastDateInMonth,
      monthEnd,
      mode: "daily_aggregate",
      totals: { revenue, payroll, opex, loans, pf, totalCost, netProfit },
      history,
      salaryTeams,
      opexHeads,
      loanHeads,
      pfHeads,
      executives,
      cash: {
        banks: cashBanks,
        monthNet,
        closingNet,
        asOf: cfRecord?.recordDate ?? null,
      },
      csr: { totalProjects, rows: csrPerformance },
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
