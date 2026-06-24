import express from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { userBrowserMap, detectBrowser } from "../utils/sessions";
import { recordHeartbeatAccess } from "../utils/accessHistory";
import { getClientIp } from "../utils/requestMeta";
import { getCache, setCache, invalidateCache, flushAdminClientsCache } from "../utils/cache";
import { normalizePhone, phonesMatch } from "../utils/phone";
import { buildProjectLeadWhere, isDisplayableProjectLead } from "../utils/projectLeads";
import {
  normalizePaymentsInput,
  parseProjectPayments,
  paidTotalFromEntries,
} from "../utils/projectPayments";
import {
  NOT_INTERESTED_LIMIT,
  NOT_PICKED_LIMIT,
  buildActiveRetryWhere,
  filterActiveLeads,
  isBinLead,
  resolveDeleteBinReason,
} from "../utils/binLeads";

const router = express.Router();

function invalidateCsrLeadCaches(csrId: string, ...extra: string[]) {
  flushAdminClientsCache();
  invalidateCache(
    `csr:dashboard:${csrId}`,
    `csr:leads:${csrId}`,
    `csr:projects:${csrId}`,
    `csr:not-interested:${csrId}`,
    `csr:bin:${csrId}`,
    "admin:bin",
    ...extra,
  );
}

async function findLeadsByPhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return [];

  const exact = await prisma.lead.findMany({
    where:   { phone: trimmed },
    orderBy: { updatedAt: "desc" },
  });
  if (exact.length > 0) return exact;

  const digits = normalizePhone(trimmed);
  if (digits.length < 7) return [];

  const suffix = digits.slice(-10);
  const candidates = await prisma.lead.findMany({
    where:   { phone: { not: null, contains: suffix } },
    orderBy: { updatedAt: "desc" },
  });
  return candidates.filter(l => l.phone && phonesMatch(l.phone, trimmed));
}

async function logStatusChange(csrId: string, leadId: string, status: string) {
  try {
    await prisma.callLog.create({ data: { leadId, csrId, status } });
  } catch (error) {
    console.log("Failed to log status change", error);
  }
}

function getActivityRange(period: string, dateStr: string) {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0] ?? new Date().getFullYear();
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;

  if (period === "week") {
    const dow = new Date(y, m - 1, d).getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const from = new Date(y, m - 1, d + diffToMon, 0, 0, 0, 0);
    const to   = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6, 23, 59, 59, 999);
    const fmt  = (dt: Date) => dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    return { from, to, label: `${fmt(from)} – ${fmt(to)} ${from.getFullYear()}` };
  }

  if (period === "month") {
    const from = new Date(y, m - 1, 1, 0, 0, 0, 0);
    const to   = new Date(y, m, 0, 23, 59, 59, 999);
    return { from, to, label: from.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) };
  }

  const from = new Date(y, m - 1, d, 0, 0, 0, 0);
  const to   = new Date(y, m - 1, d, 23, 59, 59, 999);
  return {
    from, to,
    label: from.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }),
  };
}

function aggregateLogs(logs: { status: string }[]) {
  const byStatus: Record<string, number> = {};
  for (const log of logs) {
    byStatus[log.status] = (byStatus[log.status] ?? 0) + 1;
  }
  return { total: logs.length, byStatus };
}

/* ================= CSR ACTIVITY REPORT ================= */

router.get("/activity-report", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const period = String(req.query.period ?? "day");
    const date   = String(req.query.date   ?? new Date().toISOString().split("T")[0]);

    if (!["day", "week", "month"].includes(period)) {
      return res.status(400).json({ success: false, message: "Invalid period. Use day, week, or month." });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: "Invalid date. Use YYYY-MM-DD." });
    }

    const { from, to, label } = getActivityRange(period, date);
    const logs = await prisma.callLog.findMany({
      where:   { csrId, createdAt: { gte: from, lte: to } },
      select:  { status: true },
      orderBy: { createdAt: "desc" },
    });

    const { total, byStatus } = aggregateLogs(logs);
    return res.json({ success: true, period, date, rangeLabel: label, total, byStatus });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch activity report" });
  }
});

