import express from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { getCache, setCache, invalidateCache, invalidatePattern, flushAdminClientsCache } from "../utils/cache";
import { purgeCsrLeads } from "../utils/purgeCsrLeads";
import { countLeadStatuses } from "../utils/uploadSourceStats";
import { buildProjectLeadWhere, isDisplayableProjectLead } from "../utils/projectLeads";
import {
  normalizePaymentsInput,
  parseProjectPayments,
  paidTotalFromEntries,
} from "../utils/projectPayments";
import { buildBinWhere, filterActiveLeads } from "../utils/binLeads";
import { findLeadsByPhone, buildPhoneLookupResponse } from "../utils/leadPhoneLookup";
import { findDuplicateLead } from "../utils/leadDuplicateCheck";
import { CSR_UPLOAD_FILE_SELECT } from "../utils/uploadSourceSelect";
import { normalizePhone } from "../utils/phone";
import {
  buildAdminClientListWhere,
  buildAdminClientViewWhere,
  importantOnlyWhere,
  scheduledCallWhere,
  isInterestedStatusWhere,
  ADMIN_LEAD_LIST_SELECT,
  type AdminClientView,
} from "../utils/adminClientQueries";
import { enforceAdminIpAllowlist } from "../middleware/adminIp.middleware";
import { AuthRequest } from "../middleware/auth.middleware";
import { deleteLeadsCascade, invalidateAllLeadCaches } from "../utils/deleteLeadsCascade";

const router = express.Router();
router.use(enforceAdminIpAllowlist);

function applyProjectPayload(updateData: Record<string, unknown>, body: Record<string, unknown>) {
  const scalars = [
    "name", "company", "phone", "email", "state", "ownerName",
    "projectCode", "projectTitle", "projectScope", "interestedService",
    "projectBudget", "projectDeadline", "projectNotes", "projectPhase",
    "takeoffDeadline", "pricingDeadline", "qaDeadline", "projectSource",
  ] as const;
  for (const key of scalars) {
    if (body[key] !== undefined) updateData[key] = body[key];
  }
  const payments = normalizePaymentsInput(body.projectPayments);
  if (payments !== undefined) {
    updateData.projectPayments = payments;
    updateData.paidAmount = String(paidTotalFromEntries(parseProjectPayments(payments)));
  } else if (body.paidAmount !== undefined) {
    updateData.paidAmount = body.paidAmount;
  }
}

/* ================= ADMIN DASHBOARD ================= */
router.get("/dashboard", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, message: "Welcome Admin" });
});

