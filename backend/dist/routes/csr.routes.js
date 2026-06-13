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
const cache_1 = require("../utils/cache");
const router = express_1.default.Router();
/* ─── LIMITS ─── */
const NOT_INTERESTED_LIMIT = 3;
const NOT_PICKED_LIMIT = 7;
/* ================= CSR DASHBOARD ================= */
router.get("/dashboard", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const cacheKey = `csr:dashboard:${csrId}`;
        const cached = (0, cache_1.getCache)(cacheKey);
        if (cached)
            return res.json(cached);
        const leads = await db_1.default.lead.findMany({
            where: { assignedTo: csrId },
            include: { uploadFile: { select: { companyName: true } } },
            orderBy: { createdAt: "desc" },
        });
        const payload = { success: true, totalLeads: leads.length, leads };
        (0, cache_1.setCache)(cacheKey, payload, 3000);
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
        const leads = await db_1.default.lead.findMany({
            where: {
                assignedTo: csrId,
                status: { in: ["Not Interested", "not picked", "not completed"] },
            },
            include: { uploadFile: { select: { companyName: true } } },
            orderBy: { updatedAt: "desc" },
        });
        return res.json({ success: true, leads });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch leads" });
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
        const lead = await db_1.default.lead.create({
            data: {
                name,
                company: company ?? null,
                phone: phone ?? null,
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
            },
        });
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:projects:${csrId}`, "admin:clients");
        return res.status(201).json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to create project" });
    }
});
/* ================= UPDATE LEAD NOTE ================= */
router.patch("/lead/:id/note", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const { comments } = req.body;
        const lead = await db_1.default.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
        if (!lead)
            return res.status(404).json({ success: false, message: "Lead not found" });
        await db_1.default.lead.update({ where: { id: leadId }, data: { comments: comments ?? "" } });
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, "admin:clients");
        return res.json({ success: true });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to save note" });
    }
});
/* ================= UPDATE LEAD ================= */
router.put("/lead/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("csr"), async (req, res) => {
    try {
        const csrId = req.user.id;
        const leadId = req.params.id;
        const { status, nextSchedule, nextTime, timezone, followUpNotes, interestedService, projectTitle, projectCode, projectDeadline, projectBudget, projectNotes, paidAmount, comments, name, phone, email, state, } = req.body;
        /* Fetch current lead to get existing counts */
        const lead = await db_1.default.lead.findFirst({
            where: { id: leadId, assignedTo: csrId },
        });
        if (!lead) {
            return res.status(404).json({ success: false, message: "Lead not found" });
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
                const tag = newCount >= NOT_INTERESTED_LIMIT ? " — LIMIT REACHED" : "";
                const entry = `[Try ${newCount}/${NOT_INTERESTED_LIMIT} · ${ts}] Not Interested${tag}`;
                updateData.followUpNotes = [lead.followUpNotes, entry].filter(Boolean).join("\n");
                await db_1.default.lead.update({ where: { id: leadId }, data: updateData });
                if (newCount >= NOT_INTERESTED_LIMIT) {
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
                    triesLeft: NOT_INTERESTED_LIMIT - newCount,
                });
            }
            /* ── NOT PICKED (limit = 7) ── */
            if (status === "not picked" || status === "not completed") {
                const newCount = (lead.notPickedCount ?? 0) + 1;
                updateData.notPickedCount = newCount;
                updateData.important = false;
                updateData.interested = false;
                const ts = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
                const tag = newCount >= NOT_PICKED_LIMIT ? " — LIMIT REACHED" : "";
                const entry = `[Try ${newCount}/${NOT_PICKED_LIMIT} · ${ts}] Not Picked${tag}`;
                updateData.followUpNotes = [lead.followUpNotes, entry].filter(Boolean).join("\n");
                await db_1.default.lead.update({ where: { id: leadId }, data: updateData });
                if (newCount >= NOT_PICKED_LIMIT) {
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
                    triesLeft: NOT_PICKED_LIMIT - newCount,
                });
            }
            /* ── IMPORTANT ── */
            if (status === "important") {
                updateData.important = true;
                updateData.interested = false;
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
                const company = lead.company?.trim().toLowerCase();
                if (company) {
                    const previousWin = await db_1.default.lead.findFirst({
                        where: {
                            id: { not: leadId },
                            company: { equals: lead.company ?? "", mode: "insensitive" },
                            status: { in: ["Close Client", "completed"] },
                        },
                    });
                    updateData.isOldClient = !!previousWin;
                }
                else {
                    updateData.isOldClient = false;
                }
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
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, "admin:clients");
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
        const { name, phone, company, interestedService, comments } = req.body;
        if (!name?.trim()) {
            return res.status(400).json({ success: false, message: "Client name is required." });
        }
        const lead = await db_1.default.lead.create({
            data: {
                name: name.trim(),
                phone: phone?.trim() || null,
                company: company?.trim() || null,
                interestedService: interestedService?.trim() || null,
                comments: comments?.trim() || null,
                status: "pending",
                assignedTo: csrId,
                important: false,
                interested: false,
            },
        });
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, "admin:clients");
        return res.status(201).json({ success: true, lead });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to create lead" });
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
        const csrLeads = await db_1.default.lead.findMany({
            where: { assignedTo: csrId },
            include: { uploadFile: { select: { companyName: true } } },
            orderBy: { createdAt: "desc" },
        });
        const phones = [...new Set(csrLeads.map(l => l.phone).filter((p) => !!p))];
        const phoneCountMap = new Map();
        if (phones.length > 0) {
            const allWithPhone = await db_1.default.lead.findMany({
                where: { phone: { in: phones } },
                select: { phone: true },
            });
            for (const l of allWithPhone) {
                if (l.phone)
                    phoneCountMap.set(l.phone, (phoneCountMap.get(l.phone) ?? 0) + 1);
            }
        }
        const leads = csrLeads.map(lead => ({
            ...lead,
            isOldClient: lead.isOldClient || !!(lead.phone && (phoneCountMap.get(lead.phone) ?? 0) > 1),
        }));
        const payload = { success: true, leads };
        (0, cache_1.setCache)(cacheKey, payload, 3000);
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
        const leads = await db_1.default.lead.findMany({
            where: {
                assignedTo: csrId,
                status: { in: ["Close Client", "completed"] },
            },
            include: { uploadFile: { select: { companyName: true } } },
            orderBy: { updatedAt: "desc" },
        });
        const payload = { success: true, leads };
        (0, cache_1.setCache)(cacheKey, payload, 3000);
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
            },
        });
        (0, cache_1.invalidateCache)(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:dashboard:${targetCsrId}`, `csr:leads:${targetCsrId}`, "admin:clients");
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
        const leads = await db_1.default.lead.findMany({
            where: { assignedTo: csrId, status: { in: ["not picked", "not completed"] } },
            include: { uploadFile: { select: { companyName: true } } },
            orderBy: { updatedAt: "desc" },
        });
        return res.json({ success: true, leads });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch bin" });
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
        await db_1.default.user.update({
            where: { id: userId },
            data: { isOnline: true, lastActive: new Date() },
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
