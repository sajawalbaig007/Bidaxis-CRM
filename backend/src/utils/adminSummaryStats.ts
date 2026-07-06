import prisma from "../config/db";
import {
  buildAdminClientViewWhere,
  importantOnlyWhere,
  scheduledCallWhere,
  isInterestedStatusWhere,
} from "./adminClientQueries";

const CHART_DAYS = 45;
const CHART_BATCH = 5000;

/** Same `{ createdAt }[]` payload as one findMany — cursor-batched for large datasets. */
export async function fetchChartLeadDates(since: Date): Promise<{ createdAt: Date }[]> {
  const out: { createdAt: Date }[] = [];
  let cursor: string | undefined;

  for (;;) {
    const batch = await prisma.lead.findMany({
      where: { createdAt: { gte: since } },
      select: { id: true, createdAt: true },
      orderBy: { id: "asc" },
      take: CHART_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    for (const row of batch) out.push({ createdAt: row.createdAt });
    if (batch.length < CHART_BATCH) break;
    cursor = batch[batch.length - 1]!.id;
  }

  return out;
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
    chartLeads,
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
    fetchChartLeadDates(chartDaysAgo),
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
    recentStatusLogs: recentStatusLogs.map(log => ({
      id: log.id,
      status: log.status,
      createdAt: log.createdAt,
      leadName: log.lead?.name ?? "Unknown",
      csrName: log.csr?.name ?? "Unknown CSR",
    })),
    chartLeads,
    performers,
  };
}
