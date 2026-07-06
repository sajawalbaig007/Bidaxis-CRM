import prisma from "../config/db";
import {
  buildAdminClientViewWhere,
  importantOnlyWhere,
  scheduledCallWhere,
  isInterestedStatusWhere,
} from "./adminClientQueries";

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

function initChartBuckets(): {
  today: Record<string, number>;
  week: Record<string, number>;
  month: Record<string, number>;
  year: Record<string, number>;
} {
  const now = new Date();
  const today: Record<string, number> = {};
  const week: Record<string, number> = {};
  const month: Record<string, number> = {};
  const year: Record<string, number> = {};

  for (let h = 0; h < 24; h += 3) today[h + ":00"] = 0;

  for (let d = 6; d >= 0; d--) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - d);
    week[fmtWeekDay(dt)] = 0;
  }

  for (let d = 29; d >= 0; d -= 5) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - d);
    month[fmtWeekDay(dt)] = 0;
  }

  for (let m = 11; m >= 0; m--) {
    const dt = new Date(now);
    dt.setMonth(dt.getMonth() - m);
    year[fmtMonthShort(dt)] = 0;
  }

  return { today, week, month, year };
}

function bumpChartBuckets(buckets: ReturnType<typeof initChartBuckets>, createdAt: Date) {
  const h = createdAt.getHours();
  const hourKey = Math.floor(h / 3) * 3 + ":00";
  if (hourKey in buckets.today) buckets.today[hourKey]++;

  const weekKey = fmtWeekDay(createdAt);
  if (weekKey in buckets.week) buckets.week[weekKey]++;

  const monthKey = fmtWeekDay(createdAt);
  if (monthKey in buckets.month) buckets.month[monthKey]++;

  const yearKey = fmtMonthShort(createdAt);
  if (yearKey in buckets.year) buckets.year[yearKey]++;
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

/** Cursor-batched — aggregates on server, returns small chart series (not raw rows). */
export async function fetchChartSeries(since: Date): Promise<ChartSeries> {
  const buckets = initChartBuckets();
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.lead.findMany({
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

  const [
    totalLeads,
    pending,
    interested,
    projectWon,
    completed,
    importantOnly,
    scheduled,
    closed,
    recent,
    recentStatusLogs,
    chartSeries,
    csrGroups,
    resolvedGroups,
    onlineCSRs,
    totalOnline,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { status: "pending" } }),
    prisma.lead.count({ where: isInterestedStatusWhere() }),
    prisma.lead.count({ where: { status: { in: ["Close Client", "close client"] } } }),
    prisma.lead.count({ where: { status: { in: ["completed", "closed"] } } }),
    prisma.lead.count({ where: importantOnlyWhere() }),
    prisma.lead.count({ where: scheduledCallWhere() }),
    prisma.lead.count({ where: buildAdminClientViewWhere("closed") }),
    prisma.lead.findMany({
      select: {
        id: true,
        name: true,
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
        lead: { select: { name: true } },
        csr: { select: { name: true } },
      },
    }),
    fetchChartSeries(chartDaysAgo),
    prisma.lead.groupBy({ by: ["assignedTo"], _count: { _all: true } }),
    prisma.lead.groupBy({
      by: ["assignedTo"],
      where: { status: { in: ["Close Client", "close client", "interested", "important"] } },
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
    ? await prisma.user.findMany({ where: { id: { in: csrIds } }, select: { id: true, name: true } })
    : [];

  const csrNameById = new Map(csrUsers.map(u => [u.id, u.name]));
  const totalMap = new Map(csrGroups.map(g => [g.assignedTo, g._count._all]));
  const resolvedMap = new Map(resolvedGroups.map(g => [g.assignedTo, g._count._all]));

  const performers = [...totalMap.entries()]
    .filter(([id]) => typeof id === "string" && id.length > 0)
    .map(([id, total]) => {
      const resolved = resolvedMap.get(id) ?? 0;
      const name = csrNameById.get(id) ?? "Unassigned";
      return { name, resolved, total, rate: total > 0 ? Math.round((resolved / total) * 100) : 0 };
    })
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 5);

  return {
    success: true,
    stats: {
      totalLeads,
      pending,
      important: importantOnly + scheduled,
      importantOnly,
      scheduled,
      interested,
      projectWon,
      completed,
      closed,
      onlineCSRs,
      totalOnline,
    },
    tabCounts: {
      all: totalLeads,
      important: importantOnly,
      schedule: scheduled,
      interested,
      closed,
    },
    distribution: {
      Pending: pending,
      Important: importantOnly + scheduled,
      Interested: interested,
      "Close Client": projectWon,
      Closed: completed + closed,
    },
    recent,
    recentStatus: recentStatusLogs.map(log => ({
      id: log.id,
      status: log.status,
      createdAt: log.createdAt,
      leadName: log.lead?.name ?? "Unknown",
      csrName: log.csr?.name ?? "Unknown CSR",
    })),
    chartSeries,
    performers,
  };
}