/* ================= ADMIN MEETING NOTIFICATIONS (scheduled calls) ================= */
router.get("/notifications", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const csrId = typeof req.query.csrId === "string" ? req.query.csrId : undefined;

    const rawScheduled = await prisma.lead.findMany({
      where: {
        ...(csrId ? { assignedTo: csrId } : {}),
        status: "important",
        nextSchedule: { not: null },
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

    const scheduledLeads = filterActiveLeads(rawScheduled);

    const scheduledCalls = scheduledLeads
      .filter((l) => (l.nextSchedule ?? "") >= today)
      .slice(0, 30)
      .map((l) => ({
        id: l.id,
        client: l.name ?? "Client",
        date: l.nextSchedule!,
        time: l.nextTime!,
        timezone: l.timezone ?? "",
        csrName: l.csr?.name ?? "",
        csrCode: l.csr?.csrCode ?? "",
        csrId: l.csr?.id ?? "",
      }));

    return res.json({ success: true, scheduledCalls });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

/* ================= GET ALL CSRS ================= */
router.get("/csrs", verifyToken, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const CACHE_KEY = "admin:csrs";
    const cached = getCache<object>(CACHE_KEY);
    if (cached) return res.json(cached);

    const csrs = await prisma.user.findMany({
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
    setCache(CACHE_KEY, payload, 15_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch CSRs" });
  }
});

/* ================= CLIENT SUMMARY (fast — dashboard tiles & charts) ================= */
router.get("/clients/summary", verifyToken, allowRoles("admin"), async (_req, res) => {
  try {
    const CACHE_KEY = "admin:clients:summary";
    const cached = getCache<object>(CACHE_KEY);
    if (cached) return res.json(cached);

    const chartDaysAgo = new Date();
    chartDaysAgo.setDate(chartDaysAgo.getDate() - 45);

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
          id: true, name: true, status: true, updatedAt: true,
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
          csr:  { select: { name: true } },
        },
      }),
      prisma.lead.findMany({
        where:   { createdAt: { gte: chartDaysAgo } },
        select:  { createdAt: true },
      }),
      prisma.lead.groupBy({ by: ["assignedTo"], _count: { _all: true } }),
      prisma.lead.groupBy({
        by:    ["assignedTo"],
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

    const totalMap     = new Map(csrGroups.map(g => [g.assignedTo, g._count._all]));
    const resolvedMap  = new Map(resolvedGroups.map(g => [g.assignedTo, g._count._all]));
    const performers = [...totalMap.entries()]
      .filter(([id]) => typeof id === "string" && id.length > 0)
      .map(([id, total]) => {
        const resolved = resolvedMap.get(id) ?? 0;
        const name = csrNameById.get(id) ?? "Unassigned";
        return { name, resolved, total, rate: total > 0 ? Math.round((resolved / total) * 100) : 0 };
      })
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 5);

    const payload = {
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
        all:        totalLeads,
        important:  importantOnly,
        schedule:   scheduled,
        interested,
        closed,
      },
      distribution: {
        Pending:      pending,
        Important:    importantOnly + scheduled,
        Interested:   interested,
        "Close Client": projectWon,
        Closed:       completed + closed,
      },
      recent,
      recentStatusLogs: recentStatusLogs.map(log => ({
        id:        log.id,
        status:    log.status,
        createdAt: log.createdAt,
        leadName:  log.lead?.name ?? "Unknown",
        csrName:   log.csr?.name  ?? "Unknown CSR",
      })),
      chartLeads,
      performers,
    };

    setCache(CACHE_KEY, payload, 120_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch client summary" });
  }
});

/* ================= GET CLIENTS / LEADS (paginated — admin leads page) ================= */
router.get("/clients", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const view = (String(req.query.view || "all") as AdminClientView);
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const csrName = req.query.csr ? String(req.query.csr) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const scheduleDate = req.query.scheduleDate ? String(req.query.scheduleDate) : undefined;

    const cacheKey = `admin:clients:list:${view}:${page}:${limit}:${csrName ?? "all"}:${search ?? ""}:${scheduleDate ?? ""}`;
    const cached = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const where = buildAdminClientListWhere(view, csrName, search, scheduleDate);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        select:  ADMIN_LEAD_LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.lead.count({ where }),
    ]);

    const payload = {
      success: true,
      leads,
      total,
      page,
      limit,
      stats: {
        totalClients: total,
        activeClients: view === "all"
          ? await prisma.lead.count({ where: { status: "pending" } })
          : undefined,
      },
    };

    setCache(cacheKey, payload, 60_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch clients" });
  }
});

/* ================= CREATE LEAD (ADMIN manual add) ================= */

router.post("/lead", verifyToken, allowRoles("admin"), async (req: AuthRequest, res) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { name, email, phone, company, status, csrId } = req.body as {
      name?: string; email?: string; phone?: string; company?: string; status?: string; csrId?: string;
    };

    if (!name?.trim()) return res.status(400).json({ success: false, message: "Client name is required." });
    if (!email?.trim()) return res.status(400).json({ success: false, message: "Email is required." });

    const dup = await findDuplicateLead(phone, email);
    if (dup) return res.status(409).json({ success: false, message: dup.message, field: dup.field });

    let assignTo = adminId;
    if (csrId) {
      const csr = await prisma.user.findFirst({ where: { id: csrId, role: "csr", isActive: true } });
      if (!csr) return res.status(400).json({ success: false, message: "Invalid CSR." });
      assignTo = csr.id;
    }

    const trimmedPhone = phone?.trim() || null;
    const existingLeads = trimmedPhone ? await findLeadsByPhone(trimmedPhone) : [];

    const lead = await prisma.lead.create({
      data: {
        name:        name.trim(),
        email:       email.trim().toLowerCase(),
        phone:       trimmedPhone,
        company:     company?.trim() || null,
        status:      status || "pending",
        assignedTo:  assignTo,
        important:   false,
        interested:  false,
        isOldClient: existingLeads.length > 0,
      },
      include: { csr: { select: { id: true, name: true, csrCode: true } } },
    });

    flushAdminClientsCache();
    if (assignTo !== adminId) {
      invalidateCache(`csr:dashboard:${assignTo}`, `csr:leads:${assignTo}`);
    }
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to create lead" });
  }
});

