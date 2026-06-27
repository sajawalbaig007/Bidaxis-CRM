import { Request, Response } from "express";
import prisma from "../config/db";
import { Prisma } from "@prisma/client";

type LeadRow = {
  activityAt: Date;
  status: string | null;
  important: boolean;
  interested: boolean;
};

type CsrPerf = {
  id: string;
  csrId: string;
  name: string;
  csrCode?: string | null;
  totalLeads: number;
  completed: number;
  pending: number;
  important: number;
  interested: number;
  notCompleted: number;
  projectWon: number;
};

function getDateRange(period: string): { gte: Date; lte: Date } {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "today") {
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);
    return { gte: today, lte: end };
  }
  if (period === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);
    return { gte: start, lte: now };
  }
  if (period === "month") {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    return { gte: start, lte: now };
  }
  return { gte: new Date(0), lte: now };
}

function activityInRange(gte: Date, lte: Date): Prisma.LeadWhereInput {
  return {
    OR: [
      { updatedAt: { gte, lte } },
      { createdAt: { gte, lte } },
    ],
  };
}

function buildPeriodWhere(
  period: string,
  fromDate?: string,
  toDate?: string,
): Prisma.LeadWhereInput {
  if (fromDate && toDate) {
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    return activityInRange(start, end);
  }
  if (period !== "all") {
    const range = getDateRange(period);
    return activityInRange(range.gte, range.lte);
  }
  return {};
}

function isCompletedOutcome(status: string): boolean {
  return status === "completed" || status === "not interested" || status === "close client";
}

function applyLeadToCsrEntry(
  entry: CsrPerf,
  lead: { status: string | null; important: boolean; interested: boolean },
) {
  const s = (lead.status ?? "").toLowerCase();
  entry.totalLeads++;
  if (s === "pending") entry.pending++;
  if (s === "important" || lead.important) entry.important++;
  if (s === "interested" || lead.interested) entry.interested++;
  if (s === "not picked" || s === "not completed") entry.notCompleted++;
  if (s === "not interested" || s === "completed") entry.completed++;
  if (s === "close client") entry.projectWon++;
}

function buildTimeChart(leads: LeadRow[], period: string) {
  if (period === "today") {
    const buckets: Record<number, { leads: number; completed: number }> = {};
    for (let h = 0; h < 24; h++) buckets[h] = { leads: 0, completed: 0 };

    leads.forEach((l) => {
      const h = new Date(l.activityAt).getHours();
      buckets[h].leads++;
      if (isCompletedOutcome((l.status ?? "").toLowerCase())) buckets[h].completed++;
    });

    return Object.entries(buckets)
      .filter(([, v]) => v.leads > 0)
      .map(([h, v]) => ({
        label:     `${Number(h) % 12 || 12} ${Number(h) < 12 ? "AM" : "PM"}`,
        leads:     v.leads,
        completed: v.completed,
      }));
  }

  if (period === "week") {
    const buckets: Record<string, { leads: number; completed: number }> = {};
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      buckets[key] = { leads: 0, completed: 0 };
    }

    leads.forEach((l) => {
      const d   = new Date(l.activityAt);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      if (buckets[key]) {
        buckets[key].leads++;
        if (isCompletedOutcome((l.status ?? "").toLowerCase())) buckets[key].completed++;
      }
    });

    return Object.entries(buckets).map(([date, v]) => {
      const [m, d] = date.split("/");
      const dayName = days[new Date(new Date().getFullYear(), Number(m) - 1, Number(d)).getDay()];
      return { label: `${dayName} ${date}`, leads: v.leads, completed: v.completed };
    });
  }

  if (period === "month") {
    const buckets: Record<string, { leads: number; completed: number }> = {};
    const weekLabels = ["Week 4 ago", "Week 3 ago", "Week 2 ago", "Last Week", "This Week"];

    for (let w = 4; w >= 0; w--) buckets[String(w)] = { leads: 0, completed: 0 };

    leads.forEach((l) => {
      const diffDays = Math.floor((Date.now() - new Date(l.activityAt).getTime()) / 86400000);
      const weekIdx  = Math.min(Math.floor(diffDays / 7), 4);
      const key      = String(weekIdx);
      if (buckets[key]) {
        buckets[key].leads++;
        if (isCompletedOutcome((l.status ?? "").toLowerCase())) buckets[key].completed++;
      }
    });

    return [4, 3, 2, 1, 0].map((w) => ({
      label:     weekLabels[4 - w],
      leads:     buckets[String(w)].leads,
      completed: buckets[String(w)].completed,
    }));
  }

  return [];
}

export const getReports = async (req: Request, res: Response) => {
  try {
    const period   = (req.query.period as string) || "all";
    const fromDate = req.query.fromDate as string | undefined;
    const toDate   = req.query.toDate as string | undefined;

    const whereClause = buildPeriodWhere(period, fromDate, toDate);

    const leads = await prisma.lead.findMany({
      where: whereClause,
      select: {
        status: true,
        important: true,
        interested: true,
        assignedTo: true,
        createdAt: true,
        updatedAt: true,
        csr: { select: { name: true, csrCode: true } },
      },
    });

    const rows: LeadRow[] = leads.map((l) => ({
      activityAt: l.updatedAt > l.createdAt ? l.updatedAt : l.createdAt,
      status: l.status,
      important: l.important,
      interested: l.interested,
    }));

    const csrMap = new Map<string, CsrPerf>();

    leads.forEach((lead) => {
      const csrId = lead.assignedTo ?? "unknown";
      const csrName = lead.csr?.name ?? "Unknown";

      if (!csrMap.has(csrId)) {
        csrMap.set(csrId, {
          id: csrId,
          csrId,
          name: csrName,
          csrCode: lead.csr?.csrCode ?? null,
          totalLeads: 0,
          completed: 0,
          pending: 0,
          important: 0,
          interested: 0,
          notCompleted: 0,
          projectWon: 0,
        });
      }

      applyLeadToCsrEntry(csrMap.get(csrId)!, lead);
    });

    const csrPerformance = Array.from(csrMap.values())
      .sort((a, b) => b.totalLeads - a.totalLeads);

    const totalLeads   = rows.length;
    const completed    = rows.filter((l) => isCompletedOutcome((l.status ?? "").toLowerCase())).length;
    const pending      = rows.filter((l) => (l.status ?? "").toLowerCase() === "pending").length;
    const important    = rows.filter((l) => {
      const s = (l.status ?? "").toLowerCase();
      return s === "important" || l.important;
    }).length;
    const interested   = rows.filter((l) => {
      const s = (l.status ?? "").toLowerCase();
      return s === "interested" || l.interested;
    }).length;
    const notCompleted = rows.filter((l) => {
      const s = (l.status ?? "").toLowerCase();
      return s === "not picked" || s === "not completed";
    }).length;
    const projectWon   = rows.filter((l) => (l.status ?? "").toLowerCase() === "close client").length;

    const timeChart = buildTimeChart(rows, period);

    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return res.json({
      success: true,
      period,
      totalLeads,
      completed,
      pending,
      important,
      interested,
      notCompleted,
      projectWon,
      csrPerformance,
      timeChart,
      reports,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch reports" });
  }
};
