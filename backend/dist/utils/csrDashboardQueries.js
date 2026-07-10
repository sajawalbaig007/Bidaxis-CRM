"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCsrTabWhere = buildCsrTabWhere;
exports.getCsrLeadStats = getCsrLeadStats;
exports.mapDashboardLead = mapDashboardLead;
exports.fetchCsrTabLeads = fetchCsrTabLeads;
exports.fetchPotentialLeads = fetchPotentialLeads;
const db_1 = __importDefault(require("../config/db"));
const adminClientQueries_1 = require("./adminClientQueries");
const projectLeads_1 = require("./projectLeads");
const binLeads_1 = require("./binLeads");
const csrLeadSelect_1 = require("./csrLeadSelect");
const potentialClientBuckets_1 = require("./potentialClientBuckets");
const STATUS_NI = "Not Interested";
const STATUS_NP = ["not picked", "not completed"];
function buildCsrTabWhere(csrId, tab) {
    const base = (0, binLeads_1.activeCsrLeadWhere)(csrId);
    switch (tab) {
        case "today":
        case "pending":
            return (0, binLeads_1.pendingLeadWhere)(csrId);
        case "important":
            return { ...base, ...(0, adminClientQueries_1.importantOnlyWhere)() };
        case "schedule":
            return { ...base, ...(0, adminClientQueries_1.scheduledCallWhere)() };
        case "interested":
            return { ...base, ...(0, adminClientQueries_1.isInterestedStatusWhere)() };
        case "projectwon":
            return { ...base, ...(0, projectLeads_1.wonClientStatusWhere)() };
        case "notinterested":
            return {
                ...(0, binLeads_1.activeCsrLeadWhere)(csrId),
                status: { equals: STATUS_NI, mode: "insensitive" },
                notInterestedCount: { lt: binLeads_1.NOT_INTERESTED_LIMIT },
            };
        case "notpicked":
            return {
                ...(0, binLeads_1.activeCsrLeadWhere)(csrId),
                status: { in: [...STATUS_NP], mode: "insensitive" },
                notPickedCount: { lt: binLeads_1.NOT_PICKED_LIMIT },
            };
        case "noowner":
            return { ...base, status: { equals: "no owner available", mode: "insensitive" } };
        case "notinservice":
            return { ...base, status: { equals: "not in service", mode: "insensitive" } };
        case "inhouse":
            return { ...base, status: { equals: "in house", mode: "insensitive" } };
        default:
            return base;
    }
}
async function getCsrLeadStats(csrId) {
    const base = (0, binLeads_1.activeCsrLeadWhere)(csrId);
    const [pendingCount, importantOnlyCount, scheduledCount, interestedCount, projectWonCount, notInterestedCount, notPickedCount, noOwnerCount, notInServiceCount, inHouseCount, totalAssigned, mainPipelineCount,] = await Promise.all([
        db_1.default.lead.count({ where: (0, binLeads_1.pendingLeadWhere)(csrId) }),
        db_1.default.lead.count({ where: { ...base, ...(0, adminClientQueries_1.importantOnlyWhere)() } }),
        db_1.default.lead.count({ where: { ...base, ...(0, adminClientQueries_1.scheduledCallWhere)() } }),
        db_1.default.lead.count({ where: { ...base, ...(0, adminClientQueries_1.isInterestedStatusWhere)() } }),
        db_1.default.lead.count({ where: { ...base, ...(0, projectLeads_1.wonClientStatusWhere)() } }),
        db_1.default.lead.count({ where: buildCsrTabWhere(csrId, "notinterested") }),
        db_1.default.lead.count({ where: buildCsrTabWhere(csrId, "notpicked") }),
        db_1.default.lead.count({ where: buildCsrTabWhere(csrId, "noowner") }),
        db_1.default.lead.count({ where: buildCsrTabWhere(csrId, "notinservice") }),
        db_1.default.lead.count({ where: buildCsrTabWhere(csrId, "inhouse") }),
        db_1.default.lead.count({ where: base }),
        db_1.default.lead.count({ where: (0, binLeads_1.mainPipelineWhere)(csrId) }),
    ]);
    return {
        pendingCount,
        importantOnlyCount,
        scheduledCount,
        interestedCount,
        projectWonCount,
        notInterestedCount,
        notPickedCount,
        noOwnerCount,
        notInServiceCount,
        inHouseCount,
        totalAssigned,
        mainPipelineCount,
        /** All assigned leads (non-bin) — use for dashboard totals; no row cap. */
        totalLeads: totalAssigned,
    };
}
function mapDashboardLead(lead) {
    const { _count, notes, comments, followUpNotes, createdAt, updatedAt, ...rest } = lead;
    const tableNotes = notes ?? [];
    const latest = tableNotes[0];
    return {
        ...rest,
        comments,
        followUpNotes,
        createdAt,
        updatedAt,
        notes: tableNotes,
        noteCount: _count.notes,
        latestNote: latest
            ? { id: latest.id, text: latest.text, createdAt: latest.createdAt }
            : null,
    };
}
const LEAD_LIST_SELECT = {
    ...csrLeadSelect_1.CSR_DASHBOARD_LEAD_SELECT,
    notes: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, text: true, createdAt: true },
    },
};
async function fetchCsrTabLeads(opts) {
    const { csrId, tab, page, pageSize, from, to } = opts;
    const where = { ...buildCsrTabWhere(csrId, tab) };
    if (from || to) {
        const createdAt = {};
        if (from)
            createdAt.gte = new Date(`${from}T00:00:00.000Z`);
        if (to)
            createdAt.lte = new Date(`${to}T23:59:59.999Z`);
        where.createdAt = createdAt;
    }
    const [total, rawLeads] = await Promise.all([
        db_1.default.lead.count({ where }),
        db_1.default.lead.findMany({
            where,
            select: LEAD_LIST_SELECT,
            orderBy: { updatedAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
    ]);
    return {
        leads: rawLeads.map(mapDashboardLead),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
}
/** Potential clients — important / schedule / interested only */
async function fetchPotentialLeads(csrId) {
    const rawLeads = await db_1.default.lead.findMany({
        where: {
            ...(0, binLeads_1.activeCsrLeadWhere)(csrId),
            OR: [(0, adminClientQueries_1.isImportantStatusWhere)(), (0, adminClientQueries_1.isInterestedStatusWhere)()],
        },
        select: LEAD_LIST_SELECT,
        orderBy: { updatedAt: "desc" },
    });
    return rawLeads
        .filter(potentialClientBuckets_1.isPotentialClientLead)
        .map(mapDashboardLead);
}