/* ================= GET SINGLE LEAD (ADMIN) ================= */
router.get("/lead/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const lead = await prisma.lead.findFirst({
      where:   { id: leadId },
      include: {
        uploadFile:  { select: { companyName: true } },
        notes:       { orderBy: { createdAt: "asc" } },
        subContacts: { orderBy: { createdAt: "asc" } },
        csr:         { select: { id: true, name: true, csrCode: true } },
      },
    });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    return res.json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch lead" });
  }
});

/* ================= DELETE LEAD / PROJECT (ADMIN) ================= */
router.delete("/lead/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const lead = await prisma.lead.findFirst({
      where: { id: leadId },
      select: { id: true, assignedTo: true, name: true },
    });
    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    const deleted = await deleteLeadsCascade([leadId]);
    await invalidateAllLeadCaches(lead.assignedTo ? [lead.assignedTo] : undefined);

    return res.json({
      success: true,
      message: `"${lead.name ?? "Record"}" deleted permanently`,
      deleted,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to delete lead" });
  }
});

/* ================= UPDATE LEAD DETAILS (ADMIN) ================= */
router.put("/lead/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { name, phone, email, state } = req.body;

    const existing = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!existing) return res.status(404).json({ success: false, message: "Lead not found" });

    const updateData: Record<string, unknown> = {};
    if (name  !== undefined) updateData.name  = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (state !== undefined) updateData.state = state;

    const dup = await findDuplicateLead(
      phone !== undefined ? String(phone) : existing.phone,
      email !== undefined ? String(email) : existing.email,
      leadId,
    );
    if (dup && (phone !== undefined || email !== undefined)) {
      return res.status(409).json({ success: false, message: dup.message, field: dup.field });
    }

    const lead = await prisma.lead.update({ where: { id: leadId }, data: updateData });

    flushAdminClientsCache();
    return res.json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update lead" });
  }
});

router.post("/lead/:id/subcontacts", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { name, designation, phone, email } = req.body as { name: string; designation?: string; phone?: string; email?: string };
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });

    const lead = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const subContact = await prisma.subContact.create({
      data: { leadId, name: name.trim(), designation: designation?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null },
    });
    flushAdminClientsCache();
    invalidateCache(`csr:dashboard:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
    return res.status(201).json({ success: true, subContact });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to add sub-contact" });
  }
});

router.put("/lead/:id/subcontacts/:subId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const subId  = String(req.params.subId);
    const { name, designation, phone, email } = req.body as { name?: string; designation?: string; phone?: string; email?: string };

    const lead = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const existing = await prisma.subContact.findFirst({ where: { id: subId, leadId } });
    if (!existing) return res.status(404).json({ success: false, message: "Sub-contact not found" });

    const subContact = await prisma.subContact.update({
      where: { id: subId },
      data: {
        ...(name        !== undefined ? { name: name.trim() } : {}),
        ...(designation !== undefined ? { designation: designation?.trim() || null } : {}),
        ...(phone       !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(email       !== undefined ? { email: email?.trim() || null } : {}),
      },
    });
    flushAdminClientsCache();
    invalidateCache(`csr:dashboard:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
    return res.json({ success: true, subContact });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update sub-contact" });
  }
});

