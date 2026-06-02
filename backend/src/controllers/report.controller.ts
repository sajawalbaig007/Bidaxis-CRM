import { Request, Response } from "express";
import prisma from "../config/db";
import { Prisma } from "@prisma/client";
/* ── Date range helper ── */
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
    start.setDate(today.getDate() - 6); // last 7 days
    return { gte: start, lte: now };
  }

  if (period === "month") {
    const start = new Date(today);
    start.setDate(today.getDate() - 29); // last 30 days
    return { gte: start, lte: now };
  }

  // all — no filter
  return { gte: new Date(0), lte: now };
}

/* ── Label for time-series chart ── */
function buildTimeChart(
  leads: { createdAt: Date; status: string | null }[],
  period: string
) {
  if (period === "today") {
    /* Group by hour 0–23 */
    const buckets: Record<number, { leads: number; completed: number }> = {};
    for (let h = 0; h < 24; h++) buckets[h] = { leads: 0, completed: 0 };

    leads.forEach(l => {
      const h = new Date(l.createdAt).getHours();
      buckets[h].leads++;
      if (l.status?.toLowerCase() === "completed") buckets[h].completed++;
    });

    return Object.entries(buckets)
      .filter(([, v]) => v.leads > 0) // only hours with data
      .map(([h, v]) => ({
        label: `${Number(h) % 12 || 12} ${Number(h) < 12 ? "AM" : "PM"}`,
        leads: v.leads,
        completed: v.completed,
      }));
  }

  if (period === "week") {
    /* Group by day — last 7 days */
    const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const buckets: Record<string, { leads: number; completed: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getMonth()+1}/${d.getDate()}`;
      buckets[key] = { leads: 0, completed: 0 };
    }

    leads.forEach(l => {
      const d   = new Date(l.createdAt);
      const key = `${d.getMonth()+1}/${d.getDate()}`;
      if (buckets[key]) {
        buckets[key].leads++;
        if (l.status?.toLowerCase() === "completed") buckets[key].completed++;
      }
    });

    return Object.entries(buckets).map(([date, v]) => {
      const [m, d] = date.split("/");
      const dayName = days[new Date(new Date().getFullYear(), Number(m)-1, Number(d)).getDay()];
      return { label: `${dayName} ${date}`, leads: v.leads, completed: v.completed };
    });
  }

  if (period === "month") {
    /* Group by week — last 4 weeks */
    const buckets: Record<string, { leads: number; completed: number }> = {};
    const weekLabels = ["Week 4 ago","Week 3 ago","Week 2 ago","Last Week","This Week"];

    for (let w = 4; w >= 0; w--) {
      buckets[String(w)] = { leads: 0, completed: 0 };
    }

    leads.forEach(l => {
      const diffDays = Math.floor((Date.now() - new Date(l.createdAt).getTime()) / 86400000);
      const weekIdx  = Math.min(Math.floor(diffDays / 7), 4);
      const key      = String(weekIdx);
      if (buckets[key]) {
        buckets[key].leads++;
        if (l.status?.toLowerCase() === "completed") buckets[key].completed++;
      }
    });

    return [4, 3, 2, 1, 0].map(w => ({
      label:     weekLabels[4 - w],
      leads:     buckets[String(w)].leads,
      completed: buckets[String(w)].completed,
    }));
  }

  return [];
}

export const getReports = async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || "all";
const fromDate = req.query.fromDate as string | undefined;
const toDate = req.query.toDate as string | undefined;

let whereClause: Prisma.LeadWhereInput = {};

if (fromDate && toDate) {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  whereClause = {
    createdAt: {
      gte: start,
      lte: end,
    },
  };
} else if (period !== "all") {
  const range = getDateRange(period);

  whereClause = {
    createdAt: {
      gte: range.gte,
      lte: range.lte,
    },
  };
}
    const leads = await prisma.lead.findMany({
      where:   whereClause,
      include: { csr: true },
    });

    const totalLeads = leads.length;
    const completed  = leads.filter(l => l.status?.toLowerCase() === "completed").length;
    const pending    = leads.filter(l => l.status?.toLowerCase() === "pending").length;
    const important  = leads.filter(l => l.status?.toLowerCase() === "important").length;
    const interested = leads.filter(l => l.status?.toLowerCase() === "interested").length;

    /* ── CSR PERFORMANCE ── */
    const csrMap = new Map<string, {
      id: string; csrId: string; name: string;
      totalLeads: number; completed: number; pending: number; important: number;
    }>();

    leads.forEach(lead => {
      const csrId   = lead.assignedTo ?? "unknown";
      const csrName = lead.csr?.name  ?? "Unknown";

      if (!csrMap.has(csrId)) {
        csrMap.set(csrId, {
          id: csrId, csrId, name: csrName,
          totalLeads: 0, completed: 0, pending: 0, important: 0,
        });
      }

      const entry = csrMap.get(csrId)!;
      entry.totalLeads++;
      const s = lead.status?.toLowerCase();
      if (s === "completed") entry.completed++;
      if (s === "pending")   entry.pending++;
      if (s === "important") entry.important++;
    });

    const csrPerformance = Array.from(csrMap.values());

    /* ── TIME-SERIES CHART for today/week/month ── */
    const timeChart = buildTimeChart(
      leads.map(l => ({ createdAt: l.createdAt, status: l.status })),
      period
    );

    const reports = await prisma.report.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json({
      period,
      totalLeads,
      completed,
      pending,
      important,
      interested,
      csrPerformance,
      timeChart,    // ← new: time-series data
      reports,
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
};