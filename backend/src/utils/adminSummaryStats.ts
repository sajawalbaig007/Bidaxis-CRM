import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { notInBinFilter } from "./binLeads";
import {
  buildAdminClientViewWhere,
  importantOnlyWhere,
  isImportantStatusWhere,
  isInterestedStatusWhere,
  scheduledCallWhere,
} from "./adminClientQueries";
import { wonClientStatusWhere } from "./projectLeads";

const CHART_DAYS = 45;
const CHART_BATCH = 5000;

export type ChartSeriesPoint = { label: string; calls: number };
export type ChartSeries = {
  today: ChartSeriesPoint[];
  week: ChartSeriesPoint[];
  month: ChartSeriesPoint[];
  year: ChartSeriesPoint[];
};

function fmtWeekDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function fmtMonthShort(d: Date): string {
  return d.toLocaleString("default", { month: "short" });
}

function fmtShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initChartBuckets(): {
  today: Record<string, number>;
  week: Record<string, number>;
  month: Record<string, number>;
  year: Record<string, number>;
  monthStarts: Date[];
} {
  const now = new Date();
  const today: Record<string, number> = {};
  const week: Record<string, number> = {};
  const month: Record<string, number> = {};
  const year: Record<string, number> = {};
  const monthStarts: Date[] = [];

  for (let h = 0; h < 24; h += 3) today[h + ":00"] = 0;

  for (let d = 6; d >= 0; d--) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - d);
    week[fmtWeekDay(dt)] = 0;
  }

  for (let d = 28; d >= 0; d -= 7) {
    const dt = new Date(now);
    dt.setHours(0, 0, 0, 0);
    dt.setDate(dt.getDate() - d);
    monthStarts.push(new Date(dt));
    month[fmtShortDate(dt)] = 0;
  }

  for (let m = 11; m >= 0; m--) {
    const dt = new Date(now);
    dt.setMonth(dt.getMonth() - m);
    year[fmtMonthShort(dt)] = 0;
  }

  return { today, week, month, year, monthStarts };
}

function bumpChartBuckets(
  buckets: ReturnType<typeof initChartBuckets>,
  createdAt: Date,
) {
  const h = createdAt.getHours();
  const hourKey = Math.floor(h / 3) * 3 + ":00";
  if (hourKey in buckets.today) buckets.today[hourKey]++;

  const weekKey = fmtWeekDay(createdAt);
  if (weekKey in buckets.week) buckets.week[weekKey]++;

  const monthKey = pickMonthBucketKey(createdAt, buckets.monthStarts);
  if (monthKey && monthKey in buckets.month) buckets.month[monthKey]++;

  const yearKey = fmtMonthShort(createdAt);
  if (yearKey in buckets.year) buckets.year[yearKey]++;
}

function pickMonthBucketKey(d: Date, starts: Date[]): string | null {
  if (starts.length === 0) return null;
  const t = d.getTime();
  let chosen = starts[0]!;
  for (const start of starts) {
    if (start.getTime() <= t) chosen = start;
  }
  return fmtShortDate(chosen);
}

function bucketsToSeries(buckets: ReturnType<typeof initChartBuckets>): ChartSeries {
  const toPoints = (map: Record<string, number>): ChartSeriesPoint[] =>
    Object.entries(map).map(([label, calls]) => ({ label, calls }));

  return {
    today: toPoints(buckets.today),
    week:  toPoints(buckets.week),
    month: toPoints(buckets.month),
    year:  toPoints(buckets.year),
  };
}

/** CSR call activity — batched CallLog reads (not lead createdAt). */
export async function fetchChartSeries(since: Date): Promise<ChartSeries> {
  const buckets = initChartBuckets();
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.callLog.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, createdAt: true },
      orderBy: { id: "asc" },
      take: CHART_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    for (const row of batch) bumpChartBuckets(buckets, row.createdAt);
    if (batch.length < CHART_BATCH) break;
    cursor = batch[batch.length - 1]!.id;
  }

  return bucketsToSeries(buckets);
}

const legacyCompletedWhere: Prisma.LeadWhereInput = {
  status: { in: ["completed", "closed"], mode: "insensitive" },
};

const closeClientOnlyWhere: Prisma.LeadWhereInput = {
  status: { equals: "Close Client", mode: "insensitive" },
};

const pendingWhere: Prisma.LeadWhereInput = {
  status: { equals: "pending", mode: "insensitive" },
};

const performerResolvedWhere: Prisma.LeadWhereInput = {
  OR: [
    closeClientOnlyWhere,
    isInterestedStatusWhere(),
    isImportantStatusWhere(),
  ],
};

const dashboardOtherWhere: Prisma.LeadWhereInput = {
  AND: [
    { NOT: closeClientOnlyWhere },
    { NOT: legacyCompletedWhere },
    { NOT: pendingWhere },
    { NOT: importantOnlyWhere() },
    { NOT: scheduledCallWhere() },
    { NOT: isInterestedStatusWhere() },
  ],
};