router.delete("/lead/:id/subcontacts/:subId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const subId  = String(req.params.subId);

    const lead = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    await prisma.subContact.delete({ where: { id: subId } });
    flushAdminClientsCache();
    invalidateCache(`csr:dashboard:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to delete sub-contact" });
  }
});

/* ================= UPDATE LEAD NOTE ================= */
router.patch("/lead/:id/note", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { comments } = req.body;
    await prisma.lead.update({
      where: { id: String(req.params.id) },
      data:  { comments: comments ?? "" },
    });
    flushAdminClientsCache();
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to save note" });
  }
});

/* ================= ADMIN TIMESTAMPED NOTES (shared with CSR) ================= */
router.post("/lead/:id/notes", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { text } = req.body as { text: string };
    if (!text?.trim()) return res.status(400).json({ success: false, message: "Note text required" });

    const lead = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const note = await prisma.leadNote.create({ data: { text: text.trim(), leadId } });
    flushAdminClientsCache();
    invalidateCache(`csr:projects:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
    return res.json({ success: true, note });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to add note" });
  }
});

router.put("/lead/:id/notes/:noteId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { noteId } = req.params as { noteId: string };
    const { text } = req.body as { text: string };
    if (!text?.trim()) return res.status(400).json({ success: false, message: "Note text required" });

    const note = await prisma.leadNote.findFirst({ where: { id: noteId, leadId } });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });

    const updated = await prisma.leadNote.update({ where: { id: noteId }, data: { text: text.trim() } });
    flushAdminClientsCache();
    return res.json({ success: true, note: updated });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update note" });
  }
});

router.delete("/lead/:id/notes/:noteId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { noteId } = req.params as { noteId: string };

    const note = await prisma.leadNote.findFirst({ where: { id: noteId, leadId } });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });

    await prisma.leadNote.delete({ where: { id: noteId } });
    flushAdminClientsCache();
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to delete note" });
  }
});

/* ================= UPDATE CSR STATUS ================= */
router.put(
  "/csr-status/:id",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const id = String(req.params.id);
      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false",
        });
      }

      const existingCSR = await prisma.user.findUnique({
        where: { id },
      });

      if (!existingCSR) {
        return res.status(404).json({
          success: false,
          message: "CSR not found",
        });
      }

      const csr = await prisma.user.update({
        where: { id },
        data: { isActive },
        select: { id: true, name: true, email: true, isActive: true },
      });

      invalidateCache("admin:csrs");
      return res.json({
        success: true,
        message: `CSR ${csr.isActive ? "activated" : "deactivated"} successfully`,
        csr,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Failed to update CSR status",
      });
    }
  }
);

/* ================= CSR HISTORY ================= */
router.get(
  "/csr-history/:csrId",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const csrId = String(req.params.csrId);

      const csr = await prisma.user.findUnique({
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

      const leads = await prisma.lead.findMany({
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

      const completed = leads.filter(
        (l) => l.status?.toLowerCase() === "completed"
      ).length;

      const pending = leads.filter(
        (l) => l.status?.toLowerCase() === "pending"
      ).length;

      const important = leads.filter(
        (l) => l.important === true || l.status?.toLowerCase() === "important"
      ).length;

      const interested = leads.filter(
        (l) =>
          l.interested === true || l.status?.toLowerCase() === "interested"
      ).length;

      const projectWon = leads.filter(
        (l) => l.status?.toLowerCase() === "close client"
      ).length;

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
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch CSR history",
      });
    }
  }
);

