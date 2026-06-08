import express from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { userBrowserMap, detectBrowser } from "../utils/sessions";

const router = express.Router();

/* ─── LIMITS ─── */
const NOT_INTERESTED_LIMIT = 7;
const NOT_PICKED_LIMIT     = 3;

/* ─── Helper: redistribute lead to a random other CSR ─── */
async function redistributeLead(leadId: string, currentCsrId: string) {
  const otherCsrs = await prisma.user.findMany({
    where: { id: { not: currentCsrId }, role: "csr", isActive: true },
    select: { id: true },
  });
  if (otherCsrs.length === 0) return false;

  const randomCsr = otherCsrs[Math.floor(Math.random() * otherCsrs.length)];

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      assignedTo:         randomCsr.id,
      status:             "pending",
      notInterestedCount: 0,
      notPickedCount:     0,
      important:          false,
      interested:         false,
    },
  });
  return true;
}

/* ================= CSR DASHBOARD ================= */

router.get("/dashboard", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId = req.user.id;

    const leads = await prisma.lead.findMany({
      where:   { assignedTo: csrId },
      include: { uploadFile: { select: { companyName: true } } },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, totalLeads: leads.length, leads });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch dashboard" });
  }
});

/* ================= NOT-INTERESTED / NOT-PICKED LEADS ================= */

router.get("/not-interested", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId = req.user.id;

    const leads = await prisma.lead.findMany({
      where: {
        assignedTo: csrId,
        status: { in: ["Not Interested", "not picked", "completed", "not completed"] },
      },
      include: { uploadFile: { select: { companyName: true } } },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ success: true, leads });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch leads" });
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

    const lead = await prisma.lead.create({
      data: {
        name,
        company:           company           ?? null,
        phone:             phone             ?? null,
        status:            status            ?? "Close Client",
        projectTitle,
        interestedService,
        projectDeadline,
        projectBudget:     projectBudget     ?? null,
        projectNotes:      projectNotes      ?? null,
        assignedTo:        csrId,
        important:         false,
        interested:        false,
        /* uploadedFileId intentionally null — manually added project */
      },
    });

    return res.status(201).json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to create project" });
  }
});

/* ================= UPDATE LEAD ================= */

router.put("/lead/:id", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const csrId  = req.user.id;
    const leadId = req.params.id as string;

    const {
      status, nextSchedule, nextTime, timezone, followUpNotes,
      interestedService, projectTitle, projectDeadline,
      projectBudget, projectNotes, comments,
    } = req.body;

    /* Fetch current lead to get existing counts */
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, assignedTo: csrId },
    });

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    /* Build base update object */
    const updateData: Record<string, unknown> = {};

    if (nextSchedule      !== undefined) updateData.nextSchedule      = nextSchedule;
    if (nextTime          !== undefined) updateData.nextTime          = nextTime;
    if (timezone          !== undefined) updateData.timezone          = timezone;
    if (followUpNotes     !== undefined) updateData.followUpNotes     = followUpNotes;
    if (interestedService !== undefined) updateData.interestedService = interestedService;
    if (projectTitle      !== undefined) updateData.projectTitle      = projectTitle;
    if (projectDeadline   !== undefined) updateData.projectDeadline   = projectDeadline;
    if (projectBudget     !== undefined) updateData.projectBudget     = projectBudget;
    if (projectNotes      !== undefined) updateData.projectNotes      = projectNotes;
    if (comments          !== undefined) updateData.comments          = comments;

    /* ── STATUS HANDLING ── */
    if (status !== undefined) {
      updateData.status = status;

      /* ── NOT INTERESTED (limit = 7) ── */
      if (status === "Not Interested" || status === "completed") {
        const newCount = (lead.notInterestedCount ?? 0) + 1;
        updateData.notInterestedCount = newCount;
        updateData.important  = false;
        updateData.interested = false;

        await prisma.lead.update({ where: { id: leadId }, data: updateData });

        if (newCount >= NOT_INTERESTED_LIMIT) {
          await redistributeLead(leadId, csrId);
          return res.json({
            success:       true,
            redistributed: true,
            message:       `Lead marked "Not Interested" ${NOT_INTERESTED_LIMIT} times and reassigned to another CSR.`,
          });
        }

        return res.json({
          success:   true,
          lead:      await prisma.lead.findUnique({ where: { id: leadId } }),
          triesLeft: NOT_INTERESTED_LIMIT - newCount,
        });
      }

      /* ── NOT PICKED (limit = 3) ── */
      if (status === "not picked" || status === "not completed") {
        const newCount = (lead.notPickedCount ?? 0) + 1;
        updateData.notPickedCount = newCount;
        updateData.important  = false;
        updateData.interested = false;

        await prisma.lead.update({ where: { id: leadId }, data: updateData });

        if (newCount >= NOT_PICKED_LIMIT) {
          await redistributeLead(leadId, csrId);
          return res.json({
            success:       true,
            redistributed: true,
            message:       `Lead marked "Not Picked" ${NOT_PICKED_LIMIT} times and reassigned to another CSR.`,
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
      }

      /* ── INTERESTED ── */
      if (status === "interested") {
        updateData.important  = false;
        updateData.interested = true;
      }

      /* ── OTHER (pending, Close Client, etc.) ── */
      if (["pending", "Close Client"].includes(status)) {
        updateData.important  = false;
        updateData.interested = false;
      }
    }

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data:  updateData,
    });

    return res.json({ success: true, lead: updatedLead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update lead" });
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