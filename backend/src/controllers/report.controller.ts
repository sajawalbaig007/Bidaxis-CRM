import { Request, Response } from "express";
import prisma from "../config/db";
import { Prisma } from "@prisma/client";
import { fetchReportLeads } from "../utils/reportLeads";

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
  notInterested: number;
  projectWon: number;
  inHouse: number;
  noOwner: number;
  notInService: number;
};

type Totals = Omit<CsrPerf, "id" | "csrId" | "name" | "csrCode">;

type ReportPayload = {
  success: true;
  period: string;
  totalLeads: number;
  completed: number;
  pending: number;
  important: number;
  interested: number;
  notCompleted: number;
  notInterested: number;
  projectWon: number;
  inHouse: number;
  noOwner: number;
  notInService: number;
  csrPerformance: CsrPerf[];
  timeChart: { label: string; leads: number; completed: number }[];
  reports: Awaited<ReturnType<typeof prisma.report.findMany>>;
};

const reportCache = new Map<string, { at: number; data: ReportPayload }>();
const CACHE_TTL_MS = 90_000;
const ALL_PERIOD_CACHE_TTL_MS = 300_000;

export function flushReportCache(): void {
  reportCache.clear();
}

function getDateRange(period: string): { gte: Date; lte: Date } {
  const now = new Date();
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

  return { gte: new Date(today.getFullYear() - 1, today.getMonth(), today.getDate()), lte: now };
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

function emptyCsrEntry(csrId: string, csrName: string, csrCode: string | null): CsrPerf {
  return {
    id: csrId,
    csrId,
    name: csrName,
    csrCode,
    totalLeads: 0,
    completed: 0,
    pending: 0,
    important: 0,
    interested: 0,
    notCompleted: 0,
    notInterested: 0,
    projectWon: 0,
    inHouse: 0,
    noOwner: 0,
    notInService: 0,
  };
}

function bumpCounts(
  target: Totals,
  lead: { status: string | null; important: boolean; interested: boolean },
) {
  const s = (lead.status ?? "").toLowerCase();
  target.totalLeads++;
  if (s === "pending") target.pending++;
  if (s === "important" || lead.important) target.important++;
  if (s === "interested" || lead.interested) target.interested++;
  if (s === "not picked" || s === "not completed") target.notCompleted++;
  if (s === "not interested") target.notInterested++;
  if (s === "completed") target.completed++;
  if (s === "close client") target.projectWon++;
  if (s === "in house") target.inHouse++;
  if (s === "no owner available") target.noOwner++;
  if (s === "not in service") target.notInService++;
}

function buildTimeChart(leads: LeadRow[], period: string) {
  if (period === "today") {
    const buckets: Record<number, { leads: number; completed: number }> = {};
    for (let h = 0; h < 24; h++) buckets[h] = { leads: 0, completed: 0 };

    leads.forEach(l => {
      const h = new Date(l.activityAt).getHours();
      buckets[h].leads++;
      if (isCompletedOutcome((l.status ?? "").toLowerCase())) buckets[h].completed++;
    });

    return Object.entries(buckets)
      .filter(([, v]) => v.leads > 0)
      .map(([h, v]) => ({
        label: `${Number(h) % 12 || 12} ${Number(h) < 12 ? "AM" : "PM"}`,
        leads: v.leads,
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

    leads.forEach(l => {
      const d = new Date(l.activityAt);
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

    leads.forEach(l => {
      const diffDays = Math.floor((Date.now() - new Date(l.activityAt).getTime()) / 86400000);
      const weekIdx = Math.min(Math.floor(diffDays / 7), 4);
      const key = String(weekIdx);
      if (buckets[key]) {
        buckets[key].leads++;
        if (isCompletedOutcome((l.status ?? "").toLowerCase())) buckets[key].completed++;
      }
    });

    return [4, 3, 2, 1, 0].map(w => ({
      label: weekLabels[4 - w],
      leads: buckets[String(w)].leads,
      completed: buckets[String(w)].completed,
    }));
  }

  return [];
}

function cacheKey(period: string, fromDate?: string, toDate?: string) {
  return `${period}|${fromDate ?? ""}|${toDate ?? ""}`;
}

export const getReports = async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "week";
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const key = cacheKey(period, fromDate, toDate);

    const hit = reportCache.get(key);
    const ttl = period === "all" && !fromDate ? ALL_PERIOD_CACHE_TTL_MS : CACHE_TTL_MS;
    if (hit && Date.now() - hit.at < ttl) {
      return res.json(hit.data);
    }

    const whereClause = buildPeriodWhere(period, fromDate, toDate);
    const needsTimeChart = !fromDate && (period === "today" || period === "week" || period === "month");

    const [leads, reports] = await Promise.all([
      fetchReportLeads(whereClause),
      prisma.report.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);

    const totals = emptyCsrEntry("all", "all", null);
    const csrMap = new Map<string, CsrPerf>();
    const timeRows: LeadRow[] = needsTimeChart ? [] : [];

    for (const lead of leads) {
      bumpCounts(totals, lead);

      const csrId = lead.assignedTo ?? "unknown";
      const csrName = lead.csr?.name ?? "Unknown";
      if (!csrMap.has(csrId)) {
        csrMap.set(csrId, emptyCsrEntry(csrId, csrName, lead.csr?.csrCode ?? null));
      }
      bumpCounts(csrMap.get(csrId)!, lead);

      if (needsTimeChart) {
        timeRows.push({
          activityAt: lead.updatedAt > lead.createdAt ? lead.updatedAt : lead.createdAt,
          status: lead.status,
          important: lead.important,
          interested: lead.interested,
        });
      }
    }

    const csrPerformance = Array.from(csrMap.values()).sort((a, b) => b.totalLeads - a.totalLeads);
    const completed = leads.filter(l => isCompletedOutcome((l.status ?? "").toLowerCase())).length;

    const payload: ReportPayload = {
      success: true,
      period,
      totalLeads: totals.totalLeads,
      completed,
      pending: totals.pending,
      important: totals.important,
      interested: totals.interested,
      notCompleted: totals.notCompleted,
      notInterested: totals.notInterested,
      projectWon: totals.projectWon,
      inHouse: totals.inHouse,
      noOwner: totals.noOwner,
      notInService: totals.notInService,
      csrPerformance,
      timeChart: needsTimeChart ? buildTimeChart(timeRows, period) : [],
      reports,
    };

    reportCache.set(key, { at: Date.now(), data: payload });
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch reports" });
  }
};
