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
const router = express_1.default.Router();
/* ================= ADMIN DASHBOARD ================= */
router.get("/dashboard", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), (req, res) => {
    res.json({ success: true, message: "Welcome Admin" });
});
/* ================= GET ALL CSRS ================= */
router.get("/csrs", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
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
/* ================= GET ALL CLIENTS / LEADS ================= */
router.get("/clients", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const CACHE_KEY = "admin:clients";
        const cached = (0, cache_1.getCache)(CACHE_KEY);
        if (cached)
            return res.json(cached);
        /* Lean select — charts only need id, name, status, createdAt, updatedAt, csr.name */
        const leads = await db_1.default.lead.findMany({
            select: {
                id: true,
                name: true,
                status: true,
                interested: true,
                createdAt: true,
                updatedAt: true,
                csr: { select: { id: true, name: true, csrCode: true } },
            },
            orderBy: { updatedAt: "desc" },
        });
        const stats = {
            totalClients: leads.length,
            activeClients: leads.filter(l => l.status?.toLowerCase() === "pending").length,
            interested: leads.filter(l => l.status?.toLowerCase() === "interested" || l.interested).length,
            closed: leads.filter(l => ["closed", "completed", "close client"].includes(l.status?.toLowerCase() || "")).length,
        };
        const payload = { success: true, leads, stats };
        (0, cache_1.setCache)(CACHE_KEY, payload, 60000);
        return res.json(payload);
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch clients" });
    }
});
/* ================= UPDATE LEAD NOTE ================= */
router.patch("/lead/:id/note", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const { comments } = req.body;
        await db_1.default.lead.update({
            where: { id: String(req.params.id) },
            data: { comments: comments ?? "" },
        });
        (0, cache_1.invalidateCache)("admin:clients");
        return res.json({ success: true });
    }
    catch {
        return res.status(500).json({ success: false, message: "Failed to save note" });
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
            include: {
                uploadFile: {
                    select: {
                        companyName: true,
                    },
                },
                callLogs: {
                    orderBy: {
                        createdAt: "desc",
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        const completed = leads.filter((l) => l.status?.toLowerCase() === "completed").length;
        const pending = leads.filter((l) => l.status?.toLowerCase() === "pending").length;
        const important = leads.filter((l) => l.important === true || l.status?.toLowerCase() === "important").length;
        const interested = leads.filter((l) => l.interested === true || l.status?.toLowerCase() === "interested").length;
        const projectWon = leads.filter((l) => l.status?.toLowerCase() === "Close Client").length;
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
/* ================= ALL Close Client LEADS ================= */
router.get("/projects", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const leads = await db_1.default.lead.findMany({
            where: { status: "Close Client", projectTitle: { not: null } },
            include: {
                csr: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                uploadFile: {
                    select: {
                        companyName: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });
        const now = new Date();
        const stats = {
            total: leads.length,
            withBudget: leads.filter((l) => l.projectBudget).length,
            thisMonth: leads.filter((l) => {
                const d = new Date(l.updatedAt);
                return (d.getMonth() === now.getMonth() &&
                    d.getFullYear() === now.getFullYear());
            }).length,
        };
        return res.json({
            success: true,
            leads,
            stats,
        });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch projects",
        });
    }
});
/* ================= UPDATE PROJECT (ADMIN) ================= */
router.put("/project/:id", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const { projectCode, projectTitle, projectBudget, projectDeadline, projectNotes, } = req.body;
        const updateData = {};
        if (projectCode !== undefined)
            updateData.projectCode = projectCode;
        if (projectTitle !== undefined)
            updateData.projectTitle = projectTitle;
        if (projectBudget !== undefined)
            updateData.projectBudget = projectBudget;
        if (projectDeadline !== undefined)
            updateData.projectDeadline = projectDeadline;
        if (projectNotes !== undefined)
            updateData.projectNotes = projectNotes;
        const lead = await db_1.default.lead.update({
            where: { id: leadId },
            data: updateData,
        });
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
router.delete("/csr-leads/:csrId", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const csrId = String(req.params.csrId);
        const csr = await db_1.default.user.findUnique({
            where: { id: csrId },
            select: { id: true, name: true, role: true },
        });
        if (!csr) {
            return res.status(404).json({ success: false, message: "CSR not found" });
        }
        if (csr.role !== "csr") {
            return res.status(400).json({ success: false, message: "User is not a CSR" });
        }
        /* Cascade-delete children before removing leads */
        const toDelete = await db_1.default.lead.findMany({ where: { assignedTo: csrId }, select: { id: true } });
        const leadIds = toDelete.map(l => l.id);
        if (leadIds.length > 0) {
            await Promise.all([
                db_1.default.leadNote.deleteMany({ where: { leadId: { in: leadIds } } }),
                db_1.default.subContact.deleteMany({ where: { leadId: { in: leadIds } } }),
                db_1.default.callLog.deleteMany({ where: { leadId: { in: leadIds } } }),
            ]);
        }
        const { count } = await db_1.default.lead.deleteMany({ where: { assignedTo: csrId } });
        (0, cache_1.invalidateCache)("admin:clients", "admin:csrs", `csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
        return res.json({
            success: true,
            message: `Deleted ${count} leads for ${csr.name}`,
            deleted: count,
            csrName: csr.name,
        });
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
        (0, cache_1.invalidateCache)("admin:clients");
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
router.get("/bin", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const leads = await db_1.default.lead.findMany({
            where: { status: { in: ["not picked", "not completed", "Not Interested"] } },
            include: {
                csr: { select: { id: true, name: true, csrCode: true } },
                uploadFile: { select: { companyName: true } },
            },
            orderBy: { updatedAt: "desc" },
        });
        return res.json({ success: true, leads });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to fetch bin" });
    }
});
/* ================= REASSIGN LEAD TO SPECIFIC CSR (ADMIN) ================= */
router.put("/lead/:id/reassign", auth_middleware_1.verifyToken, (0, role_middleware_1.allowRoles)("admin"), async (req, res) => {
    try {
        const leadId = String(req.params.id);
        const { csrId } = req.body;
        if (!csrId)
            return res.status(400).json({ success: false, message: "CSR ID is required" });
        const targetCsr = await db_1.default.user.findFirst({ where: { id: csrId, role: "csr" } });
        if (!targetCsr)
            return res.status(404).json({ success: false, message: "CSR not found" });
        const lead = await db_1.default.lead.update({
            where: { id: leadId },
            data: { assignedTo: csrId },
        });
        (0, cache_1.invalidateCache)("admin:clients", `csr:dashboard:${csrId}`, `csr:leads:${csrId}`);
        return res.json({ success: true, lead, message: `Lead reassigned to ${targetCsr.name}` });
    }
    catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Failed to reassign lead" });
    }
});
exports.default = router;