/* ================= CSR NOTIFICATIONS ================= */

router.get("/notifications", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId = req.user.id;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const today = new Date().toISOString().split("T")[0];

    const [scheduledLeads, recentLogs] = await Promise.all([
      prisma.lead.findMany({
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
      prisma.callLog.findMany({
        where:   { csrId, createdAt: { gte: since } },
        select:  { status: true },
      }),
    ]);

    const scheduledCalls = scheduledLeads
      .filter(l => (l.nextSchedule ?? "") >= today)
      .slice(0, 20)
      .map(l => ({
        id: l.id,
        client: l.name ?? "Client",
        date: l.nextSchedule!,
        time: l.nextTime!,
        timezone: l.timezone ?? "",
        status: l.status,
      }));

    const { total, byStatus } = aggregateLogs(recentLogs);
    return res.json({
      success: true,
      scheduledCalls,
      dailyStats: { total, byStatus, periodHours: 24 },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
});

/* ================= CSR DASHBOARD ================= */

router.get("/dashboard", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId   = req.user.id;
    const cacheKey = `csr:dashboard:${csrId}`;
    const cached   = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const rawLeads = await prisma.lead.findMany({
      where:   { assignedTo: csrId },
      include: {
        uploadFile: { select: { companyName: true } },
        notes:      { select: { id: true } },   // IDs only — count badge; content fetched lazily
        // subContacts omitted — fetched on demand via GET /csr/lead/:id
      },
      orderBy: { createdAt: "desc" },
    });

    const leads = filterActiveLeads(rawLeads);

    const payload = { success: true, totalLeads: leads.length, leads };
    setCache(cacheKey, payload, 30_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch dashboard" });
  }
});

/* ================= NOT-INTERESTED / NOT-PICKED LEADS ================= */

router.get("/not-interested", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId    = req.user.id;
    const cacheKey = `csr:not-interested:${csrId}`;
    const cached   = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const rawLeads = await prisma.lead.findMany({
      where: buildActiveRetryWhere(csrId),
      include: { uploadFile: { select: { companyName: true } }, notes: { orderBy: { createdAt: "asc" } }, subContacts: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    const leads = filterActiveLeads(rawLeads);

    const payload = { success: true, leads };
    setCache(cacheKey, payload, 30_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch leads" });
  }
});

/* ================= LOOKUP CLIENT BY PHONE ================= */

router.get("/lookup-by-phone", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const phone = (req.query.phone as string)?.trim();
    if (!phone || normalizePhone(phone).length < 7) {
      return res.json({ success: true, found: false });
    }

    const matches = await findLeadsByPhone(phone);
    if (matches.length === 0) {
      return res.json({ success: true, found: false });
    }

    const latest = matches[0];
    const wonProject = matches.find(l =>
      ["Close Client", "completed"].includes(l.status ?? "")
    );

    return res.json({
      success:           true,
      found:             true,
      isReturningClient: matches.length >= 1,
      projectCount:      matches.length,
      client: {
        name:              latest.name              ?? "",
        company:           latest.company           ?? "",
        email:             latest.email             ?? "",
        state:             latest.state             ?? "",
        interestedService: wonProject?.interestedService ?? latest.interestedService ?? "",
      },
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to lookup client" });
  }
});

/* ================= ADD PROJECT MANUALLY ================= */

router.post("/project", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId = req.user.id;
    const {
      name,
      company,
      phone,
      projectTitle,
      projectCode,
      interestedService,
      projectDeadline,
      projectBudget,
      projectNotes,
      status,
    } = req.body;

    /* Validate required fields */
    if (!name || !projectTitle || !interestedService || !projectDeadline) {
      return res.status(400).json({
        success: false,
        message: "name, projectTitle, interestedService and projectDeadline are required.",
      });
    }

    const trimmedPhone = phone?.trim() || null;
    const existingLeads = trimmedPhone ? await findLeadsByPhone(trimmedPhone) : [];

    const lead = await prisma.lead.create({
      data: {
        name,
        company:           company           ?? null,
        phone:             trimmedPhone,
        status:            status            ?? "Close Client",
        projectTitle,
        projectCode:       projectCode       ?? null,
        interestedService,
        projectDeadline,
        projectBudget:     projectBudget     ?? null,
        projectNotes:      projectNotes      ?? null,
        assignedTo:        csrId,
        important:         false,
        interested:        false,
        isOldClient:       existingLeads.length > 0,
      },
    });

    invalidateCache(`csr:dashboard:${csrId}`, `csr:projects:${csrId}`, `csr:leads:${csrId}`);
    flushAdminClientsCache();
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to create project" });
  }
});

/* ================= GET SINGLE LEAD (full data — lazy load for notes/subContacts) ================= */
router.get("/lead/:id", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const leadId = req.params.id as string;

    const lead = await prisma.lead.findFirst({
      where:   { id: leadId, assignedTo: csrId },
      include: {
        uploadFile:  { select: { companyName: true } },
        notes:       { orderBy: { createdAt: "asc" } },
        subContacts: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    return res.json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch lead" });
  }
});

/* ================= UPDATE LEAD NOTE (legacy inline) ================= */
router.patch("/lead/:id/note", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const leadId = req.params.id as string;
    const { comments } = req.body;

    const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    await prisma.lead.update({ where: { id: leadId }, data: { comments: comments ?? "" } });
    invalidateCache(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:not-interested:${csrId}`);
    flushAdminClientsCache();
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to save note" });
  }
});

/* ================= ADD TIMESTAMPED NOTE ================= */
router.post("/lead/:id/notes", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const leadId = req.params.id as string;
    const { text } = req.body as { text: string };

    if (!text?.trim()) return res.status(400).json({ success: false, message: "Note text required" });

    const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const note = await prisma.leadNote.create({ data: { text: text.trim(), leadId } });
    invalidateCache(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:not-interested:${csrId}`);
    flushAdminClientsCache();
    return res.json({ success: true, note });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to add note" });
  }
});

/* ================= UPDATE NOTE ================= */
router.put("/lead/:id/notes/:noteId", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const { noteId } = req.params as { noteId: string };
    const { text } = req.body as { text: string };
    if (!text?.trim()) return res.status(400).json({ success: false, message: "Note text required" });
    const note = await prisma.leadNote.findFirst({ where: { id: noteId, lead: { assignedTo: csrId } } });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });
    const updated = await prisma.leadNote.update({ where: { id: noteId }, data: { text: text.trim() } });
    invalidateCache(`csr:leads:${csrId}`, `csr:not-interested:${csrId}`);
    flushAdminClientsCache();
    return res.json({ success: true, note: updated });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to update note" });
  }
});