/* ================= ALL ACTIVE PROJECT LEADS (all CSRs) ================= */
router.get("/projects", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const csrId = typeof req.query.csrId === "string" ? req.query.csrId : undefined;
    const from  = typeof req.query.from === "string" ? req.query.from.trim() : undefined;
    const to    = typeof req.query.to   === "string" ? req.query.to.trim()   : undefined;
    const lite  = req.query.lite === "1" || req.query.lite === "true";
    const limit = Math.min(50, Math.max(0, parseInt(String(req.query.limit ?? "0"), 10) || 0));

    const where = buildProjectLeadWhere(csrId);

    const include = lite
      ? {
          csr: { select: { id: true, name: true, email: true, csrCode: true } },
          uploadFile: { select: { companyName: true } },
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
          notes: { orderBy: { createdAt: "asc" as const } },
        };

    const rawLeads = await prisma.lead.findMany({
      where,
      include,
      orderBy: { updatedAt: "desc" },
      ...(lite && limit > 0 ? { take: Math.max(limit * 3, limit) } : {}),
    });

    let leads = rawLeads.filter(isDisplayableProjectLead);
    if (lite && limit > 0) leads = leads.slice(0, limit);

    if (from || to) {
      leads = leads.filter((l) => {
        const dateStr = l.projectDeadline
          ? new Date(l.projectDeadline).toISOString().split("T")[0]
          : new Date(l.updatedAt).toISOString().split("T")[0];
        if (from && dateStr < from) return false;
        if (to && dateStr > to) return false;
        return true;
      });
    }

    const now = new Date();

    const stats = {
      total: lite
        ? await prisma.lead.count({ where })
        : leads.length,
      withBudget: leads.filter((l) => l.projectBudget).length,
      thisMonth: leads.filter((l) => {
        const d = new Date(l.updatedAt);
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }).length,
    };

    return res.json({
      success: true,
      leads,
      stats,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
});

/* ================= LOOKUP CLIENT BY PHONE (ADMIN) ================= */
router.get("/lookup-by-phone", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const phone = (req.query.phone as string)?.trim();
    if (!phone || normalizePhone(phone).length < 7) {
      return res.json({ success: true, found: false });
    }
    const matches = await findLeadsByPhone(phone);
    return res.json(buildPhoneLookupResponse(matches));
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to lookup client" });
  }
});

/* ================= ADD PROJECT (ADMIN) ================= */
router.post("/project", verifyToken, allowRoles("admin"), async (req: AuthRequest, res) => {
  try {
    const body = req.body as Record<string, unknown>;
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
    let source: string | null = null;

    if (rawCsrId && rawCsrId !== CSR_OTHER) {
      const csr = await prisma.user.findFirst({
        where: { id: rawCsrId, role: "csr", isActive: true },
        select: { id: true },
      });
      if (!csr) {
        return res.status(400).json({ success: false, message: "Invalid or inactive CSR." });
      }
      assignTo = csr.id;
    } else if (rawCsrId === CSR_OTHER) {
      if (!sourceText) {
        return res.status(400).json({
          success: false,
          message: "Please enter the external resource name for Other.",
        });
      }
      source = sourceText;
    } else if (sourceText) {
      source = sourceText;
    }

    const createData: Record<string, unknown> = {};
    applyProjectPayload(createData, body);
    createData.assignedTo = assignTo;
    createData.projectSource = source;
    createData.status = body.status ?? "Close Client";
    createData.important = false;
    createData.interested = false;

    const trimmedPhone = typeof body.phone === "string" ? body.phone.trim() : null;
    if (trimmedPhone) createData.phone = trimmedPhone;
    const existingLeads = trimmedPhone ? await findLeadsByPhone(trimmedPhone) : [];
    createData.isOldClient = existingLeads.length > 0;

    const lead = await prisma.lead.create({
      data: createData as Parameters<typeof prisma.lead.create>[0]["data"],
      include: {
        csr: { select: { id: true, name: true, email: true, csrCode: true } },
      },
    });

    flushAdminClientsCache();
    if (assignTo !== adminId) {
      invalidateCache(`csr:dashboard:${assignTo}`, `csr:projects:${assignTo}`, `csr:leads:${assignTo}`);
    }
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to create project" });
  }
});

/* ================= UPDATE PROJECT (ADMIN) ================= */
router.put("/project/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const updateData: Record<string, unknown> = {};

    applyProjectPayload(updateData, req.body as Record<string, unknown>);
    if (req.body.assignedTo !== undefined) updateData.assignedTo = req.body.assignedTo;

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data:  updateData,
      include: {
        csr: { select: { id: true, name: true, email: true, csrCode: true } },
        notes: { orderBy: { createdAt: "asc" } },
      },
    });

    flushAdminClientsCache();
    invalidateCache(`csr:projects:${lead.assignedTo}`);

    return res.json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update project" });
  }
});

