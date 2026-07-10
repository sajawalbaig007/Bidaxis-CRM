"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../config/db"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const sessions_1 = require("../utils/sessions");
const accessHistory_1 = require("../utils/accessHistory");
const requestMeta_1 = require("../utils/requestMeta");
const cache_1 = require("../utils/cache");
const csrCache_1 = require("../utils/csrCache");
const phone_1 = require("../utils/phone");
const leadPhoneLookup_1 = require("../utils/leadPhoneLookup");
const leadClientPromotion_1 = require("../utils/leadClientPromotion");
const projectLeads_1 = require("../utils/projectLeads");
const adminClientQueries_1 = require("../utils/adminClientQueries");
const projectPayments_1 = require("../utils/projectPayments");
const binLeads_1 = require("../utils/binLeads");
const uploadSourceSelect_1 = require("../utils/uploadSourceSelect");
const csrLeadSelect_1 = require("../utils/csrLeadSelect");
const csrDashboardQueries_1 = require("../utils/csrDashboardQueries");
const router = express_1.default.Router();
async function logStatusChange(csrId, leadId, status) {
    try {
        await db_1.default.callLog.create({ data: { leadId, csrId, status } });
    }
    catch (error) {
        console.log("Failed to log status change", error);
    }
}
/** Expensive won/pending dedupe — at most once per CSR every 2 minutes */
async function maybeHealPipelineLeaks(csrId) {
    if ((0, cache_1.shouldSkipThrottledHeal)(csrId))
        return 0;
    const removed = await (0, leadClientPromotion_1.healPipelineLeaksForCsr)(csrId);
    (0, cache_1.markThrottledHeal)(csrId);
    return removed;
}
function getActivityRange(period, dateStr) {
    const parts = dateStr.split("-").map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const m = parts[1] ?? 1;
    const d = parts[2] ?? 1;
    if (period === "week") {
        const dow = new Date(y, m - 1, d).getDay();
        const diffToMon = dow === 0 ? -6 : 1 - dow;
        const from = new Date(y, m - 1, d + diffToMon, 0, 0, 0, 0);
        const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999);
        const fmt = (dt) => dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        return { from, to, label: `${fmt(from)} – ${fmt(to)} ${from.getFullYear()}` };
    }
    if (period === "month") {
        const from = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const to = new Date(y, m, 0, 23, 59, 59, 999);
        return { from, to, label: from.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
    }
    const from = new Date(y, m - 1, d, 0, 0, 0, 0);
    const to = new Date(y, m - 1, d, 23, 59, 59, 999);
    return {
        from, to,
        label: from.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }),
    };
}
function aggregateLogs(logs) {
    const byStatus = {};
    for (const log of logs) {
        byStatus[log.status] = (byStatus[log.status] ?? 0) + 1;
    }
    return { total: logs.length, byStatus };
}
/* ================= CSR ACTIVITY REPORT ================= */
router.get("/activity-report", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const period = String(req.query.period ?? "day");
        const date = String(req.query.date ?? new Date().toISOString().split("T")[0]);
        if (!["day", "week", "month"].includes(period)) {
            return res.status(400).json({ success: false, message: "Invalid period. Use day, week, or month." });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD." });
        }
        const { from, to, label } = getActivityRange(period, date);
        const logs = await db_1.default.callLog.findMany({
            where: { csrId, createdAt: { gte: from, lte: to } },
            select: {
                id: true, status: true, createdAt: true,
                lead: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 200,
        });
        const { total, byStatus } = aggregateLogs(logs);
        const entries = logs.map(log => ({
            id: log.id,
            status: log.status,
            createdAt: log.createdAt,
            leadName: log.lead?.name ?? "Unknown",
        }));
        return res.json({ success: true, period, date, rangeLabel: label, total, byStatus, entries });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch activity report" });
    }
});
/* ================= CSR NOTIFICATIONS ================= */
router.get("/notifications", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const today = new Date().toISOString().split("T")[0];
        const [scheduledLeads, recentLogs] = await Promise.all([
            db_1.default.lead.findMany({
                where: {
                    assignedTo: csrId,
                    status: "important",
                    nextSchedule: { not: null },
                    nextTime: { not: null },
                    inBin: false,
                },
                select: { id: true, name: true, status: true, nextSchedule: true, nextTime: true, timezone: true },
                orderBy: [{ nextSchedule: "asc" }, { nextTime: "asc" }],
                take: 30,
            }),
            db_1.default.callLog.findMany({
                where: { csrId, createdAt: { gte: since } },
                select: { status: true },
            }),
        ]);
        const scheduledCalls = scheduledLeads
            .filter(l => (l.nextSchedule ?? "") >= today)
            .slice(0, 20)
            .map(l => ({
            id: l.id,
            client: l.name ?? "Client",
            date: l.nextSchedule,
            time: l.nextTime,
            timezone: l.timezone ?? "",
            status: l.status,
        }));
        const { total, byStatus } = aggregateLogs(recentLogs);
        return res.json({
            success: true,
            scheduledCalls,
            dailyStats: { total, byStatus, periodHours: 24 },
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }
});
/* ================= CSR DASHBOARD ================= */
/* ================= CSR DASHBOARD (legacy — stats only; use /tab-leads for lists) ================= */
router.get("/stats", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:stats:${csrId}`;
        const removed = await maybeHealPipelineLeaks(csrId);
        if (removed > 0)
            (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
        const cached = removed === 0 ? (0, cache_1.getCache)(cacheKey) : null;
        if (cached)
            return res.json(cached);
        const stats = await (0, csrDashboardQueries_1.getCsrLeadStats)(csrId);
        const payload = { success: true, stats };
        (0, cache_1.setCache)(cacheKey, payload, 30000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch stats" });
    }
});
router.get("/tab-leads", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const tab = String(req.query.tab ?? "pending");
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(500, Math.max(10, Number(req.query.pageSize) || 30));
        const from = typeof req.query.from === "string" ? req.query.from : undefined;
        const to = typeof req.query.to === "string" ? req.query.to : undefined;
        const validTabs = [
            "today", "pending", "important", "schedule", "interested", "projectwon",
            "notinterested", "notpicked", "noowner", "notinservice", "inhouse",
        ];
        if (!validTabs.includes(tab)) {
            return res.status(400).json({ success: false, message: "Invalid tab." });
        }
        let removed = 0;
        if (tab === "pending" || tab === "today") {
            removed = await maybeHealPipelineLeaks(csrId);
            if (removed > 0)
                (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
        }
        const cacheKey = `csr:tab:${csrId}:${tab}:${page}:${pageSize}:${from ?? ""}:${to ?? ""}`;
        const cached = removed === 0 ? (0, cache_1.getCache)(cacheKey) : null;
        if (cached)
            return res.json(cached);
        const result = await (0, csrDashboardQueries_1.fetchCsrTabLeads)({ csrId, tab, page, pageSize, from, to });
        const payload = { success: true, ...result };
        (0, cache_1.setCache)(cacheKey, payload, 20000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch tab leads" });
    }
});
router.get("/potential-leads", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:potential:${csrId}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const leads = await (0, csrDashboardQueries_1.fetchPotentialLeads)(csrId);
        const payload = { success: true, leads };
        (0, cache_1.setCache)(cacheKey, payload, 30000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch potential leads" });
    }
});
router.get("/dashboard", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:dashboard:${csrId}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const stats = await (0, csrDashboardQueries_1.getCsrLeadStats)(csrId);
        const rawLeads = await db_1.default.lead.findMany({
            where: {
                ...(0, binLeads_1.activeCsrLeadWhere)(csrId),
                status: {
                    in: ["no owner available", "not in service", "in house"],
                    mode: "insensitive",
                },
            },
            select: {
                ...csrLeadSelect_1.CSR_DASHBOARD_LEAD_SELECT,
                notes: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: { id: true, text: true, createdAt: true },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        const leads = (0, binLeads_1.filterActiveLeads)(rawLeads).map(csrDashboardQueries_1.mapDashboardLead);
        const payload = { success: true, totalLeads: stats.totalAssigned, stats, leads };
        (0, cache_1.setCache)(cacheKey, payload, 45000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch dashboard" });
    }
});
/* ================= NOT-INTERESTED / NOT-PICKED LEADS ================= */
router.get("/not-interested", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:not-interested:${csrId}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const rawLeads = await db_1.default.lead.findMany({
            where: (0, binLeads_1.buildActiveRetryWhere)(csrId),
            select: {
                ...csrLeadSelect_1.CSR_DASHBOARD_LEAD_SELECT,
                notes: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                    select: { id: true, text: true, createdAt: true },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        const leads = (0, binLeads_1.filterActiveLeads)(rawLeads);
        const payload = { success: true, leads };
        (0, cache_1.setCache)(cacheKey, payload, 30000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch leads" });
    }
});
/* ================= LOOKUP CLIENT BY PHONE ================= */
router.get("/lookup-by-phone", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const phone = req.query.phone?.trim();
        if (!phone || (0, phone_1.normalizePhone)(phone).length < 7) {
            return res.json({ success: true, found: false });
        }
        const matches = await (0, leadPhoneLookup_1.findLeadsByPhone)(phone);
        if (matches.length === 0) {
            return res.json({ success: true, found: false });
        }
        return res.json((0, leadPhoneLookup_1.buildPhoneLookupResponse)(matches));
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to lookup client" });
    }
});
/* ================= ADD PROJECT MANUALLY ================= */
router.post("/project", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const { name, company, phone, projectTitle, projectCode, interestedService, projectDeadline, projectBudget, projectNotes, status, } = req.body;
        /* Validate required fields */
        if (!name || !projectTitle || !interestedService || !projectDeadline) {
            return res.status(400).json({
                success: false,
                message: "name, projectTitle, interestedService and projectDeadline are required.",
            });
        }
        const trimmedPhone = phone?.trim() || null;
        const isOldClient = trimmedPhone || company?.trim()
            ? await (0, leadClientPromotion_1.hasPriorWonClient)(trimmedPhone, company?.trim() ?? null)
            : false;
        const lead = await db_1.default.lead.create({
            data: {
                name,
                company: company ?? null,
                phone: trimmedPhone,
                status: status ?? "Close Client",
                projectTitle,
                projectCode: projectCode ?? null,
                interestedService,
                projectDeadline,
                projectBudget: projectBudget ?? null,
                projectNotes: projectNotes ?? null,
                assignedTo: csrId,
                important: false,
                interested: false,
                isOldClient,
                hiddenOnMain: true,
            },
        });
        if (trimmedPhone) {
            await (0, leadClientPromotion_1.clearPendingDuplicatesForPhone)(trimmedPhone, csrId, lead.id);
        }
        if (company?.trim()) {
            await (0, leadClientPromotion_1.clearPendingDuplicatesForCompany)(company.trim(), csrId, lead.id);
        }
        await (0, leadClientPromotion_1.reconcileClientOldFlagsForCsr)(csrId);
        (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
        (0, cache_1.flushAdminClientsCache)();
        return res.status(201).json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to create project" });
    }
});
/* ================= GET SINGLE LEAD (full data — lazy load for notes/subContacts) ================= */
router.get("/lead/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const lead = await db_1.default.lead.findFirst({
            where: { id: leadId, assignedTo: csrId },
            include: {
                uploadFile: { select: { companyName: true } },
                notes: { orderBy: { createdAt: "desc" } },
                subContacts: { orderBy: { createdAt: "asc" } },
            },
        });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        return res.json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch lead" });
    }
});
/* ================= UPDATE LEAD NOTE (legacy inline) ================= */
router.patch("/lead/:id/note", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const { comments } = req.body;
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        await db_1.default.lead.update({ where: { id: leadId }, data: { comments: comments ?? "" } });
        (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
        (0, cache_1.flushAdminClientsCache)();
        return res.json({ success: true });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to save note" });
    }
});
/* ================= ADD TIMESTAMPED NOTE ================= */
router.post("/lead/:id/notes", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const { text } = req.body;
        if (!text?.trim())
            return res.status(400).json({ success: false, message: "Note text required" });
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        const note = await db_1.default.leadNote.create({ data: { text: text.trim(), leadId } });
        (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
        (0, cache_1.flushAdminClientsCache)();
        return res.json({ success: true, note });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to add note" });
    }
});
/* ================= UPDATE NOTE ================= */
router.put("/lead/:id/notes/:noteId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const { noteId } = req.params;
        const { text } = req.body;
        if (!text?.trim())
            return res.status(400).json({ success: false, message: "Note text required" });
        const note = await db_1.default.leadNote.findFirst({ where: { id: noteId, lead: { assignedTo: csrId } } });
        if (!note)
            return res.status(404).json({ success: false, message: "Note not found" });
        const updated = await db_1.default.leadNote.update({ where: { id: noteId }, data: { text: text.trim() } });
        (0, cache_1.invalidateCache)(`csr:leads:${csrId}`, `csr:not-interested:${csrId}`);
        (0, cache_1.flushAdminClientsCache)();
        return res.json({ success: true, note: updated });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to update note" });
    }
});
/* ================= DELETE NOTE ================= */
router.delete("/lead/:id/notes/:noteId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const { noteId } = req.params;
        const note = await db_1.default.leadNote.findFirst({ where: { id: noteId, lead: { assignedTo: csrId } } });
        if (!note)
            return res.status(404).json({ success: false, message: "Note not found" });
        await db_1.default.leadNote.delete({ where: { id: noteId } });
        (0, cache_1.invalidateCache)(`csr:leads:${csrId}`, `csr:not-interested:${csrId}`);
        (0, cache_1.flushAdminClientsCache)();
        return res.json({ success: true });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to delete note" });
    }
});
/* ================= UPDATE LEAD ================= */
router.put("/lead/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const { status, nextSchedule, nextTime, timezone, followUpNotes, interestedService, projectTitle, projectCode, projectDeadline, projectBudget, projectNotes, paidAmount, comments, name, phone, email, state, moveToBin, inBin, } = req.body;
        /* Fetch current lead to get existing counts */
        const lead = await db_1.default.lead.findFirst({
            where: { id: leadId, assignedTo: csrId },
        });
        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        if (moveToBin === true) {
            const reason = (0, binLeads_1.resolveDeleteBinReason)(lead.status);
            const updated = await db_1.default.lead.update({
                where: { id: leadId },
                data: {
                    inBin: true,
                    binReason: reason,
                    binPreviousStatus: lead.status,
                    important: false,
                    interested: false,
                    status: "pending",
                },
            });
            (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
            return res.json({ success: true, lead: updated, movedToBin: true });
        }
        if (inBin === false) {
            const restoreStatus = lead.binPreviousStatus || "pending";
            const updated = await db_1.default.lead.update({
                where: { id: leadId },
                data: {
                    inBin: false,
                    binReason: null,
                    binPreviousStatus: null,
                    status: restoreStatus,
                    important: restoreStatus === "important",
                    interested: restoreStatus === "interested",
                    notPickedCount: 0,
                    notInterestedCount: 0,
                },
            });
            (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
            return res.json({ success: true, lead: updated, restored: true });
        }
        /* Build base update object */
        const updateData = {};
        if (nextSchedule !== undefined)
            updateData.nextSchedule = nextSchedule;
        if (nextTime !== undefined)
            updateData.nextTime = nextTime;
        if (timezone !== undefined)
            updateData.timezone = timezone;
        if (followUpNotes !== undefined)
            updateData.followUpNotes = followUpNotes;
        if (interestedService !== undefined)
            updateData.interestedService = interestedService;
        if (projectTitle !== undefined)
            updateData.projectTitle = projectTitle;
        if (projectCode !== undefined)
            updateData.projectCode = projectCode;
        if (projectDeadline !== undefined)
            updateData.projectDeadline = projectDeadline;
        if (projectBudget !== undefined)
            updateData.projectBudget = projectBudget;
        if (projectNotes !== undefined)
            updateData.projectNotes = projectNotes;
        if (paidAmount !== undefined)
            updateData.paidAmount = paidAmount;
        if (comments !== undefined)
            updateData.comments = comments;
        if (name !== undefined)
            updateData.name = name;
        if (phone !== undefined)
            updateData.phone = phone;
        if (email !== undefined)
            updateData.email = email;
        if (state !== undefined)
            updateData.state = state;
        if (req.body.ownerName !== undefined)
            updateData.ownerName = req.body.ownerName;
        if (req.body.projectScope !== undefined)
            updateData.projectScope = req.body.projectScope;
        if (req.body.projectPhase !== undefined)
            updateData.projectPhase = req.body.projectPhase;
        if (req.body.takeoffDeadline !== undefined)
            updateData.takeoffDeadline = req.body.takeoffDeadline;
        if (req.body.pricingDeadline !== undefined)
            updateData.pricingDeadline = req.body.pricingDeadline;
        if (req.body.qaDeadline !== undefined)
            updateData.qaDeadline = req.body.qaDeadline;
        if (req.body.company !== undefined)
            updateData.company = req.body.company;
        const payments = (0, projectPayments_1.normalizePaymentsInput)(req.body.projectPayments);
        if (payments !== undefined) {
            updateData.projectPayments = payments;
            updateData.paidAmount = String((0, projectPayments_1.paidTotalFromEntries)((0, projectPayments_1.parseProjectPayments)(payments)));
        }
        /* ── STATUS HANDLING ── */
        if (status !== undefined) {
            updateData.status = status;
            /* ── NOT INTERESTED (limit = 3) ── */
            if (status === "Not Interested") {
                const newCount = (lead.notInterestedCount ?? 0) + 1;
                updateData.notInterestedCount = newCount;
                updateData.important = false;
                updateData.interested = false;
                const ts = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
                const tag = newCount >= binLeads_1.NOT_INTERESTED_LIMIT ? " — LIMIT REACHED" : "";
                const entry = `[Try ${newCount}/${binLeads_1.NOT_INTERESTED_LIMIT} · ${ts}] Not Interested${tag}`;
                updateData.followUpNotes = [lead.followUpNotes, entry].filter(Boolean).join("\n");
                if (newCount >= binLeads_1.NOT_INTERESTED_LIMIT) {
                    updateData.inBin = true;
                    updateData.binReason = "limit-not-interested";
                }
                await db_1.default.lead.update({ where: { id: leadId }, data: updateData });
                await logStatusChange(csrId, leadId, status);
                (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
                if (newCount >= binLeads_1.NOT_INTERESTED_LIMIT) {
                    const otherCsrs = await db_1.default.user.findMany({
                        where: { id: { not: csrId }, role: "csr", isActive: true },
                        select: { id: true, name: true, csrCode: true },
                        orderBy: { csrCode: "asc" },
                    });
                    return res.json({
                        success: true,
                        needsManualAssign: true,
                        csrs: otherCsrs,
                        message: "Limit reached. Select a CSR to reassign this lead.",
                    });
                }
                return res.json({
                    success: true,
                    lead: await db_1.default.lead.findUnique({ where: { id: leadId } }),
                    triesLeft: binLeads_1.NOT_INTERESTED_LIMIT - newCount,
                });
            }
            /* ── NOT PICKED (limit = 7) ── */
            if (status === "not picked" || status === "not completed") {
                const newCount = (lead.notPickedCount ?? 0) + 1;
                updateData.notPickedCount = newCount;
                updateData.important = false;
                updateData.interested = false;
                const ts = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
                const tag = newCount >= binLeads_1.NOT_PICKED_LIMIT ? " — LIMIT REACHED" : "";
                const entry = `[Try ${newCount}/${binLeads_1.NOT_PICKED_LIMIT} · ${ts}] Not Picked${tag}`;
                updateData.followUpNotes = [lead.followUpNotes, entry].filter(Boolean).join("\n");
                if (newCount >= binLeads_1.NOT_PICKED_LIMIT) {
                    updateData.inBin = true;
                    updateData.binReason = "limit-not-picked";
                }
                await db_1.default.lead.update({ where: { id: leadId }, data: updateData });
                await logStatusChange(csrId, leadId, status);
                (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
                if (newCount >= binLeads_1.NOT_PICKED_LIMIT) {
                    const otherCsrs = await db_1.default.user.findMany({
                        where: { id: { not: csrId }, role: "csr", isActive: true },
                        select: { id: true, name: true, csrCode: true },
                        orderBy: { csrCode: "asc" },
                    });
                    return res.json({
                        success: true,
                        needsManualAssign: true,
                        csrs: otherCsrs,
                        message: "Limit reached. Select a CSR to reassign this lead.",
                    });
                }
                return res.json({
                    success: true,
                    lead: await db_1.default.lead.findUnique({ where: { id: leadId } }),
                    triesLeft: binLeads_1.NOT_PICKED_LIMIT - newCount,
                });
            }
            /* ── IMPORTANT ── */
            if (status === "important") {
                updateData.important = true;
                updateData.interested = false;
                /* Direct "Important" (not Schedule Call) → important-only bucket for admin */
                if (nextSchedule === undefined && nextTime === undefined) {
                    updateData.nextSchedule = null;
                    updateData.nextTime = null;
                }
            }
            /* ── INTERESTED ── */
            if (status === "interested") {
                updateData.important = false;
                updateData.interested = true;
            }
            /* ── OTHER (pending, Close Client, etc.) ── */
            if (["pending", "Close Client", "completed"].includes(status)) {
                updateData.important = false;
                updateData.interested = false;
            }
            /* ── AUTO isOldClient when Close Client ── */
            if (status === "Close Client" || status === "completed") {
                updateData.hiddenOnMain = true;
                updateData.isOldClient = await (0, leadClientPromotion_1.hasPriorWonClient)(lead.phone, lead.company, leadId);
                /* ── AUTO clientCode: {csrCode}-{padded_seq} ── */
                if (!lead.clientCode) {
                    const csr = await db_1.default.user.findUnique({
                        where: { id: csrId },
                        select: { csrCode: true },
                    });
                    if (csr?.csrCode) {
                        const wonCount = await db_1.default.lead.count({
                            where: {
                                assignedTo: csrId,
                                status: { in: ["Close Client", "completed"] },
                                clientCode: { not: null },
                            },
                        });
                        const seq = String(wonCount + 1).padStart(2, "0");
                        updateData.clientCode = `${csr.csrCode}-${seq}`;
                    }
                }
            }
        }
        const updatedLead = await db_1.default.lead.update({
            where: { id: leadId },
            data: updateData,
        });
        if (status !== undefined &&
            (status === "Close Client" || status === "completed")) {
            if (lead.phone) {
                await (0, leadClientPromotion_1.clearPendingDuplicatesForPhone)(lead.phone, csrId, leadId);
            }
            if (lead.company) {
                await (0, leadClientPromotion_1.clearPendingDuplicatesForCompany)(lead.company, csrId, leadId);
            }
            await (0, leadClientPromotion_1.reconcileClientOldFlagsForCsr)(csrId);
        }
        if (status !== undefined && status !== lead.status) {
            await logStatusChange(csrId, leadId, status);
        }
        (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
        return res.json({ success: true, lead: updatedLead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to update lead" });
    }
});
/* ================= CREATE LEAD (CSR manual add) ================= */
router.post("/lead", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const { name, phone, company, email, state, interestedService, comments, projectBudget, paidAmount } = req.body;
        if (!name?.trim()) {
            return res.status(400).json({ success: false, message: "Client name is required." });
        }
        const trimmedPhone = phone?.trim() || null;
        const companyTrim = company?.trim() || null;
        const asWonClient = !!req.body.asWonClient || req.body.status === "Close Client";
        if (asWonClient && trimmedPhone) {
            const existingLeads = await (0, leadPhoneLookup_1.findLeadsByPhone)(trimmedPhone);
            const pendingDup = existingLeads.find(l => l.assignedTo === csrId &&
                (0, leadClientPromotion_1.isPendingPipelineStatus)(l.status) &&
                !l.inBin);
            if (pendingDup) {
                const isOldClient = await (0, leadClientPromotion_1.hasPriorWonClient)(trimmedPhone, companyTrim, pendingDup.id);
                const lead = await db_1.default.lead.update({
                    where: { id: pendingDup.id },
                    data: {
                        name: name.trim(),
                        phone: trimmedPhone,
                        email: email?.trim()?.toLowerCase() || null,
                        state: state?.trim() || null,
                        company: companyTrim || null,
                        interestedService: interestedService?.trim() || null,
                        comments: comments?.trim() || null,
                        projectBudget: projectBudget?.trim() || null,
                        paidAmount: paidAmount?.trim() || null,
                        status: "Close Client",
                        assignedTo: csrId,
                        important: false,
                        interested: false,
                        isOldClient,
                        hiddenOnMain: true,
                    },
                });
                await (0, leadClientPromotion_1.clearPendingDuplicatesForPhone)(trimmedPhone, csrId, lead.id);
                if (companyTrim) {
                    await (0, leadClientPromotion_1.clearPendingDuplicatesForCompany)(companyTrim, csrId, lead.id);
                }
                await (0, leadClientPromotion_1.reconcileClientOldFlagsForCsr)(csrId);
                (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
                (0, cache_1.flushAdminClientsCache)();
                return res.status(200).json({ success: true, lead, promoted: true });
            }
        }
        const isOldClient = asWonClient
            ? await (0, leadClientPromotion_1.hasPriorWonClient)(trimmedPhone, companyTrim)
            : false;
        const lead = await db_1.default.lead.create({
            data: {
                name: name.trim(),
                phone: trimmedPhone,
                email: email?.trim()?.toLowerCase() || null,
                state: state?.trim() || null,
                company: company?.trim() || null,
                interestedService: interestedService?.trim() || null,
                comments: comments?.trim() || null,
                projectBudget: projectBudget?.trim() || null,
                paidAmount: paidAmount?.trim() || null,
                status: asWonClient ? "Close Client" : "pending",
                assignedTo: csrId,
                important: false,
                interested: false,
                isOldClient,
                hiddenOnMain: asWonClient,
            },
        });
        if (asWonClient && trimmedPhone) {
            await (0, leadClientPromotion_1.clearPendingDuplicatesForPhone)(trimmedPhone, csrId, lead.id);
        }
        if (asWonClient && companyTrim) {
            await (0, leadClientPromotion_1.clearPendingDuplicatesForCompany)(companyTrim, csrId, lead.id);
        }
        await (0, leadClientPromotion_1.reconcileClientOldFlagsForCsr)(csrId);
        (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
        (0, cache_1.flushAdminClientsCache)();
        return res.status(201).json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to create lead" });
    }
});
/* ================= CSR CLIENTS (won deals — new vs old) ================= */
router.get("/clients", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:clients:${csrId}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const rawLeads = await db_1.default.lead.findMany({
            where: {
                ...(0, binLeads_1.activeCsrLeadWhere)(csrId),
                ...(0, projectLeads_1.wonClientStatusWhere)(),
            },
            select: csrLeadSelect_1.CSR_CLIENT_LIST_SELECT,
            orderBy: { createdAt: "desc" },
        });
        const leads = rawLeads.map(lead => ({
            ...lead,
            isOldClient: lead.isOldClient,
        }));
        const activeWhere = (0, binLeads_1.activeCsrLeadWhere)(csrId);
        const [importantCount, interestedCount, pendingCount, totalAssigned] = await Promise.all([
            db_1.default.lead.count({ where: { ...activeWhere, ...(0, adminClientQueries_1.isImportantStatusWhere)() } }),
            db_1.default.lead.count({ where: { ...activeWhere, ...(0, adminClientQueries_1.isInterestedStatusWhere)() } }),
            db_1.default.lead.count({ where: (0, binLeads_1.pendingLeadWhere)(csrId) }),
            db_1.default.lead.count({ where: activeWhere }),
        ]);
        const payload = {
            success: true,
            leads,
            stats: { importantCount, interestedCount, pendingCount, totalAssigned },
        };
        (0, cache_1.setCache)(cacheKey, payload, 45000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch clients" });
    }
});
/* ================= CSR LEADS (new vs returning) ================= */
router.get("/leads", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:leads:${csrId}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const rawLeads = await db_1.default.lead.findMany({
            where: { assignedTo: csrId },
            include: { uploadFile: { select: uploadSourceSelect_1.CSR_UPLOAD_FILE_SELECT }, notes: { orderBy: { createdAt: "asc" } }, subContacts: { orderBy: { createdAt: "asc" } } },
            orderBy: { createdAt: "desc" },
        });
        const csrLeads = (0, binLeads_1.filterActiveLeads)(rawLeads);
        const leads = csrLeads.map(lead => ({
            ...lead,
            isOldClient: lead.isOldClient,
        }));
        const payload = { success: true, leads };
        (0, cache_1.setCache)(cacheKey, payload, 30000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch leads" });
    }
});
/* ================= CSR PROJECTS ================= */
router.get("/projects", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:projects:${csrId}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const rawLeads = await db_1.default.lead.findMany({
            where: (0, projectLeads_1.buildProjectLeadWhere)(csrId),
            select: {
                ...csrLeadSelect_1.CSR_DASHBOARD_LEAD_SELECT,
                projectTitle: true,
                projectCode: true,
                projectDeadline: true,
                projectBudget: true,
                projectNotes: true,
                clientCode: true,
                isOldClient: true,
                projectPayments: true,
                notes: csrLeadSelect_1.CSR_LIST_NOTES_SELECT,
            },
            orderBy: { updatedAt: "desc" },
        });
        const leads = rawLeads.filter(projectLeads_1.isDisplayableProjectLead);
        const payload = { success: true, leads };
        (0, cache_1.setCache)(cacheKey, payload, 30000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch projects" });
    }
});
/* ================= LIST OTHER ACTIVE CSRs (for manual assign popup) ================= */
router.get("/csrs", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const csrs = await db_1.default.user.findMany({
            where: { id: { not: csrId }, role: "csr", isActive: true },
            select: { id: true, name: true, csrCode: true },
            orderBy: { csrCode: "asc" },
        });
        return res.json({ success: true, csrs });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to fetch CSRs" });
    }
});
/* ================= MANUALLY ASSIGN LEAD TO SPECIFIC CSR ================= */
router.put("/lead/:id/assign", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const { csrId: targetCsrId } = req.body;
        if (!targetCsrId) {
            return res.status(400).json({ success: false, message: "Target CSR ID is required" });
        }
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        const targetCsr = await db_1.default.user.findFirst({
            where: { id: targetCsrId, role: "csr", isActive: true },
        });
        if (!targetCsr)
            return res.status(404).json({ success: false, message: "Target CSR not found" });
        await db_1.default.lead.update({
            where: { id: leadId },
            data: {
                assignedTo: targetCsrId,
                status: "pending",
                notInterestedCount: 0,
                notPickedCount: 0,
                important: false,
                interested: false,
                inBin: false,
                binReason: null,
                binPreviousStatus: null,
            },
        });
        (0, csrCache_1.invalidateCsrLeadCaches)(csrId, `csr:dashboard:${targetCsrId}`, `csr:leads:${targetCsrId}`, `csr:bin:${targetCsrId}`);
        return res.json({ success: true, message: `Lead assigned to ${targetCsr.name}` });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to assign lead" });
    }
});
/* ================= CSR BIN (not-picked leads) ================= */
router.get("/bin", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:bin:${csrId}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const rawLeads = await db_1.default.lead.findMany({
            where: (0, binLeads_1.buildBinWhere)(csrId),
            select: {
                ...csrLeadSelect_1.CSR_DASHBOARD_LEAD_SELECT,
                binReason: true,
                binPreviousStatus: true,
                notes: csrLeadSelect_1.CSR_LIST_NOTES_SELECT,
            },
            orderBy: { updatedAt: "desc" },
        });
        const leads = rawLeads;
        const payload = { success: true, leads };
        (0, cache_1.setCache)(cacheKey, payload, 30000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch bin" });
    }
});
/* ================= SUB-CONTACTS ================= */
router.post("/lead/:id/subcontacts", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const { name, designation, phone, email } = req.body;
        if (!name?.trim())
            return res.status(400).json({ success: false, message: "Name is required" });
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        const subContact = await db_1.default.subContact.create({
            data: { leadId, name: name.trim(), designation: designation?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null },
        });
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
        return res.status(201).json({ success: true, subContact });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to add sub-contact" });
    }
});
router.put("/lead/:id/subcontacts/:subId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const subId = req.params.subId;
        const { name, designation, phone, email } = req.body;
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        const existing = await db_1.default.subContact.findFirst({ where: { id: subId, leadId } });
        if (!existing)
            return res.status(404).json({ success: false, message: "Sub-contact not found" });
        const subContact = await db_1.default.subContact.update({
            where: { id: subId },
            data: {
                ...(name !== undefined ? { name: name.trim() } : {}),
                ...(designation !== undefined ? { designation: designation?.trim() || null } : {}),
                ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
                ...(email !== undefined ? { email: email?.trim() || null } : {}),
            },
        });
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
        return res.json({ success: true, subContact });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to update sub-contact" });
    }
});
router.delete("/lead/:id/subcontacts/:subId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const subId = req.params.subId;
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        await db_1.default.subContact.delete({ where: { id: subId } });
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
        return res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to delete sub-contact" });
    }
});
/* ================= HEARTBEAT ================= */
router.post("/heartbeat", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const userId = req.user.id;
        const userAgent = req.body.userAgent ?? req.headers["user-agent"] ?? "";
        const tabId = req.body.tabId ?? "unknown";
        const openedAt = req.body.openedAt ?? new Date().toISOString();
        const tabVisible = req.body.tabVisible !== false;
        const hiddenAt = req.body.hiddenAt ?? null;
        const existing = sessions_1.userBrowserMap.get(userId);
        sessions_1.userBrowserMap.set(userId, {
            browser: (0, sessions_1.detectBrowser)(userAgent),
            tabId,
            openedAt,
            tabVisible,
            hiddenAt: tabVisible
                ? null
                : (existing?.hiddenAt ?? hiddenAt ?? new Date().toISOString()),
        });
        const now = Date.now();
        const lastWrite = existing?.lastDbWrite ?? 0;
        const shouldWriteDb = tabVisible && now - lastWrite >= 30000;
        if (shouldWriteDb) {
            await db_1.default.user.update({
                where: { id: userId },
                data: { isOnline: true, lastActive: new Date() },
            });
            const entry = sessions_1.userBrowserMap.get(userId);
            entry.lastDbWrite = now;
        }
        void (0, accessHistory_1.recordHeartbeatAccess)({
            userId,
            ip: (0, requestMeta_1.getClientIp)(req),
            userAgent: userAgent,
            deviceId: tabId,
        });
        return res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false });
    }
});
/* ================= OFFLINE ================= */
router.post("/offline", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        sessions_1.userBrowserMap.delete(req.user.id);
        await db_1.default.user.update({
            where: { id: req.user.id },
            data: { isOnline: false },
        });
        return res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false });
    }
});
exports.default = router;