/* ================= DELETE NOTE ================= */
router.delete("/lead/:id/notes/:noteId", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const { noteId } = req.params as { noteId: string };
    const note = await prisma.leadNote.findFirst({ where: { id: noteId, lead: { assignedTo: csrId } } });
    if (!note) return res.status(404).json({ success: false, message: "Note not found" });
    await prisma.leadNote.delete({ where: { id: noteId } });
    invalidateCache(`csr:leads:${csrId}`, `csr:not-interested:${csrId}`);
    flushAdminClientsCache();
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to delete note" });
  }
});

/* ================= UPDATE LEAD ================= */

router.put("/lead/:id", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const leadId = req.params.id as string;

    const {
      status, nextSchedule, nextTime, timezone, followUpNotes,
      interestedService, projectTitle, projectCode, projectDeadline,
      projectBudget, projectNotes, paidAmount, comments,
      name, phone, email, state,
      moveToBin, inBin,
    } = req.body;

    /* Fetch current lead to get existing counts */
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, assignedTo: csrId },
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    if (moveToBin === true) {
      const reason = resolveDeleteBinReason(lead.status);
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          inBin:             true,
          binReason:         reason,
          binPreviousStatus: lead.status,
          important:         false,
          interested:        false,
          status:            "pending",
        },
      });
      invalidateCsrLeadCaches(csrId);
      return res.json({ success: true, lead: updated, movedToBin: true });
    }

    if (inBin === false) {
      const restoreStatus = lead.binPreviousStatus || "pending";
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          inBin:              false,
          binReason:          null,
          binPreviousStatus:  null,
          status:             restoreStatus,
          important:          restoreStatus === "important",
          interested:         restoreStatus === "interested",
          notPickedCount:     0,
          notInterestedCount: 0,
        },
      });
      invalidateCsrLeadCaches(csrId);
      return res.json({ success: true, lead: updated, restored: true });
    }

    /* Build base update object */
    const updateData: Record<string, unknown> = {};

    if (nextSchedule      !== undefined) updateData.nextSchedule      = nextSchedule;
    if (nextTime          !== undefined) updateData.nextTime          = nextTime;
    if (timezone          !== undefined) updateData.timezone          = timezone;
    if (followUpNotes     !== undefined) updateData.followUpNotes     = followUpNotes;
    if (interestedService !== undefined) updateData.interestedService = interestedService;
    if (projectTitle      !== undefined) updateData.projectTitle      = projectTitle;
    if (projectCode       !== undefined) updateData.projectCode       = projectCode;
    if (projectDeadline   !== undefined) updateData.projectDeadline   = projectDeadline;
    if (projectBudget     !== undefined) updateData.projectBudget     = projectBudget;
    if (projectNotes      !== undefined) updateData.projectNotes      = projectNotes;
    if (paidAmount        !== undefined) updateData.paidAmount        = paidAmount;
    if (comments          !== undefined) updateData.comments          = comments;
    if (name              !== undefined) updateData.name              = name;
    if (phone             !== undefined) updateData.phone             = phone;
    if (email             !== undefined) updateData.email             = email;
    if (state             !== undefined) updateData.state             = state;
    if (req.body.ownerName        !== undefined) updateData.ownerName        = req.body.ownerName;
    if (req.body.projectScope     !== undefined) updateData.projectScope     = req.body.projectScope;
    if (req.body.projectPhase     !== undefined) updateData.projectPhase     = req.body.projectPhase;
    if (req.body.takeoffDeadline  !== undefined) updateData.takeoffDeadline  = req.body.takeoffDeadline;
    if (req.body.pricingDeadline  !== undefined) updateData.pricingDeadline  = req.body.pricingDeadline;
    if (req.body.qaDeadline       !== undefined) updateData.qaDeadline       = req.body.qaDeadline;
    if (req.body.company          !== undefined) updateData.company          = req.body.company;
    const payments = normalizePaymentsInput(req.body.projectPayments);
    if (payments !== undefined) {
      updateData.projectPayments = payments;
      updateData.paidAmount = String(paidTotalFromEntries(parseProjectPayments(payments)));
    }

    /* ── STATUS HANDLING ── */
    if (status !== undefined) {
      updateData.status = status;

      /* ── NOT INTERESTED (limit = 3) ── */
      if (status === "Not Interested") {
        const newCount = (lead.notInterestedCount ?? 0) + 1;
        updateData.notInterestedCount = newCount;
        updateData.important  = false;
        updateData.interested = false;

        const ts  = new Date().toLocaleString("en-US", { dateStyle:"medium", timeStyle:"short" });
        const tag = newCount >= NOT_INTERESTED_LIMIT ? " — LIMIT REACHED" : "";
        const entry = `[Try ${newCount}/${NOT_INTERESTED_LIMIT} · ${ts}] Not Interested${tag}`;
        updateData.followUpNotes = [lead.followUpNotes, entry].filter(Boolean).join("\n");

        if (newCount >= NOT_INTERESTED_LIMIT) {
          updateData.inBin     = true;
          updateData.binReason = "limit-not-interested";
        }

        await prisma.lead.update({ where: { id: leadId }, data: updateData });
        await logStatusChange(csrId, leadId, status);

        invalidateCsrLeadCaches(csrId);

        if (newCount >= NOT_INTERESTED_LIMIT) {
          const otherCsrs = await prisma.user.findMany({
            where: { id: { not: csrId }, role: "csr", isActive: true },
            select: { id: true, name: true, csrCode: true },
            orderBy: { csrCode: "asc" },
          });
          return res.json({
            success:           true,
            needsManualAssign: true,
            csrs:              otherCsrs,
            message:           "Limit reached. Select a CSR to reassign this lead.",
          });
        }

        return res.json({
          success:   true,
          lead:      await prisma.lead.findUnique({ where: { id: leadId } }),
          triesLeft: NOT_INTERESTED_LIMIT - newCount,
        });
      }

      /* ── NOT PICKED (limit = 7) ── */
      if (status === "not picked" || status === "not completed") {
        const newCount = (lead.notPickedCount ?? 0) + 1;
        updateData.notPickedCount = newCount;
        updateData.important  = false;
        updateData.interested = false;

        const ts  = new Date().toLocaleString("en-US", { dateStyle:"medium", timeStyle:"short" });
        const tag = newCount >= NOT_PICKED_LIMIT ? " — LIMIT REACHED" : "";
        const entry = `[Try ${newCount}/${NOT_PICKED_LIMIT} · ${ts}] Not Picked${tag}`;
        updateData.followUpNotes = [lead.followUpNotes, entry].filter(Boolean).join("\n");

        if (newCount >= NOT_PICKED_LIMIT) {
          updateData.inBin     = true;
          updateData.binReason = "limit-not-picked";
        }

        await prisma.lead.update({ where: { id: leadId }, data: updateData });
        await logStatusChange(csrId, leadId, status);

        invalidateCsrLeadCaches(csrId);

        if (newCount >= NOT_PICKED_LIMIT) {
          const otherCsrs = await prisma.user.findMany({
            where: { id: { not: csrId }, role: "csr", isActive: true },
            select: { id: true, name: true, csrCode: true },
            orderBy: { csrCode: "asc" },
          });
          return res.json({
            success:           true,
            needsManualAssign: true,
            csrs:              otherCsrs,
            message:           "Limit reached. Select a CSR to reassign this lead.",
          });
        }

        return res.json({
          success:   true,
          lead:      await prisma.lead.findUnique({ where: { id: leadId } }),
          triesLeft: NOT_PICKED_LIMIT - newCount,
        });
      }

      /* ── IMPORTANT ── */
      if (status === "important") {
        updateData.important  = true;
        updateData.interested = false;
        /* Direct "Important" (not Schedule Call) → important-only bucket for admin */
        if (nextSchedule === undefined && nextTime === undefined) {
          updateData.nextSchedule = null;
          updateData.nextTime     = null;
        }
      }

      /* ── INTERESTED ── */
      if (status === "interested") {
        updateData.important  = false;
        updateData.interested = true;
      }

      /* ── OTHER (pending, Close Client, etc.) ── */
      if (["pending", "Close Client", "completed"].includes(status)) {
        updateData.important  = false;
        updateData.interested = false;
      }

      /* ── AUTO isOldClient when Close Client ── */
      if (status === "Close Client" || status === "completed") {
        const company = lead.company?.trim().toLowerCase();
        if (company) {
          const previousWin = await prisma.lead.findFirst({
            where: {
              id:      { not: leadId },
              company: { equals: lead.company ?? "", mode: "insensitive" },
              status:  { in: ["Close Client", "completed"] },
            },
          });
          updateData.isOldClient = !!previousWin;
        } else {
          updateData.isOldClient = false;
        }

        /* ── AUTO clientCode: {csrCode}-{padded_seq} ── */
        if (!lead.clientCode) {
          const csr = await prisma.user.findUnique({
            where:  { id: csrId },
            select: { csrCode: true },
          });
          if (csr?.csrCode) {
            const wonCount = await prisma.lead.count({
              where: {
                assignedTo: csrId,
                status:     { in: ["Close Client", "completed"] },
                clientCode: { not: null },
              },
            });
            const seq = String(wonCount + 1).padStart(2, "0");
            updateData.clientCode = `${csr.csrCode}-${seq}`;
          }
        }
      }
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data:  updateData,
    });

    if (status !== undefined && status !== lead.status) {
      await logStatusChange(csrId, leadId, status);
    }

    invalidateCsrLeadCaches(csrId);
    return res.json({ success: true, lead: updatedLead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update lead" });
  }
});

