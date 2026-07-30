"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../config/db"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const cache_1 = require("../utils/cache");
const chatSocket_1 = require("../chat/chatSocket");
const csrCache_1 = require("../utils/csrCache");
const purgeCsrLeads_1 = require("../utils/purgeCsrLeads");
const csrResetPages_1 = require("../utils/csrResetPages");
const uploadSourceStats_1 = require("../utils/uploadSourceStats");
const projectLeads_1 = require("../utils/projectLeads");
const projectPayments_1 = require("../utils/projectPayments");
const binLeads_1 = require("../utils/binLeads");
const leadPhoneLookup_1 = require("../utils/leadPhoneLookup");
const leadDuplicateCheck_1 = require("../utils/leadDuplicateCheck");
const uploadSourceSelect_1 = require("../utils/uploadSourceSelect");
const phone_1 = require("../utils/phone");
const adminClientQueries_1 = require("../utils/adminClientQueries");
const adminIp_middleware_1 = require("../middleware/adminIp.middleware");
const csrSessionTracking_1 = require("../utils/csrSessionTracking");
const estTime_1 = require("../utils/estTime");
const deleteLeadsCascade_1 = require("../utils/deleteLeadsCascade");
const adminSummaryStats_1 = require("../utils/adminSummaryStats");
const router = express_1.default.Router();
router.use(adminIp_middleware_1.enforceAdminIpAllowlist);
function applyProjectPayload(updateData, body) {
    const scalars = [
        "name", "company", "phone", "email", "state", "ownerName",
        "projectCode", "projectTitle", "projectScope", "interestedService",
        "projectBudget", "projectDeadline", "projectNotes", "projectPhase",
        "takeoffDeadline", "pricingDeadline", "qaDeadline", "projectSource",
    ];
    for (const key of scalars) {
        if (body[key] !== undefined)
            updateData[key] = body[key];
    }
    const payments = (0, projectPayments_1.normalizePaymentsInput)(body.projectPayments);
    if (payments !== undefined) {
        updateData.projectPayments = payments;
        updateData.paidAmount = String((0, projectPayments_1.paidTotalFromEntries)((0, projectPayments_1.parseProjectPayments)(payments)));
    }
    else if (body.paidAmount !== undefined) {
        updateData.paidAmount = body.paidAmount;
    }
}
/* ================= ADMIN DASHBOARD ================= */
router.get("/dashboard", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), (req, res) => {
    res.json({ success: true, message: "Welcome Admin" });
});
/* ================= ADMIN MEETING NOTIFICATIONS (scheduled calls) ================= */
router.get("/notifications", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const today = new Date().toISOString().split("T")[0];
        const csrId = typeof req.query.csrId === "string" ? req.query.csrId : undefined;
        const cacheKey = `admin:notifications:${csrId ?? "all"}:${today}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const rawScheduled = await db_1.default.lead.findMany({
            where: {
                ...(csrId ? { assignedTo: csrId } : {}),
                status: "important",
                nextSchedule: { gte: today, not: null },
                nextTime: { not: null },
            },
            select: {
                id: true,
                name: true,
                status: true,
                notPickedCount: true,
                notInterestedCount: true,
                nextSchedule: true,
                nextTime: true,
                timezone: true,
                csr: { select: { id: true, name: true, csrCode: true } },
            },
            orderBy: [{ nextSchedule: "asc" }, { nextTime: "asc" }],
            take: 50,
        });
        const scheduledLeads = (0, binLeads_1.filterActiveLeads)(rawScheduled);
        const scheduledCalls = scheduledLeads
            .slice(0, 30)
            .map((l) => ({
            id: l.id,
            client: l.name ?? "Client",
            date: l.nextSchedule,
            time: l.nextTime,
            timezone: l.timezone ?? "",
            csrName: l.csr?.name ?? "",
            csrCode: l.csr?.csrCode ?? "",
            csrId: l.csr?.id ?? "",
        }));
        const payload = { success: true, scheduledCalls };
        (0, cache_1.setCache)(cacheKey, payload, 60000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }
});
/* ================= GET ALL CSRS ================= */
router.get("/csrs", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const CACHE_KEY = "admin:csrs";
        const cached = (0, cache_1.getCache)(CACHE_KEY);
        if (cached)
            return res.json(cached);
        const csrs = await db_1.default.user.findMany({
            where: { role: "csr" },
            select: {
                id: true,
                name: true,
                email: true,
                csrCode: true,
                isActive: true,
                isOnline: true,
                lastActive: true,
                createdAt: true,
                _count: { select: { leads: true } },
            },
            orderBy: { csrCode: "asc" },
        });
        const payload = { success: true, csrs };
        (0, cache_1.setCache)(CACHE_KEY, payload, 15000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch CSRs" });
    }
});
/* ================= CLIENT TAB COUNTS (leads page — lightweight) ================= */
router.get("/clients/tab-counts", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (_req, res) => {
    try {
        const CACHE_KEY = "admin:clients:tab-counts";
        const cached = (0, cache_1.getCache)(CACHE_KEY);
        if (cached)
            return res.json(cached);
        const payload = await (0, adminSummaryStats_1.buildAdminTabCountsPayload)();
        (0, cache_1.setCache)(CACHE_KEY, payload, 60000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch tab counts" });
    }
});
/* ================= CLIENT SUMMARY (fast — dashboard tiles & charts) ================= */
router.get("/clients/summary", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (_req, res) => {
    try {
        const CACHE_KEY = "admin:clients:summary";
        const cached = (0, cache_1.getCache)(CACHE_KEY);
        if (cached)
            return res.json(cached);
        const payload = await (0, adminSummaryStats_1.buildAdminClientSummaryPayload)();
        (0, cache_1.setCache)(CACHE_KEY, payload, 180000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch client summary" });
    }
});
/* ================= GET CLIENTS / LEADS (paginated — admin leads page) ================= */
router.get("/clients", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const view = String(req.query.view || "all");
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
        const csrName = req.query.csr ? String(req.query.csr) : undefined;
        const search = req.query.search ? String(req.query.search) : undefined;
        const scheduleDate = req.query.scheduleDate ? String(req.query.scheduleDate) : undefined;
        const cacheKey = `admin:clients:list:${view}:${page}:${limit}:${csrName ?? "all"}:${search ?? ""}:${scheduleDate ?? ""}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const where = (0, adminClientQueries_1.buildAdminClientListWhere)(view, csrName, search, scheduleDate);
        // Fetch more than limit so we can deduplicate by phone before slicing the page
        const FETCH_FACTOR = 4;
        const rawLeads = await db_1.default.lead.findMany({
            where,
            select: adminClientQueries_1.ADMIN_LEAD_LIST_SELECT,
            orderBy: { updatedAt: "desc" },
            // Fetch enough rows to fill the requested page after dedup
            skip: 0,
            take: limit * FETCH_FACTOR * (page + 1),
        });
        // Deduplicate: for each phone keep only the most-recently-updated lead
        const seenPhones = new Set();
        const dedupedLeads = [];
        for (const lead of rawLeads) {
            const phone = lead.phone?.trim() || "";
            const key = phone || lead.id; // if no phone, treat as unique
            if (seenPhones.has(key))
                continue;
            seenPhones.add(key);
            dedupedLeads.push(lead);
        }
        const total = dedupedLeads.length;
        const leads = dedupedLeads.slice((page - 1) * limit, page * limit);
        const payload = {
            success: true,
            leads,
            total,
            page,
            limit,
            stats: {
                totalClients: total,
                activeClients: view === "all"
                    ? await db_1.default.lead.count({ where: { status: "pending" } })
                    : undefined,
            },
        };
        (0, cache_1.setCache)(cacheKey, payload, 60000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch clients" });
    }
});
/* ================= CREATE LEAD (ADMIN manual add) ================= */
router.post("/lead", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const adminId = req.user?.id;
        if (!adminId)
            return res.status(401).json({ success: false, message: "Unauthorized" });
        const { name, email, phone, company, status, csrId } = req.body;
        if (!name?.trim())
            return res.status(400).json({ success: false, message: "Client name is required." });
        if (!email?.trim())
            return res.status(400).json({ success: false, message: "Email is required." });
        const dup = await (0, leadDuplicateCheck_1.findDuplicateLead)(phone, email);
        if (dup)
            return res.status(409).json({ success: false, message: dup.message, field: dup.field });
        let assignTo = adminId;
        if (csrId) {
            const csr = await db_1.default.user.findFirst({ where: { id: csrId, role: "csr", isActive: true } });
            if (!csr)
                return res.status(400).json({ success: false, message: "Invalid CSR." });
            assignTo = csr.id;
        }
        const trimmedPhone = phone?.trim() || null;
        const existingLeads = trimmedPhone ? await (0, leadPhoneLookup_1.findLeadsByPhone)(trimmedPhone) : [];
        const lead = await db_1.default.lead.create({
            data: {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                phone: trimmedPhone,
                company: company?.trim() || null,
                status: status || "pending",
                assignedTo: assignTo,
                important: false,
                interested: false,
                isOldClient: existingLeads.length > 0,
            },
            include: { csr: { select: { id: true, name: true, csrCode: true } } },
        });
        (0, cache_1.flushAdminClientsCache)();
        if (assignTo !== adminId) {
            (0, cache_1.invalidateCache)(`csr:dashboard:${assignTo}`, `csr:leads:${assignTo}`);
        }
        return res.status(201).json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to create lead" });
    }
});
/* ================= GET SINGLE LEAD (ADMIN) ================= */
router.get("/lead/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const lead = await db_1.default.lead.findFirst({
            where: { id: leadId },
            include: {
                uploadFile: { select: { companyName: true } },
                notes: { orderBy: { createdAt: "asc" } },
                subContacts: { orderBy: { createdAt: "asc" } },
                csr: { select: { id: true, name: true, csrCode: true } },
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
/* ================= DELETE LEAD / PROJECT (ADMIN) ================= */
router.delete("/lead/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const lead = await db_1.default.lead.findFirst({
            where: { id: leadId },
            select: { id: true, assignedTo: true, name: true },
        });
        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found" });
        }
        const deleted = await (0, deleteLeadsCascade_1.deleteLeadsCascade)([leadId]);
        await (0, deleteLeadsCascade_1.invalidateAllLeadCaches)(lead.assignedTo ? [lead.assignedTo] : undefined);
        return res.json({
            success: true,
            message: `"${lead.name ?? "Record"}" deleted permanently`,
            deleted,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to delete lead" });
    }
});
/* ================= UPDATE LEAD DETAILS (ADMIN) ================= */
router.put("/lead/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const { name, phone, email, state, company, website } = req.body;
        const existing = await db_1.default.lead.findFirst({ where: { id: leadId } });
        if (!existing)
            return res.status(404).json({ success: false, message: "Lead not found" });
        const updateData = {};
        if (name !== undefined)
            updateData.name = name;
        if (phone !== undefined)
            updateData.phone = phone;
        if (email !== undefined)
            updateData.email = email;
        if (state !== undefined)
            updateData.state = state;
        if (company !== undefined)
            updateData.company = company;
        if (website !== undefined)
            updateData.website = String(website ?? "").trim() || null;
        const dup = await (0, leadDuplicateCheck_1.findDuplicateLead)(phone !== undefined ? String(phone) : existing.phone, email !== undefined ? String(email) : existing.email, leadId);
        if (dup && (phone !== undefined || email !== undefined)) {
            return res.status(409).json({ success: false, message: dup.message, field: dup.field });
        }
        const lead = await db_1.default.lead.update({ where: { id: leadId }, data: updateData });
        (0, cache_1.flushAdminClientsCache)();
        return res.json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to update lead" });
    }
});
router.post("/lead/:id/subcontacts", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const { name, designation, phone, email } = req.body;
        if (!name?.trim())
            return res.status(400).json({ success: false, message: "Name is required" });
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        const subContact = await db_1.default.subContact.create({
            data: { leadId, name: name.trim(), designation: designation?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null },
        });
        (0, cache_1.flushAdminClientsCache)();
        (0, cache_1.invalidateCache)(`csr:dashboard:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
        return res.status(201).json({ success: true, subContact });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to add sub-contact" });
    }
});
router.put("/lead/:id/subcontacts/:subId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const subId = String(req.params.subId);
        const { name, designation, phone, email } = req.body;
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId } });
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
        (0, cache_1.flushAdminClientsCache)();
        (0, cache_1.invalidateCache)(`csr:dashboard:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
        return res.json({ success: true, subContact });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to update sub-contact" });
    }
});
router.delete("/lead/:id/subcontacts/:subId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const subId = String(req.params.subId);
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        await db_1.default.subContact.delete({ where: { id: subId } });
        (0, cache_1.flushAdminClientsCache)();
        (0, cache_1.invalidateCache)(`csr:dashboard:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
        return res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to delete sub-contact" });
    }
});
/* ================= UPDATE LEAD NOTE ================= */
router.patch("/lead/:id/note", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const { comments } = req.body;
        await db_1.default.lead.update({
            where: { id: String(req.params.id) },
            data: { comments: comments ?? "" },
        });
        (0, cache_1.flushAdminClientsCache)();
        return res.json({ success: true });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to save note" });
    }
});
/* ================= ADMIN TIMESTAMPED NOTES (shared with CSR) ================= */
router.post("/lead/:id/notes", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const { text } = req.body;
        if (!text?.trim())
            return res.status(400).json({ success: false, message: "Note text required" });
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        const note = await db_1.default.leadNote.create({ data: { text: text.trim(), leadId } });
        (0, cache_1.flushAdminClientsCache)();
        (0, cache_1.invalidateCache)(`csr:projects:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
        return res.json({ success: true, note });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to add note" });
    }
});
router.put("/lead/:id/notes/:noteId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const { noteId } = req.params;
        const { text } = req.body;
        if (!text?.trim())
            return res.status(400).json({ success: false, message: "Note text required" });
        const note = await db_1.default.leadNote.findFirst({ where: { id: noteId, leadId } });
        if (!note)
            return res.status(404).json({ success: false, message: "Note not found" });
        const updated = await db_1.default.leadNote.update({ where: { id: noteId }, data: { text: text.trim() } });
        (0, cache_1.flushAdminClientsCache)();
        return res.json({ success: true, note: updated });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to update note" });
    }
});
router.delete("/lead/:id/notes/:noteId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const { noteId } = req.params;
        const note = await db_1.default.leadNote.findFirst({ where: { id: noteId, leadId } });
        if (!note)
            return res.status(404).json({ success: false, message: "Note not found" });
        await db_1.default.leadNote.delete({ where: { id: noteId } });
        (0, cache_1.flushAdminClientsCache)();
        return res.json({ success: true });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to delete note" });
    }
});
/* ================= UPDATE CSR STATUS ================= */
router.put("/csr-status/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const id = String(req.params.id);
        const { isActive } = req.body;
        if (typeof isActive !== "boolean") {
            return res.status(400).json({
                success: false,
                message: "isActive must be true or false",
            });
        }
        const existingCSR = await db_1.default.user.findUnique({
            where: { id },
        });
        if (!existingCSR) {
            return res.status(404).json({
                success: false,
                message: "CSR not found",
            });
        }
        const csr = await db_1.default.user.update({
            where: { id },
            data: { isActive },
            select: { id: true, name: true, email: true, isActive: true },
        });
        (0, cache_1.invalidateCache)("admin:csrs");
        return res.json({
            success: true,
            message: `CSR ${csr.isActive ? "activated" : "deactivated"} successfully`,
            csr,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Failed to update CSR status",
        });
    }
});
/* ================= CSR HISTORY ================= */
router.get("/csr-history/:csrId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const csrId = String(req.params.csrId);
        const csr = await db_1.default.user.findUnique({
            where: { id: csrId },
            select: {
                id: true,
                name: true,
                email: true,
                isActive: true,
                createdAt: true,
            },
        });
        if (!csr) {
            return res.status(404).json({
                success: false,
                message: "CSR not found",
            });
        }
        const leads = await db_1.default.lead.findMany({
            where: { assignedTo: csr.id },
            select: {
                id: true,
                name: true,
                company: true,
                phone: true,
                email: true,
                state: true,
                status: true,
                important: true,
                interested: true,
                comments: true,
                nextSchedule: true,
                nextTime: true,
                timezone: true,
                interestedService: true,
                projectTitle: true,
                projectCode: true,
                projectBudget: true,
                projectDeadline: true,
                clientCode: true,
                isOldClient: true,
                createdAt: true,
                updatedAt: true,
                uploadFile: { select: { companyName: true } },
                callLogs: {
                    orderBy: { createdAt: "desc" },
                    select: {
                        id: true,
                        status: true,
                        notes: true,
                        duration: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        const completed = leads.filter((l) => l.status?.toLowerCase() === "completed").length;
        const pending = leads.filter((l) => l.status?.toLowerCase() === "pending").length;
        const important = leads.filter((l) => l.important === true || l.status?.toLowerCase() === "important").length;
        const interested = leads.filter((l) => l.interested === true || l.status?.toLowerCase() === "interested").length;
        const projectWon = leads.filter((l) => l.status?.toLowerCase() === "close client").length;
        return res.json({
            success: true,
            csr,
            stats: {
                totalLeads: leads.length,
                completed,
                pending,
                important,
                interested,
                projectWon,
            },
            leads,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch CSR history",
        });
    }
});
/* ================= ALL ACTIVE PROJECT LEADS (all CSRs) ================= */
router.get("/projects", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const csrId = typeof req.query.csrId === "string" ? req.query.csrId : undefined;
        const from = typeof req.query.from === "string" ? req.query.from.trim() : undefined;
        const to = typeof req.query.to === "string" ? req.query.to.trim() : undefined;
        const lite = req.query.lite !== "0" && req.query.lite !== "false";
        const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
        const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
        const cacheKey = `admin:projects:${csrId ?? "all"}:${from ?? ""}:${to ?? ""}:${lite}:${page}:${limit}:${search}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const where = { ...(0, projectLeads_1.buildProjectLeadWhere)(csrId) };
        if (search) {
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
                {
                    OR: [
                        { name: { contains: search, mode: "insensitive" } },
                        { projectTitle: { contains: search, mode: "insensitive" } },
                        { company: { contains: search, mode: "insensitive" } },
                        { interestedService: { contains: search, mode: "insensitive" } },
                    ],
                },
            ];
        }
        const include = lite
            ? {
                csr: { select: { id: true, name: true, email: true, csrCode: true } },
                uploadFile: { select: { companyName: true } },
                notes: { orderBy: { createdAt: "desc" }, take: 5 },
            }
            : {
                csr: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        csrCode: true,
                    },
                },
                uploadFile: {
                    select: {
                        companyName: true,
                    },
                },
                notes: { orderBy: { createdAt: "asc" }, take: 20 },
            };
        const [rawLeads, total] = await Promise.all([
            db_1.default.lead.findMany({
                where,
                include,
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            db_1.default.lead.count({ where }),
        ]);
        let leads = rawLeads.filter(projectLeads_1.isDisplayableProjectLead);
        if (from || to) {
            leads = leads.filter((l) => {
                const dateStr = l.projectDeadline
                    ? new Date(l.projectDeadline).toISOString().split("T")[0]
                    : new Date(l.updatedAt).toISOString().split("T")[0];
                if (from && dateStr < from)
                    return false;
                if (to && dateStr > to)
                    return false;
                return true;
            });
        }
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [withBudget, thisMonth] = await Promise.all([
            db_1.default.lead.count({ where: { ...where, projectBudget: { not: null } } }),
            db_1.default.lead.count({ where: { ...where, updatedAt: { gte: monthStart } } }),
        ]);
        const stats = {
            total,
            withBudget,
            thisMonth,
        };
        const payload = {
            success: true,
            leads,
            stats,
            total,
            page,
            limit,
        };
        (0, cache_1.setCache)(cacheKey, payload, 45000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch projects",
        });
    }
});
/* ================= LOOKUP CLIENT BY PHONE (ADMIN) ================= */
router.get("/lookup-by-phone", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const phone = req.query.phone?.trim();
        if (!phone || (0, phone_1.normalizePhone)(phone).length < 7) {
            return res.json({ success: true, found: false });
        }
        const matches = await (0, leadPhoneLookup_1.findLeadsByPhone)(phone);
        return res.json((0, leadPhoneLookup_1.buildPhoneLookupResponse)(matches));
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to lookup client" });
    }
});
/* ================= ADD PROJECT (ADMIN) ================= */
router.post("/project", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const body = req.body;
        const { name, projectTitle, interestedService, projectDeadline } = body;
        if (!name || !projectTitle || !interestedService || !projectDeadline) {
            return res.status(400).json({
                success: false,
                message: "name, projectTitle, interestedService and projectDeadline are required.",
            });
        }
        const adminId = req.user?.id;
        if (!adminId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        const CSR_OTHER = "__other__";
        const rawCsrId = body.csrId ? String(body.csrId).trim() : "";
        const sourceText = typeof body.projectSource === "string" ? body.projectSource.trim() : "";
        let assignTo = adminId;
        let source = null;
        if (rawCsrId && rawCsrId !== CSR_OTHER) {
            const csr = await db_1.default.user.findFirst({
                where: { id: rawCsrId, role: "csr", isActive: true },
                select: { id: true },
            });
            if (!csr) {
                return res.status(400).json({ success: false, message: "Invalid or inactive CSR." });
            }
            assignTo = csr.id;
        }
        else if (rawCsrId === CSR_OTHER) {
            if (!sourceText) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter the external resource name for Other.",
                });
            }
            source = sourceText;
        }
        else if (sourceText) {
            source = sourceText;
        }
        const createData = {};
        applyProjectPayload(createData, body);
        createData.assignedTo = assignTo;
        createData.projectSource = source;
        createData.status = body.status ?? "Close Client";
        createData.important = false;
        createData.interested = false;
        const trimmedPhone = typeof body.phone === "string" ? body.phone.trim() : null;
        if (trimmedPhone)
            createData.phone = trimmedPhone;
        const existingLeads = trimmedPhone ? await (0, leadPhoneLookup_1.findLeadsByPhone)(trimmedPhone) : [];
        createData.isOldClient = existingLeads.length > 0;
        const lead = await db_1.default.lead.create({
            data: createData,
            include: {
                csr: { select: { id: true, name: true, email: true, csrCode: true } },
            },
        });
        (0, cache_1.flushAdminClientsCache)();
        if (assignTo !== adminId) {
            (0, cache_1.invalidateCache)(`csr:dashboard:${assignTo}`, `csr:projects:${assignTo}`, `csr:leads:${assignTo}`);
        }
        return res.status(201).json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to create project" });
    }
});
/* ================= UPDATE PROJECT (ADMIN) ================= */
router.put("/project/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const updateData = {};
        applyProjectPayload(updateData, req.body);
        if (req.body.assignedTo !== undefined)
            updateData.assignedTo = req.body.assignedTo;
        const lead = await db_1.default.lead.update({
            where: { id: leadId },
            data: updateData,
            include: {
                csr: { select: { id: true, name: true, email: true, csrCode: true } },
                notes: { orderBy: { createdAt: "asc" } },
            },
        });
        (0, cache_1.flushAdminClientsCache)();
        (0, cache_1.invalidateCache)(`csr:projects:${lead.assignedTo}`);
        return res.json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to update project" });
    }
});
/* ================= SHUFFLE STATUS ================= */
router.get("/shuffle-status", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const notCompleted = await db_1.default.lead.findMany({
            where: {
                status: {
                    in: ["not completed", "Not Completed"],
                },
            },
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                shuffleAttempts: true,
                csr: {
                    select: {
                        name: true,
                    },
                },
            },
            orderBy: { shuffleAttempts: "asc" },
        });
        const csrs = await db_1.default.user.findMany({
            where: {
                role: "csr",
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { createdAt: "asc" },
        });
        return res.json({
            success: true,
            totalNotCompleted: notCompleted.length,
            shuffleOrder: csrs.map((c) => c.name),
            leads: notCompleted.map((l) => ({
                id: l.id,
                name: l.name,
                phone: l.phone,
                assignedTo: l.csr?.name,
                shuffleAttempts: l.shuffleAttempts,
                attemptsLeft: 2 - l.shuffleAttempts,
                willDeleteNext: l.shuffleAttempts >= 2,
            })),
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch shuffle status",
        });
    }
});
/* ================= RESET A SINGLE CSR'S LEADS ================= */
router.get("/csr-reset-pages", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), (_req, res) => {
    return res.json({ success: true, groups: csrResetPages_1.CSR_RESET_GROUPS });
});
async function runCsrLeadReset(csrId, pagesInput) {
    const csr = await db_1.default.user.findUnique({
        where: { id: csrId },
        select: { id: true, name: true, role: true },
    });
    if (!csr) {
        return { status: 404, body: { success: false, message: "CSR not found" } };
    }
    if (csr.role !== "csr") {
        return { status: 400, body: { success: false, message: "User is not a CSR" } };
    }
    const scopes = (0, csrResetPages_1.normalizeCsrResetScopes)(pagesInput);
    const purged = await (0, purgeCsrLeads_1.purgeCsrLeads)(csrId, scopes);
    (0, csrCache_1.invalidateCsrLeadCaches)(csrId);
    (0, chatSocket_1.notifyCsrDataReset)(csrId);
    (0, chatSocket_1.notifyAdminSummaryStale)();
    const remaining = await db_1.default.lead.count({ where: { assignedTo: csrId } });
    const warning = purged.leadsDeleted === 0 && remaining > 0
        ? "No leads matched the selected pages. CSR data was not changed."
        : undefined;
    return {
        status: 200,
        body: {
            success: true,
            message: warning ?? `Reset complete for ${csr.name}`,
            warning,
            deleted: purged.leadsDeleted,
            remaining,
            purged,
            csrName: csr.name,
            pages: purged.pages,
            scopes: purged.pages,
        },
    };
}
router.post("/csr-leads/:csrId/reset", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const csrId = String(req.params.csrId);
        const pages = Array.isArray(req.body?.pages) ? req.body.pages.map(String) : undefined;
        const result = await runCsrLeadReset(csrId, pages);
        return res.status(result.status).json(result.body);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reset CSR data";
        console.log("[csr-reset]", error);
        return res.status(500).json({ success: false, message });
    }
});
router.delete("/csr-leads/:csrId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const csrId = String(req.params.csrId);
        const result = await runCsrLeadReset(csrId);
        return res.status(result.status).json(result.body);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to reset CSR data" });
    }
});
/* ================= RUN SHUFFLE MANUALLY ================= */
router.post("/run-shuffle", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        console.log("[TEST Shuffle] Manual trigger by admin");
        const csrs = await db_1.default.user.findMany({
            where: {
                role: "csr",
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
            orderBy: { createdAt: "asc" },
        });
        if (csrs.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Need at least 2 active CSRs",
            });
        }
        const notCompleted = await db_1.default.lead.findMany({
            where: {
                status: {
                    in: ["not completed", "Not Completed"],
                },
            },
        });
        if (notCompleted.length === 0) {
            return res.json({
                success: true,
                message: "No not-completed leads found",
                shuffled: 0,
                deleted: 0,
            });
        }
        let deleted = 0;
        let shuffled = 0;
        const details = [];
        const byCSR = new Map();
        for (const lead of notCompleted) {
            const key = lead.assignedTo;
            if (!byCSR.has(key)) {
                byCSR.set(key, []);
            }
            byCSR.get(key).push(lead);
        }
        const deleteIds = [];
        const updateOps = [];
        for (const [csrId, leads] of byCSR.entries()) {
            const toDelete = leads.filter((l) => l.shuffleAttempts >= 2);
            const toShuffle = leads.filter((l) => l.shuffleAttempts < 2);
            for (const lead of toDelete) {
                deleteIds.push(lead.id);
                deleted++;
                details.push(`Deleted: "${lead.name}" because 3 attempts completed`);
            }
            if (toShuffle.length === 0)
                continue;
            const otherCSRs = csrs.filter((c) => c.id !== csrId);
            if (otherCSRs.length === 0)
                continue;
            const fromName = csrs.find((c) => c.id === csrId)?.name ?? csrId;
            for (let i = 0; i < toShuffle.length; i++) {
                const lead = toShuffle[i];
                const target = otherCSRs[i % otherCSRs.length];
                const attempt = lead.shuffleAttempts + 1;
                updateOps.push(db_1.default.lead.update({
                    where: { id: lead.id },
                    data: {
                        assignedTo: target.id,
                        shuffleAttempts: attempt,
                        status: "pending",
                        followUpNotes: [
                            lead.followUpNotes,
                            `[Attempt ${attempt}/3] ${fromName} → ${target.name} on ${new Date().toLocaleDateString()}`,
                        ].filter(Boolean).join("\n"),
                    },
                }));
                shuffled++;
                details.push(`"${lead.name}" moved from ${fromName} to ${target.name} attempt ${attempt}/3`);
            }
        }
        /* ── BATCH: 1 deleteMany + parallel updates ── */
        await Promise.all([
            deleteIds.length
                ? db_1.default.lead.deleteMany({ where: { id: { in: deleteIds } } })
                : Promise.resolve(),
            ...updateOps,
        ]);
        (0, cache_1.flushAdminClientsCache)();
        return res.json({
            success: true,
            shuffled,
            deleted,
            details,
            message: `Done — Shuffled: ${shuffled}, Deleted: ${deleted}`,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Shuffle failed",
        });
    }
});
/* ================= ADMIN BIN (all not-picked + not-interested leads) ================= */
router.get("/bin", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const csrId = typeof req.query.csrId === "string" ? req.query.csrId : undefined;
        const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
        const cacheKey = `admin:bin:${csrId ?? "all"}:${page}:${limit}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const where = (0, binLeads_1.buildBinWhere)(csrId);
        const [leads, total] = await Promise.all([
            db_1.default.lead.findMany({
                where,
                include: {
                    csr: { select: { id: true, name: true, csrCode: true } },
                    uploadFile: { select: uploadSourceSelect_1.CSR_UPLOAD_FILE_SELECT },
                },
                orderBy: { updatedAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            db_1.default.lead.count({ where }),
        ]);
        const payload = { success: true, leads, total, page, limit };
        (0, cache_1.setCache)(cacheKey, payload, 30000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch bin" });
    }
});
/* ================= REASSIGN LEAD TO SPECIFIC CSR (ADMIN) ================= */
router.put("/lead/:id/reassign", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const { csrId } = req.body;
        if (!csrId)
            return res.status(400).json({ success: false, message: "CSR ID is required" });
        const targetCsr = await db_1.default.user.findFirst({ where: { id: csrId, role: "csr" } });
        if (!targetCsr)
            return res.status(404).json({ success: false, message: "CSR not found" });
        const existing = await db_1.default.lead.findFirst({ where: { id: leadId } });
        if (!existing)
            return res.status(404).json({ success: false, message: "Lead not found" });
        const prevCsrId = existing.assignedTo;
        const lead = await db_1.default.lead.update({
            where: { id: leadId },
            data: {
                assignedTo: csrId,
                inBin: false,
                binReason: null,
                binPreviousStatus: null,
            },
        });
        (0, cache_1.flushAdminClientsCache)();
        (0, cache_1.invalidatePattern)("admin:bin");
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:not-interested:${csrId}`, `csr:bin:${csrId}`, `csr:dashboard:${prevCsrId}`, `csr:leads:${prevCsrId}`, `csr:not-interested:${prevCsrId}`, `csr:bin:${prevCsrId}`);
        return res.json({ success: true, lead, message: `Lead reassigned to ${targetCsr.name}` });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to reassign lead" });
    }
});
/* ================= UPLOAD SOURCES (admin-only — hidden from CSR) ================= */
async function statsForAllSources(sourceIds) {
    const empty = {
        statsMap: new Map(),
        uploadsBySource: new Map(),
    };
    if (sourceIds.length === 0)
        return empty;
    const uploads = await db_1.default.uploadFile.findMany({
        where: { sourceId: { in: sourceIds } },
        select: { id: true, sourceId: true, fileName: true, totalLeads: true, companyName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
    });
    const fileToSource = new Map(uploads.map(u => [u.id, u.sourceId]));
    const fileIds = uploads.map(u => u.id);
    const leads = fileIds.length
        ? await db_1.default.lead.findMany({
            where: { uploadedFileId: { in: fileIds } },
            select: { status: true, uploadedFileId: true },
        })
        : [];
    const leadsBySource = new Map();
    for (const lead of leads) {
        const sid = lead.uploadedFileId ? fileToSource.get(lead.uploadedFileId) : undefined;
        if (!sid)
            continue;
        if (!leadsBySource.has(sid))
            leadsBySource.set(sid, []);
        leadsBySource.get(sid).push({ status: lead.status });
    }
    const statsMap = new Map();
    for (const sid of sourceIds) {
        statsMap.set(sid, (0, uploadSourceStats_1.countLeadStatuses)(leadsBySource.get(sid) ?? []));
    }
    const uploadsBySource = new Map();
    for (const u of uploads) {
        if (!u.sourceId)
            continue;
        if (!uploadsBySource.has(u.sourceId))
            uploadsBySource.set(u.sourceId, []);
        uploadsBySource.get(u.sourceId).push(u);
    }
    return { statsMap, uploadsBySource };
}
async function statsForSource(sourceId) {
    const { statsMap, uploadsBySource } = await statsForAllSources([sourceId]);
    return {
        stats: statsMap.get(sourceId) ?? (0, uploadSourceStats_1.countLeadStatuses)([]),
        uploads: uploadsBySource.get(sourceId) ?? [],
    };
}
router.get("/upload-sources", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (_req, res) => {
    try {
        const CACHE_KEY = "admin:upload-sources";
        const cached = (0, cache_1.getCache)(CACHE_KEY);
        if (cached)
            return res.json(cached);
        const sources = await db_1.default.uploadSource.findMany({ orderBy: { name: "asc" } });
        const sourceIds = sources.map(s => s.id);
        const { statsMap, uploadsBySource } = await statsForAllSources(sourceIds);
        const enriched = sources.map((src) => {
            const uploads = uploadsBySource.get(src.id) ?? [];
            const stats = statsMap.get(src.id) ?? (0, uploadSourceStats_1.countLeadStatuses)([]);
            return {
                id: src.id,
                name: src.name,
                sudoName: src.sudoName,
                createdAt: src.createdAt,
                uploadCount: uploads.length,
                lastUpload: uploads[0]?.createdAt ?? null,
                stats,
            };
        });
        const payload = { success: true, sources: enriched };
        (0, cache_1.setCache)(CACHE_KEY, payload, 120000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch upload sources" });
    }
});
router.post("/upload-sources", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const name = String(req.body.name ?? "").trim();
        const sudoNameRaw = String(req.body.sudoName ?? "").trim();
        const sudoName = sudoNameRaw || null;
        if (!name) {
            return res.status(400).json({ success: false, message: "Source name is required" });
        }
        const existing = await db_1.default.uploadSource.findUnique({ where: { name } });
        if (existing) {
            if (sudoName && existing.sudoName !== sudoName) {
                const updated = await db_1.default.uploadSource.update({
                    where: { id: existing.id },
                    data: { sudoName },
                });
                return res.json({ success: true, source: updated, created: false, updated: true });
            }
            return res.json({ success: true, source: existing, created: false });
        }
        const source = await db_1.default.uploadSource.create({ data: { name, sudoName } });
        return res.json({ success: true, source, created: true });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to create upload source" });
    }
});
router.get("/upload-sources/:sourceId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const sourceId = String(req.params.sourceId);
        const source = await db_1.default.uploadSource.findUnique({ where: { id: sourceId } });
        if (!source) {
            return res.status(404).json({ success: false, message: "Source not found" });
        }
        const { stats, uploads } = await statsForSource(sourceId);
        const leads = uploads.length
            ? await db_1.default.lead.findMany({
                where: { uploadedFileId: { in: uploads.map(u => u.id) } },
                select: {
                    id: true, name: true, phone: true, email: true, status: true,
                    company: true, interestedService: true, updatedAt: true,
                    csr: { select: { name: true } },
                },
                orderBy: { updatedAt: "desc" },
                take: 200,
            })
            : [];
        return res.json({
            success: true,
            source: { id: source.id, name: source.name, sudoName: source.sudoName, createdAt: source.createdAt },
            stats,
            uploads,
            leads,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch source details" });
    }
});
/* ================= CSR LOGIN / ACTIVITY REPORT (EST) ================= */
router.get("/csr-session-report", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const csrId = typeof req.query.csrId === "string" && req.query.csrId !== "all"
            ? req.query.csrId
            : undefined;
        let from;
        let to;
        const fromStr = typeof req.query.from === "string" ? req.query.from : "";
        const toStr = typeof req.query.to === "string" ? req.query.to : "";
        if (fromStr) {
            const b = (0, estTime_1.estDayBoundsUtc)(fromStr);
            if (b)
                from = b.start;
        }
        if (toStr) {
            const b = (0, estTime_1.estDayBoundsUtc)(toStr);
            if (b)
                to = b.end;
        }
        if (!from && !to) {
            const toYmd = (0, estTime_1.estDateYmd)();
            const fromYmd = (0, estTime_1.addEstDays)(toYmd, -6);
            from = (0, estTime_1.estDayBoundsUtc)(fromYmd).start;
            to = (0, estTime_1.estDayBoundsUtc)(toYmd).end;
        }
        const report = await (0, csrSessionTracking_1.buildCsrSessionReport)({ from, to, csrId });
        return res.json({
            success: true,
            timezone: "America/New_York",
            timezoneLabel: "Eastern Time (EST/EDT)",
            from: from?.toISOString() ?? null,
            to: to?.toISOString() ?? null,
            ...report,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch CSR activity report" });
    }
});
/* Admin can correct check-in / check-out times (EST). */
router.put("/csr-work-session/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const sessionId = String(req.params.id ?? "");
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session id required." });
        }
        const { checkInAt, checkOutAt, clearCheckOut, dashboardMs, awayMs, note, } = req.body ?? {};
        if (!checkInAt || typeof checkInAt !== "string") {
            return res.status(400).json({ success: false, message: "checkInAt is required (EST datetime)." });
        }
        const checkInDate = (0, estTime_1.parseEstDateTimeLocal)(checkInAt) ??
            (!Number.isNaN(Date.parse(checkInAt)) ? new Date(checkInAt) : null);
        if (!checkInDate) {
            return res.status(400).json({ success: false, message: "Invalid check-in time." });
        }
        let checkOutDate = null;
        if (!clearCheckOut && checkOutAt) {
            if (typeof checkOutAt !== "string") {
                return res.status(400).json({ success: false, message: "Invalid check-out time." });
            }
            checkOutDate =
                (0, estTime_1.parseEstDateTimeLocal)(checkOutAt) ??
                    (!Number.isNaN(Date.parse(checkOutAt)) ? new Date(checkOutAt) : null);
            if (!checkOutDate) {
                return res.status(400).json({ success: false, message: "Invalid check-out time." });
            }
        }
        const result = await (0, csrSessionTracking_1.adminAdjustCsrWorkSession)({
            sessionId,
            checkInAt: checkInDate,
            checkOutAt: checkOutDate,
            clearCheckOut: !!clearCheckOut,
            dashboardMs: typeof dashboardMs === "number" ? dashboardMs : undefined,
            awayMs: typeof awayMs === "number" ? awayMs : undefined,
            note: typeof note === "string" ? note : undefined,
        });
        if (!result.ok) {
            return res.status(404).json({ success: false, message: result.message });
        }
        return res.json({
            success: true,
            message: "Session times updated.",
            session: {
                id: result.session.id,
                loginAt: result.session.loginAt.toISOString(),
                logoutAt: result.session.logoutAt?.toISOString() ?? null,
                dashboardMs: result.session.dashboardMs,
                awayMs: result.session.awayMs,
                closedReason: result.session.closedReason,
            },
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to update work session." });
    }
});
/* ================= ACCESS HISTORY (IP / device) ================= */
router.get("/access-history/:userId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const userId = typeof req.params.userId === "string"
            ? req.params.userId
            : req.params.userId?.[0];
        if (!userId) {
            return res.status(400).json({ success: false, message: "User id required." });
        }
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const history = await db_1.default.accessHistory.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: {
                id: true, event: true, ip: true, deviceId: true,
                browser: true, userAgent: true, createdAt: true,
            },
        });
        return res.json({ success: true, history });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch access history" });
    }
});
router.patch("/upload-sources/:sourceId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const sourceId = String(req.params.sourceId);
        const existing = await db_1.default.uploadSource.findUnique({ where: { id: sourceId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Source not found" });
        }
        const nameRaw = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
        const sudoNameRaw = req.body.sudoName !== undefined ? String(req.body.sudoName).trim() : undefined;
        if (nameRaw !== undefined && !nameRaw) {
            return res.status(400).json({ success: false, message: "Source name cannot be empty" });
        }
        if (nameRaw && nameRaw !== existing.name) {
            const conflict = await db_1.default.uploadSource.findUnique({ where: { name: nameRaw } });
            if (conflict) {
                return res.status(409).json({ success: false, message: "A source with this name already exists" });
            }
        }
        const source = await db_1.default.uploadSource.update({
            where: { id: sourceId },
            data: {
                ...(nameRaw !== undefined ? { name: nameRaw } : {}),
                ...(sudoNameRaw !== undefined ? { sudoName: sudoNameRaw || null } : {}),
            },
        });
        return res.json({ success: true, source });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to update upload source" });
    }
});
router.delete("/upload-sources/:sourceId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const sourceId = String(req.params.sourceId);
        const existing = await db_1.default.uploadSource.findUnique({ where: { id: sourceId } });
        if (!existing) {
            return res.status(404).json({ success: false, message: "Source not found" });
        }
        await db_1.default.uploadFile.updateMany({
            where: { sourceId },
            data: { sourceId: null },
        });
        await db_1.default.uploadSource.delete({ where: { id: sourceId } });
        return res.json({ success: true, message: "Source deleted" });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to delete upload source" });
    }
});
/* ================= TRADES ================= */
router.get("/trades", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (_req, res) => {
    try {
        const trades = await db_1.default.trade.findMany({ orderBy: { name: "asc" } });
        return res.json({ success: true, trades });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch trades" });
    }
});
router.post("/trades", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const name = req.body.name?.trim();
        if (!name)
            return res.status(400).json({ success: false, message: "Trade name required" });
        const existing = await db_1.default.trade.findUnique({ where: { name } });
        if (existing)
            return res.status(409).json({ success: false, message: "Trade already exists" });
        const trade = await db_1.default.trade.create({ data: { name } });
        return res.status(201).json({ success: true, trade });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to create trade" });
    }
});
router.delete("/trades/:tradeId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin", "manager", "technical_manager"), async (req, res) => {
    try {
        const tradeId = req.params.tradeId;
        await db_1.default.trade.delete({ where: { id: tradeId } }).catch(() => null);
        return res.json({ success: true });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to delete trade" });
    }
});
/* ================= RESTORE LEGACY COMMENTS → LeadNote ================= */
router.post("/migrate-legacy-notes", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (_req, res) => {
    try {
        const leads = await db_1.default.lead.findMany({
            where: {
                OR: [
                    { comments: { not: null } },
                    { followUpNotes: { not: null } },
                ],
            },
            select: {
                id: true,
                comments: true,
                followUpNotes: true,
                createdAt: true,
                _count: { select: { notes: true } },
            },
        });
        let migrated = 0;
        for (const lead of leads) {
            if (lead._count.notes > 0)
                continue;
            const text = [lead.comments?.trim(), lead.followUpNotes?.trim()].filter(Boolean).join("\n\n");
            if (!text)
                continue;
            await db_1.default.leadNote.create({
                data: {
                    leadId: lead.id,
                    text,
                    createdAt: lead.createdAt,
                },
            });
            migrated++;
        }
        (0, cache_1.flushAdminClientsCache)();
        return res.json({
            success: true,
            message: `Restored notes on ${migrated} lead(s) from legacy comments fields`,
            migrated,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Migration failed" });
    }
});
exports.default = router;