/* ================= SHUFFLE STATUS ================= */
router.get(
  "/shuffle-status",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const notCompleted = await prisma.lead.findMany({
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

      const csrs = await prisma.user.findMany({
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
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch shuffle status",
      });
    }
  }
);

/* ================= RESET A SINGLE CSR'S LEADS ================= */
router.delete(
  "/csr-leads/:csrId",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const csrId = String(req.params.csrId);

      const csr = await prisma.user.findUnique({
        where: { id: csrId },
        select: { id: true, name: true, role: true },
      });

      if (!csr) {
        return res.status(404).json({ success: false, message: "CSR not found" });
      }

      if (csr.role !== "csr") {
        return res.status(400).json({ success: false, message: "User is not a CSR" });
      }

      /* Permanently purge all lead data for this CSR from DB */
      const purged = await purgeCsrLeads(csrId);

      flushAdminClientsCache();
      invalidateCache("admin:csrs", `csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
      return res.json({
        success: true,
        message: `Removed all data for ${csr.name} from database`,
        deleted: purged.leadsDeleted,
        purged,
        csrName: csr.name,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: "Failed to reset CSR data" });
    }
  }
);

/* ================= RUN SHUFFLE MANUALLY ================= */
router.post(
  "/run-shuffle",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      console.log("[TEST Shuffle] Manual trigger by admin");

      const csrs = await prisma.user.findMany({
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

      const notCompleted = await prisma.lead.findMany({
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
      const details: string[] = [];

      const byCSR = new Map<string, typeof notCompleted>();

      for (const lead of notCompleted) {
        const key = lead.assignedTo;

        if (!byCSR.has(key)) {
          byCSR.set(key, []);
        }

        byCSR.get(key)!.push(lead);
      }

      const deleteIds: string[] = [];
      const updateOps: Promise<unknown>[] = [];

      for (const [csrId, leads] of byCSR.entries()) {
        const toDelete  = leads.filter((l) => l.shuffleAttempts >= 2);
        const toShuffle = leads.filter((l) => l.shuffleAttempts < 2);

        for (const lead of toDelete) {
          deleteIds.push(lead.id);
          deleted++;
          details.push(`Deleted: "${lead.name}" because 3 attempts completed`);
        }

        if (toShuffle.length === 0) continue;

        const otherCSRs = csrs.filter((c) => c.id !== csrId);
        if (otherCSRs.length === 0) continue;

        const fromName = csrs.find((c) => c.id === csrId)?.name ?? csrId;

        for (let i = 0; i < toShuffle.length; i++) {
          const lead    = toShuffle[i];
          const target  = otherCSRs[i % otherCSRs.length];
          const attempt = lead.shuffleAttempts + 1;

          updateOps.push(
            prisma.lead.update({
              where: { id: lead.id },
              data: {
                assignedTo:      target.id,
                shuffleAttempts: attempt,
                status:          "pending",
                followUpNotes:   [
                  lead.followUpNotes,
                  `[Attempt ${attempt}/3] ${fromName} → ${target.name} on ${new Date().toLocaleDateString()}`,
                ].filter(Boolean).join("\n"),
              },
            })
          );

          shuffled++;
          details.push(`"${lead.name}" moved from ${fromName} to ${target.name} attempt ${attempt}/3`);
        }
      }

      /* ── BATCH: 1 deleteMany + parallel updates ── */
      await Promise.all([
        deleteIds.length
          ? prisma.lead.deleteMany({ where: { id: { in: deleteIds } } })
          : Promise.resolve(),
        ...updateOps,
      ]);

      flushAdminClientsCache();
      return res.json({
        success: true,
        shuffled,
        deleted,
        details,
        message: `Done — Shuffled: ${shuffled}, Deleted: ${deleted}`,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Shuffle failed",
      });
    }
  }
);

/* ================= ADMIN BIN (all not-picked + not-interested leads) ================= */

router.get("/bin", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const csrId = typeof req.query.csrId === "string" ? req.query.csrId : undefined;
    const cacheKey = csrId ? `admin:bin:${csrId}` : "admin:bin";

    const cached = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const leads = await prisma.lead.findMany({
      where: buildBinWhere(csrId),
      include: {
        csr:        { select: { id: true, name: true, csrCode: true } },
        uploadFile: { select: CSR_UPLOAD_FILE_SELECT },
      },
      orderBy: { updatedAt: "desc" },
    });

    const payload = { success: true, leads };
    setCache(cacheKey, payload, 30_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch bin" });
  }
});

/* ================= REASSIGN LEAD TO SPECIFIC CSR (ADMIN) ================= */

router.put("/lead/:id/reassign", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { csrId } = req.body;

    if (!csrId) return res.status(400).json({ success: false, message: "CSR ID is required" });

    const targetCsr = await prisma.user.findFirst({ where: { id: csrId, role: "csr" } });
    if (!targetCsr) return res.status(404).json({ success: false, message: "CSR not found" });

    const existing = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!existing) return res.status(404).json({ success: false, message: "Lead not found" });

    const prevCsrId = existing.assignedTo;

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data:  {
        assignedTo:        csrId,
        inBin:             false,
        binReason:         null,
        binPreviousStatus: null,
      },
    });

    flushAdminClientsCache();
    invalidatePattern("admin:bin");
    invalidateCache(
      `csr:dashboard:${csrId}`,
      `csr:leads:${csrId}`,
      `csr:not-interested:${csrId}`,
      `csr:bin:${csrId}`,
      `csr:dashboard:${prevCsrId}`,
      `csr:leads:${prevCsrId}`,
      `csr:not-interested:${prevCsrId}`,
      `csr:bin:${prevCsrId}`,
    );
    return res.json({ success: true, lead, message: `Lead reassigned to ${targetCsr.name}` });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to reassign lead" });
  }
});

/* ================= UPLOAD SOURCES (admin-only — hidden from CSR) ================= */

async function statsForSource(sourceId: string) {
  const uploads = await prisma.uploadFile.findMany({
    where:   { sourceId },
    select:  { id: true, fileName: true, totalLeads: true, companyName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const fileIds = uploads.map(u => u.id);
  const leads = fileIds.length
    ? await prisma.lead.findMany({
        where:   { uploadedFileId: { in: fileIds } },
        select:  { status: true },
      })
    : [];

  return {
    stats:   countLeadStatuses(leads),
    uploads,
  };
}

router.get("/upload-sources", verifyToken, allowRoles("admin", "manager"), async (_req, res) => {
  try {
    const sources = await prisma.uploadSource.findMany({ orderBy: { name: "asc" } });

    const enriched = await Promise.all(
      sources.map(async (src) => {
        const { stats, uploads } = await statsForSource(src.id);
        return {
          id:          src.id,
          name:        src.name,
          sudoName:    src.sudoName,
          createdAt:   src.createdAt,
          uploadCount: uploads.length,
          lastUpload:  uploads[0]?.createdAt ?? null,
          stats,
        };
      })
    );

    return res.json({ success: true, sources: enriched });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch upload sources" });
  }
});

router.post("/upload-sources", verifyToken, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    const sudoNameRaw = String(req.body.sudoName ?? "").trim();
    const sudoName = sudoNameRaw || null;
    if (!name) {
      return res.status(400).json({ success: false, message: "Source name is required" });
    }

    const existing = await prisma.uploadSource.findUnique({ where: { name } });
    if (existing) {
      if (sudoName && existing.sudoName !== sudoName) {
        const updated = await prisma.uploadSource.update({
          where: { id: existing.id },
          data:  { sudoName },
        });
        return res.json({ success: true, source: updated, created: false, updated: true });
      }
      return res.json({ success: true, source: existing, created: false });
    }

    const source = await prisma.uploadSource.create({ data: { name, sudoName } });
    return res.json({ success: true, source, created: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to create upload source" });
  }
});

router.get("/upload-sources/:sourceId", verifyToken, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const sourceId = String(req.params.sourceId);
    const source = await prisma.uploadSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return res.status(404).json({ success: false, message: "Source not found" });
    }

    const { stats, uploads } = await statsForSource(sourceId);

    const leads = uploads.length
      ? await prisma.lead.findMany({
          where:   { uploadedFileId: { in: uploads.map(u => u.id) } },
          select:  {
            id: true, name: true, phone: true, email: true, status: true,
            company: true, interestedService: true, updatedAt: true,
            csr: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take:    200,
        })
      : [];

    return res.json({
      success: true,
      source:  { id: source.id, name: source.name, sudoName: source.sudoName, createdAt: source.createdAt },
      stats,
      uploads,
      leads,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch source details" });
  }
});

/* ================= ACCESS HISTORY (IP / device) ================= */
router.get("/access-history/:userId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const userId = typeof req.params.userId === "string"
      ? req.params.userId
      : req.params.userId?.[0];
    if (!userId) {
      return res.status(400).json({ success: false, message: "User id required." });
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const history = await prisma.accessHistory.findMany({
      where:   { userId },
      orderBy: { createdAt: "desc" },
      take:    limit,
      select: {
        id: true, event: true, ip: true, deviceId: true,
        browser: true, userAgent: true, createdAt: true,
      },
    });
    return res.json({ success: true, history });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch access history" });
  }
});

router.patch("/upload-sources/:sourceId", verifyToken, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const sourceId = String(req.params.sourceId);
    const existing = await prisma.uploadSource.findUnique({ where: { id: sourceId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Source not found" });
    }

    const nameRaw = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    const sudoNameRaw = req.body.sudoName !== undefined ? String(req.body.sudoName).trim() : undefined;

    if (nameRaw !== undefined && !nameRaw) {
      return res.status(400).json({ success: false, message: "Source name cannot be empty" });
    }

    if (nameRaw && nameRaw !== existing.name) {
      const conflict = await prisma.uploadSource.findUnique({ where: { name: nameRaw } });
      if (conflict) {
        return res.status(409).json({ success: false, message: "A source with this name already exists" });
      }
    }

    const source = await prisma.uploadSource.update({
      where: { id: sourceId },
      data: {
        ...(nameRaw !== undefined ? { name: nameRaw } : {}),
        ...(sudoNameRaw !== undefined ? { sudoName: sudoNameRaw || null } : {}),
      },
    });

    return res.json({ success: true, source });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update upload source" });
  }
});

router.delete("/upload-sources/:sourceId", verifyToken, allowRoles("admin", "manager"), async (req, res) => {
  try {
    const sourceId = String(req.params.sourceId);
    const existing = await prisma.uploadSource.findUnique({ where: { id: sourceId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Source not found" });
    }

    await prisma.uploadFile.updateMany({
      where: { sourceId },
      data:  { sourceId: null },
    });

    await prisma.uploadSource.delete({ where: { id: sourceId } });

    return res.json({ success: true, message: "Source deleted" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to delete upload source" });
  }
});

/* ================= RESTORE LEGACY COMMENTS → LeadNote ================= */
router.post("/migrate-legacy-notes", verifyToken, allowRoles("admin"), async (_req, res) => {
  try {
    const leads = await prisma.lead.findMany({
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
      if (lead._count.notes > 0) continue;

      const text = [lead.comments?.trim(), lead.followUpNotes?.trim()].filter(Boolean).join("\n\n");
      if (!text) continue;

      await prisma.leadNote.create({
        data: {
          leadId: lead.id,
          text,
          createdAt: lead.createdAt,
        },
      });
      migrated++;
    }

    flushAdminClientsCache();
    return res.json({
      success: true,
      message: `Restored notes on ${migrated} lead(s) from legacy comments fields`,
      migrated,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Migration failed" });
  }
});

export default router;