/* ================= CREATE LEAD (CSR manual add) ================= */

router.post("/lead", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId = req.user.id;
    const { name, phone, company, interestedService, comments } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: "Client name is required." });
    }

    const lead = await prisma.lead.create({
      data: {
        name:              name.trim(),
        phone:             phone?.trim()             || null,
        company:           company?.trim()           || null,
        interestedService: interestedService?.trim() || null,
        comments:          comments?.trim()          || null,
        status:            "pending",
        assignedTo:        csrId,
        important:         false,
        interested:        false,
      },
    });

    flushAdminClientsCache();
    return res.status(201).json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to create lead" });
  }
});

/* ================= CSR LEADS (new vs returning) ================= */

router.get("/leads", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId   = req.user.id;
    const cacheKey = `csr:leads:${csrId}`;
    const cached   = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const rawLeads = await prisma.lead.findMany({
      where:   { assignedTo: csrId },
      include: { uploadFile: { select: { companyName: true } }, notes: { orderBy: { createdAt: "asc" } }, subContacts: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    const csrLeads = filterActiveLeads(rawLeads);

    const phones = [...new Set(csrLeads.map(l => l.phone).filter((p): p is string => !!p))];

    const phoneCountMap = new Map<string, number>();
    if (phones.length > 0) {
      const allWithPhone = await prisma.lead.findMany({
        where:  { phone: { in: phones } },
        select: { phone: true },
      });
      for (const l of allWithPhone) {
        if (l.phone) phoneCountMap.set(l.phone, (phoneCountMap.get(l.phone) ?? 0) + 1);
      }
    }

    const leads = csrLeads.map(lead => ({
      ...lead,
      isOldClient: lead.isOldClient || !!(lead.phone && (phoneCountMap.get(lead.phone) ?? 0) > 1),
    }));

    const payload = { success: true, leads };
    setCache(cacheKey, payload, 30_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch leads" });
  }
});

/* ================= CSR PROJECTS ================= */

router.get("/projects", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId   = req.user.id;
    const cacheKey = `csr:projects:${csrId}`;
    const cached   = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const rawLeads = await prisma.lead.findMany({
      where: buildProjectLeadWhere(csrId),
      include: { uploadFile: { select: { companyName: true } }, notes: { orderBy: { createdAt: "asc" } }, subContacts: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    const leads = rawLeads.filter(isDisplayableProjectLead);

    const payload = { success: true, leads };
    setCache(cacheKey, payload, 30_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch projects" });
  }
});

/* ================= LIST OTHER ACTIVE CSRs (for manual assign popup) ================= */

router.get("/csrs", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId = req.user.id;
    const csrs  = await prisma.user.findMany({
      where:   { id: { not: csrId }, role: "csr", isActive: true },
      select:  { id: true, name: true, csrCode: true },
      orderBy: { csrCode: "asc" },
    });
    return res.json({ success: true, csrs });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to fetch CSRs" });
  }
});

/* ================= MANUALLY ASSIGN LEAD TO SPECIFIC CSR ================= */

router.put("/lead/:id/assign", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId       = req.user.id;
    const leadId      = req.params.id as string;
    const { csrId: targetCsrId } = req.body;

    if (!targetCsrId) {
      return res.status(400).json({ success: false, message: "Target CSR ID is required" });
    }

    const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const targetCsr = await prisma.user.findFirst({
      where: { id: targetCsrId, role: "csr", isActive: true },
    });
    if (!targetCsr) return res.status(404).json({ success: false, message: "Target CSR not found" });

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        assignedTo:         targetCsrId,
        status:             "pending",
        notInterestedCount: 0,
        notPickedCount:     0,
        important:          false,
        interested:         false,
        inBin:              false,
        binReason:          null,
        binPreviousStatus:  null,
      },
    });

    invalidateCsrLeadCaches(csrId, `csr:dashboard:${targetCsrId}`, `csr:leads:${targetCsrId}`, `csr:bin:${targetCsrId}`);
    return res.json({ success: true, message: `Lead assigned to ${targetCsr.name}` });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to assign lead" });
  }
});

