import { Response } from "express";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/**
 * Monthly Executive Summary report — aggregates all daily income_statement
 * records of a month, cash flow position, and CSR completed projects.
 */

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
function aggregateCategory(records: Record<string, unknown>[], key: string, nameField: "team" | "label"): CategoryGroup[] {
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

export async function getMonthlyAccountsReport(req: AuthRequest, res: Response) {
  try {
    const month = String(req.query.month ?? "").trim(); // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ success: false, message: "Invalid month. Use YYYY-MM." });
    }
    const monthEnd = `${month}-31`;

    // ---- Income statement: full history + this month's records ----
    const isRecords = await prisma.accountsRecord.findMany({
      where: { page: "income_statement" },
      select: { recordDate: true, data: true },
      orderBy: { recordDate: "asc" },
    });

    const byMonth = new Map<string, { revenue: number; cost: number }>();
    const monthRecords: Record<string, unknown>[] = [];

    for (const rec of isRecords) {
      const data = rec.data as Record<string, unknown>;
      const m = rec.recordDate.slice(0, 7);
      const entry = byMonth.get(m) ?? { revenue: 0, cost: 0 };
      entry.revenue += Number(data.totalRevenue) || 0;
      entry.cost += isRowExpense(data);
      byMonth.set(m, entry);
      if (m === month) monthRecords.push(data);
    }

    const history = [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([m, v]) => ({ month: m, revenue: v.revenue, cost: v.cost, net: v.revenue - v.cost }))
      .filter(h => h.revenue !== 0 || h.cost !== 0);

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

    // ---- Cash flow: closing balances up to month end ----
    const cfRecords = await prisma.accountsRecord.findMany({
      where: { page: "cash_flow" },
      select: { recordDate: true, data: true },
      orderBy: { recordDate: "desc" },
    });
    const cfRecord =
      cfRecords.find(r => r.recordDate <= monthEnd) ?? cfRecords[cfRecords.length - 1];

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

    // ---- CSR completed projects in this month ----
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
