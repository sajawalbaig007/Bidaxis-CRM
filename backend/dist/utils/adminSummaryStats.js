"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchChartSeries = fetchChartSeries;
exports.buildAdminTabCountsPayload = buildAdminTabCountsPayload;
exports.buildAdminClientSummaryPayload = buildAdminClientSummaryPayload;
const db_1 = __importDefault(require("../config/db"));
const binLeads_1 = require("./binLeads");
const adminClientQueries_1 = require("./adminClientQueries");
const CHART_DAYS = 45;
const CHART_BATCH = 5000;
function fmtWeekDay(d) {
    return d.toLocaleDateString("en-US", { weekday: "short" });
}
function fmtMonthShort(d) {
    return d.toLocaleString("default", { month: "short" });
}
function fmtShortDate(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function initChartBuckets() {
    const now = new Date();
    const today = {};
    const week = {};
    const month = {};
    const year = {};
    const monthStarts = [];
    for (let h = 0; h < 24; h += 3)
        today[h + ":00"] = 0;
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
function bumpChartBuckets(buckets, createdAt) {
    const h = createdAt.getHours();
    const hourKey = Math.floor(h / 3) * 3 + ":00";
    if (hourKey in buckets.today)
        buckets.today[hourKey]++;
    const weekKey = fmtWeekDay(createdAt);
    if (weekKey in buckets.week)
        buckets.week[weekKey]++;
    const monthKey = pickMonthBucketKey(createdAt, buckets.monthStarts);
    if (monthKey && monthKey in buckets.month)
        buckets.month[monthKey]++;
    const yearKey = fmtMonthShort(createdAt);
    if (yearKey in buckets.year)
        buckets.year[yearKey]++;
}
function pickMonthBucketKey(d, starts) {
    if (starts.length === 0)
        return null;
    const t = d.getTime();
    let chosen = starts[0];
    for (const start of starts) {
        if (start.getTime() <= t)
            chosen = start;
    }
    return fmtShortDate(chosen);
}
function bucketsToSeries(buckets) {
    const toPoints = (map) => Object.entries(map).map(([label, calls]) => ({ label, calls }));
    return {
        today: toPoints(buckets.today),
        week: toPoints(buckets.week),
        month: toPoints(buckets.month),
        year: toPoints(buckets.year),
    };
}
/** CSR call activity — batched CallLog reads (not lead createdAt). */
async function fetchChartSeries(since) {
    const buckets = initChartBuckets();
    let cursor;
    for (;;) {
        const batch = await db_1.default.callLog.findMany({
            where: { createdAt: { gte: since } },
            select: { id: true, createdAt: true },
            orderBy: { id: "asc" },
            take: CHART_BATCH,
            ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        for (const row of batch)
            bumpChartBuckets(buckets, row.createdAt);
        if (batch.length < CHART_BATCH)
            break;
        cursor = batch[batch.length - 1].id;
    }
    return bucketsToSeries(buckets);
}
const legacyCompletedWhere = {
    status: { in: ["completed", "closed"], mode: "insensitive" },
};
const closeClientOnlyWhere = {
    status: { equals: "Close Client", mode: "insensitive" },
};
const pendingWhere = {
    status: { equals: "pending", mode: "insensitive" },
};
const performerResolvedWhere = {
    OR: [
        closeClientOnlyWhere,
        (0, adminClientQueries_1.isInterestedStatusWhere)(),
        (0, adminClientQueries_1.isImportantStatusWhere)(),
    ],
};
const dashboardOtherWhere = {
    AND: [
        { NOT: closeClientOnlyWhere },
        { NOT: legacyCompletedWhere },
        { NOT: pendingWhere },
        { NOT: (0, adminClientQueries_1.importantOnlyWhere)() },
        { NOT: (0, adminClientQueries_1.scheduledCallWhere)() },
        { NOT: (0, adminClientQueries_1.isInterestedStatusWhere)() },
    ],
};
function performerRate(resolved, total) {
    if (total <= 0 || resolved <= 0)
        return 0;
    return Math.round((resolved / total) * 1000) / 10;
}
async function buildAdminTabCountsPayload() {
    const [all, important, schedule, interested, closed] = await Promise.all([
        db_1.default.lead.count(),
        db_1.default.lead.count({ where: (0, adminClientQueries_1.importantOnlyWhere)() }),
        db_1.default.lead.count({ where: (0, adminClientQueries_1.scheduledCallWhere)() }),
        db_1.default.lead.count({ where: (0, adminClientQueries_1.isInterestedStatusWhere)() }),
        db_1.default.lead.count({ where: (0, adminClientQueries_1.buildAdminClientViewWhere)("closed") }),
    ]);
    return {
        success: true,
        tabCounts: { all, important, schedule, interested, closed },
    };
}
async function buildAdminClientSummaryPayload() {
    const chartDaysAgo = new Date();
    chartDaysAgo.setDate(chartDaysAgo.getDate() - CHART_DAYS);
    const activeWhere = (0, binLeads_1.notInBinFilter)();
    const [totalLeads, pending, interested, projectWon, completed, importantOnly, scheduled, closedTab, other, inBin, recent, recentStatusLogs, chartSeries, csrGroups, resolvedGroups, onlineCSRs, totalOnline,] = await Promise.all([
        db_1.default.lead.count(),
        db_1.default.lead.count({ where: { AND: [activeWhere, pendingWhere] } }),
        db_1.default.lead.count({ where: { AND: [activeWhere, (0, adminClientQueries_1.isInterestedStatusWhere)()] } }),
        db_1.default.lead.count({ where: { AND: [activeWhere, closeClientOnlyWhere] } }),
        db_1.default.lead.count({ where: { AND: [activeWhere, legacyCompletedWhere] } }),
        db_1.default.lead.count({ where: { AND: [activeWhere, (0, adminClientQueries_1.importantOnlyWhere)()] } }),
        db_1.default.lead.count({ where: { AND: [activeWhere, (0, adminClientQueries_1.scheduledCallWhere)()] } }),
        db_1.default.lead.count({ where: (0, adminClientQueries_1.buildAdminClientViewWhere)("closed") }),
        db_1.default.lead.count({ where: { AND: [activeWhere, dashboardOtherWhere] } }),
        db_1.default.lead.count({ where: { inBin: true } }),
        db_1.default.lead.findMany({
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
        db_1.default.callLog.findMany({
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
        db_1.default.lead.groupBy({
            by: ["assignedTo"],
            where: { assignedTo: { not: "" } },
            _count: { _all: true },
        }),
        db_1.default.lead.groupBy({
            by: ["assignedTo"],
            where: {
                assignedTo: { not: "" },
                ...performerResolvedWhere,
            },
            _count: { _all: true },
        }),
        db_1.default.user.count({ where: { role: "csr", isOnline: true } }),
        db_1.default.user.count({ where: { isOnline: true } }),
    ]);
    const csrIds = [...new Set([
            ...csrGroups.map(g => g.assignedTo),
            ...resolvedGroups.map(g => g.assignedTo),
        ])].filter((id) => typeof id === "string" && id.length > 0);
    const csrUsers = csrIds.length
        ? await db_1.default.user.findMany({
            where: { id: { in: csrIds }, role: "csr", isActive: true },
            select: { id: true, name: true },
        })
        : [];
    const csrNameById = new Map(csrUsers.map(u => [u.id, u.name]));
    const totalMap = new Map(csrGroups
        .filter(g => csrNameById.has(g.assignedTo))
        .map(g => [g.assignedTo, g._count._all]));
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
    const distribution = {
        Pending: pending,
        Important: importantOnly,
        Schedule: scheduled,
        Interested: interested,
        "Close Client": projectWon,
        Completed: completed,
    };
    if (other > 0)
        distribution.Other = other;
    if (inBin > 0)
        distribution["In Bin"] = inBin;
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