/* ================= CSR BIN (not-picked leads) ================= */

router.get("/bin", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId    = req.user.id;
    const cacheKey = `csr:bin:${csrId}`;
    const cached   = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const rawLeads = await prisma.lead.findMany({
      where:   { assignedTo: csrId },
      include: { uploadFile: { select: { companyName: true } }, notes: { orderBy: { createdAt: "asc" } }, subContacts: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    });

    const leads = rawLeads.filter(isBinLead);

    const payload = { success: true, leads };
    setCache(cacheKey, payload, 30_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch bin" });
  }
});

/* ================= SUB-CONTACTS ================= */

router.post("/lead/:id/subcontacts", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const leadId = req.params.id as string;
    const { name, designation, phone, email } = req.body as { name: string; designation?: string; phone?: string; email?: string };

    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });

    const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const subContact = await prisma.subContact.create({
      data: { leadId, name: name.trim(), designation: designation?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null },
    });
    invalidateCache(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
    return res.status(201).json({ success: true, subContact });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to add sub-contact" });
  }
});

router.delete("/lead/:id/subcontacts/:subId", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const leadId = req.params.id as string;
    const subId  = req.params.subId as string;

    const lead = await prisma.lead.findFirst({ where: { id: leadId, assignedTo: csrId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    await prisma.subContact.delete({ where: { id: subId } });
    invalidateCache(`csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to delete sub-contact" });
  }
});

/* ================= HEARTBEAT ================= */

router.post("/heartbeat", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const userId     = req.user.id;
    const userAgent  = req.body.userAgent ?? req.headers["user-agent"] ?? "";
    const tabId      = req.body.tabId      ?? "unknown";
    const openedAt   = req.body.openedAt   ?? new Date().toISOString();
    const tabVisible = req.body.tabVisible !== false;
    const hiddenAt   = req.body.hiddenAt   ?? null;

    const existing = userBrowserMap.get(userId);

    userBrowserMap.set(userId, {
      browser:    detectBrowser(userAgent),
      tabId,
      openedAt,
      tabVisible,
      hiddenAt: tabVisible
        ? null
        : (existing?.hiddenAt ?? hiddenAt ?? new Date().toISOString()),
    });

    await prisma.user.update({
      where: { id: userId },
      data:  { isOnline: true, lastActive: new Date() },
    });

    void recordHeartbeatAccess({
      userId,
      ip:        getClientIp(req),
      userAgent: userAgent,
      deviceId:  tabId,
    });

    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false });
  }
});

/* ================= OFFLINE ================= */

router.post("/offline", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    userBrowserMap.delete(req.user.id);
    await prisma.user.update({
      where: { id: req.user.id },
      data:  { isOnline: false },
    });
    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false });
  }
});

export default router;