function performerRate(resolved: number, total: number): number {
  if (total <= 0 || resolved <= 0) return 0;
  return Math.round((resolved / total) * 1000) / 10;
}

export async function buildAdminTabCountsPayload() {
  const [all, important, schedule, interested, closed] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: importantOnlyWhere() }),
    prisma.lead.count({ where: scheduledCallWhere() }),
    prisma.lead.count({ where: isInterestedStatusWhere() }),
    prisma.lead.count({ where: buildAdminClientViewWhere("closed") }),
  ]);

  return {
    success: true,
    tabCounts: { all, important, schedule, interested, closed },
  };
}

export async function buildAdminClientSummaryPayload() {
  const chartDaysAgo = new Date();
  chartDaysAgo.setDate(chartDaysAgo.getDate() - CHART_DAYS);

  const activeWhere = notInBinFilter();

  const [
    totalLeads,
    pending,
    interested,
    projectWon,
    completed,
    importantOnly,
    scheduled,
    closedTab,
    other,
    inBin,
    recent,
    recentStatusLogs,
    chartSeries,
    csrGroups,
    resolvedGroups,
    onlineCSRs,
    totalOnline,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { AND: [activeWhere, pendingWhere] } }),
    prisma.lead.count({ where: { AND: [activeWhere, isInterestedStatusWhere()] } }),
    prisma.lead.count({ where: { AND: [activeWhere, closeClientOnlyWhere] } }),
    prisma.lead.count({ where: { AND: [activeWhere, legacyCompletedWhere] } }),
    prisma.lead.count({ where: { AND: [activeWhere, importantOnlyWhere()] } }),
    prisma.lead.count({ where: { AND: [activeWhere, scheduledCallWhere()] } }),
    prisma.lead.count({ where: buildAdminClientViewWhere("closed") }),
    prisma.lead.count({ where: { AND: [activeWhere, dashboardOtherWhere] } }),
    prisma.lead.count({ where: { inBin: true } }),
    prisma.lead.findMany({
      select: {
        id: true,
        name: true,
        company: true,
        status: true,
        updatedAt: true,
        csr: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 15,
    }),
    prisma.callLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        status: true,
        createdAt: true,
        lead: { select: { name: true, company: true } },
        csr: { select: { name: true } },
      },
    }),
    fetchChartSeries(chartDaysAgo),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { assignedTo: { not: "" } },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: {
        assignedTo: { not: "" },
        ...performerResolvedWhere,
      },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { role: "csr", isOnline: true } }),
    prisma.user.count({ where: { isOnline: true } }),
  ]);

  const csrIds = [...new Set([
    ...csrGroups.map(g => g.assignedTo),
    ...resolvedGroups.map(g => g.assignedTo),
  ])].filter((id): id is string => typeof id === "string" && id.length > 0);

  const csrUsers = csrIds.length
    ? await prisma.user.findMany({
        where: { id: { in: csrIds }, role: "csr", isActive: true },
        select: { id: true, name: true },
      })
    : [];

  const csrNameById = new Map(csrUsers.map(u => [u.id, u.name]));
  const totalMap = new Map(
    csrGroups
      .filter(g => csrNameById.has(g.assignedTo))
      .map(g => [g.assignedTo, g._count._all]),
  );
  const resolvedMap = new Map(resolvedGroups.map(g => [g.assignedTo, g._count._all]));

  const performers = [...totalMap.entries()]
    .map(([id, total]) => {
      const resolved = resolvedMap.get(id) ?? 0;
      const name = csrNameById.get(id) ?? "Unknown CSR";
      return { name, resolved, total, rate: performerRate(resolved, total) };
    })
    .filter(p => p.total > 0)
    .sort((a, b) => b.resolved - a.resolved || b.rate - a.rate)
    .slice(0, 5);

  const distribution: Record<string, number> = {
    Pending: pending,
    Important: importantOnly,
    Schedule: scheduled,
    Interested: interested,
    "Close Client": projectWon,
    Completed: completed,
  };
  if (other > 0) distribution.Other = other;
  if (inBin > 0) distribution["In Bin"] = inBin;

  return {
    success: true,
    stats: {
      totalLeads,
      pending,
      important: importantOnly,
      importantOnly,
      scheduled,
      interested,
      projectWon,
      completed,
      closed: closedTab,
      other,
      inBin,
      onlineCSRs,
      totalOnline,
    },
    tabCounts: {
      all: totalLeads,
      important: importantOnly,
      schedule: scheduled,
      interested,
      closed: closedTab,
    },
    distribution,
    recent,
    recentStatus: recentStatusLogs.map(log => ({
      id: log.id,
      status: log.status,
      createdAt: log.createdAt,
      leadName: log.lead?.name?.trim() || log.lead?.company?.trim() || "Lead",
      csrName: log.csr?.name ?? "Unknown CSR",
    })),
    chartSeries,
    performers,
  };
}
