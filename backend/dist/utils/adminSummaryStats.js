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
const businessCalendar_1 = require("./businessCalendar");
const CHART_DAYS = 45;
const CHART_BATCH = 5000;
function initChartBuckets(now = new Date()) {
    const currentBizYmd = (0, businessCalendar_1.currentBusinessYmd)(now);
    const today = (0, businessCalendar_1.initBusinessHourBuckets)();
    const week = {};
    const month = {};
    const year = {};
    const weekKeys = [];
    const monthKeys = [];
    const yearKeys = [];
    for (let d = 6; d >= 0; d--) {
        const ymd = (0, businessCalendar_1.addDaysToYmd)(currentBizYmd, -d);
        weekKeys.push(ymd);
        week[ymd] = 0;
    }
    for (let d = 28; d >= 0; d -= 7) {
        const ymd = (0, businessCalendar_1.addDaysToYmd)(currentBizYmd, -d);
        monthKeys.push(ymd);
        month[ymd] = 0;
    }
    const seenMonths = new Set();
    for (let d = 364; d >= 0; d -= 28) {
        const ymd = (0, businessCalendar_1.addDaysToYmd)(currentBizYmd, -d);
        const monthLabel = (0, businessCalendar_1.fmtMonthShortFromYmd)(ymd);
        if (seenMonths.has(monthLabel))
            continue;
        seenMonths.add(monthLabel);
        yearKeys.push(ymd);
        year[ymd] = 0;
    }
    return { today, week, month, year, weekKeys, monthKeys, yearKeys, currentBizYmd };
}
function pickMonthBucketKey(bizYmd, monthKeys) {
    if (monthKeys.length === 0)
        return null;
    let chosen = monthKeys[0];
    for (const key of monthKeys) {
        if (key <= bizYmd)
            chosen = key;
    }
    return chosen;
}
function pickYearBucketKey(bizYmd, yearKeys) {
    if (yearKeys.length === 0)
        return null;
    const month = (0, businessCalendar_1.fmtMonthShortFromYmd)(bizYmd);
    return yearKeys.find(k => (0, businessCalendar_1.fmtMonthShortFromYmd)(k) === month) ?? null;
}
function bumpChartBuckets(buckets, createdAt, now) {
    const bizYmd = (0, businessCalendar_1.getBusinessYmd)(createdAt);
    if ((0, businessCalendar_1.isSameBusinessDay)(createdAt, now)) {
        const hourKey = (0, businessCalendar_1.businessHourBucketKey)(createdAt);
        if (hourKey in buckets.today)
            buckets.today[hourKey]++;
    }
    if (bizYmd in buckets.week)
        buckets.week[bizYmd]++;
    const monthKey = pickMonthBucketKey(bizYmd, buckets.monthKeys);
    if (monthKey && monthKey in buckets.month)
        buckets.month[monthKey]++;
    const yearKey = pickYearBucketKey(bizYmd, buckets.yearKeys);
    if (yearKey && yearKey in buckets.year)
        buckets.year[yearKey]++;
}
function bucketsToSeries(buckets) {
    const toPoints = (map, labels) => Object.keys(map).map(key => ({ label: labels[key] ?? key, calls: map[key] ?? 0 }));
    const weekLabels = Object.fromEntries(buckets.weekKeys.map(k => [k, (0, businessCalendar_1.fmtWeekDayFromYmd)(k)]));
    const monthLabels = Object.fromEntries(buckets.monthKeys.map(k => [k, (0, businessCalendar_1.fmtShortDateFromYmd)(k)]));
    const yearLabels = Object.fromEntries(buckets.yearKeys.map(k => [k, (0, businessCalendar_1.fmtMonthShortFromYmd)(k)]));
    return {
        today: Object.entries(buckets.today).map(([label, calls]) => ({ label, calls })),
        week: toPoints(buckets.week, weekLabels),
        month: toPoints(buckets.month, monthLabels),
        year: toPoints(buckets.year, yearLabels),
    };
}
/** CSR call activity — batched CallLog reads; business day resets 4:00 AM */
async function fetchChartSeries(since) {
    const now = new Date();
    const buckets = initChartBuckets(now);
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
            bumpChartBuckets(buckets, row.createdAt, now);
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
const wonWhere = {
    OR: [closeClientOnlyWhere, legacyCompletedWhere],
};
function andWhere(...parts) {
    return { AND: parts };
}
function notBinAnd(...parts) {
    return andWhere((0, binLeads_1.buildNotBinWhere)(), ...parts);
}
/** Mutually exclusive pipeline buckets (priority: won → interested → schedule → important → pending → other); bin counted separately. */
async function countExclusivePipeline() {
    const binWhere = (0, binLeads_1.buildBinWhere)();
    const notBin = (0, binLeads_1.buildNotBinWhere)();
    const [totalLeads, inBin, projectWon, interested, scheduled, importantOnly, pending, activeNotBin,] = await Promise.all([
        db_1.default.lead.count(),
        db_1.default.lead.count({ where: binWhere }),
        db_1.default.lead.count({ where: notBinAnd(wonWhere) }),
        db_1.default.lead.count({
            where: notBinAnd((0, adminClientQueries_1.isInterestedStatusWhere)(), { NOT: wonWhere }),
        }),
        db_1.default.lead.count({
            where: notBinAnd((0, adminClientQueries_1.scheduledCallWhere)(), { NOT: wonWhere }, { NOT: (0, adminClientQueries_1.isInterestedStatusWhere)() }),
        }),
        db_1.default.lead.count({
            where: notBinAnd((0, adminClientQueries_1.importantOnlyWhere)(), { NOT: wonWhere }, { NOT: (0, adminClientQueries_1.isInterestedStatusWhere)() }, { NOT: (0, adminClientQueries_1.scheduledCallWhere)() }),
        }),
        db_1.default.lead.count({
            where: notBinAnd(pendingWhere, { NOT: wonWhere }, { NOT: (0, adminClientQueries_1.isInterestedStatusWhere)() }, { NOT: (0, adminClientQueries_1.scheduledCallWhere)() }, { NOT: (0, adminClientQueries_1.importantOnlyWhere)() }),
        }),
        db_1.default.lead.count({ where: notBin }),
    ]);
    const categorizedActive = projectWon + interested + scheduled + importantOnly + pending;
    const other = Math.max(0, activeNotBin - categorizedActive);
    return {
        totalLeads,
        inBin,
        projectWon,
        interested,
        scheduled,
        importantOnly,
        pending,
        other,
        legacyCompleted: await db_1.default.lead.count({
            where: notBinAnd(legacyCompletedWhere, { NOT: closeClientOnlyWhere }),
        }),
    };
}
function performerRate(resolved, total) {
    if (total <= 0 || resolved <= 0)
        return 0;
    const pct = (resolved / total) * 100;
    if (pct < 1)
        return Math.round(pct * 100) / 100;
    return Math.round(pct * 10) / 10;
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
    const chartSince = (0, businessCalendar_1.businessChartSinceUtc)(CHART_DAYS);
    const pipelinePromise = countExclusivePipeline();
    const notBin = (0, binLeads_1.buildNotBinWhere)();
    const [pipeline, closedTab, recent, recentStatusLogs, chartSeries, csrGroups, resolvedGroups, onlineCSRs, totalOnline,] = await Promise.all([
        pipelinePromise,
        db_1.default.lead.count({ where: (0, adminClientQueries_1.buildAdminClientViewWhere)("closed") }),
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
        fetchChartSeries(chartSince),
        db_1.default.lead.groupBy({
            by: ["assignedTo"],
            where: { assignedTo: { not: "" }, ...notBin },
            _count: { _all: true },
        }),
        db_1.default.lead.groupBy({
            by: ["assignedTo"],
            where: {
                assignedTo: { not: "" },
                ...notBin,
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
    const { totalLeads, pending, interested, projectWon, importantOnly, scheduled, other, inBin, legacyCompleted, } = pipeline;
    const distribution = {
        Pending: pending,
        Important: importantOnly,
        Schedule: scheduled,
        Interested: interested,
        "Close Client": projectWon,
    };
    if (legacyCompleted > 0)
        distribution.Completed = legacyCompleted;
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
            completed: closedTab,
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
        businessDay: {
            timezone: process.env.BUSINESS_TIMEZONE?.trim() || "Asia/Karachi",
            startHour: Number(process.env.BUSINESS_DAY_START_HOUR ?? 4),
            currentBusinessDate: (0, businessCalendar_1.currentBusinessYmd)(),
        },
        performers,
    };
}
