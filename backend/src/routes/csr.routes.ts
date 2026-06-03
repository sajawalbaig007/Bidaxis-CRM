import express from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { userBrowserMap, detectBrowser } from "../utils/sessions";

const router = express.Router();

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

/* ================= UPDATE LEAD ================= */

router.put("/lead/:id", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const {
      status, nextSchedule, nextTime, timezone, followUpNotes,
      interestedService, projectTitle, projectDeadline,
      projectBudget, projectNotes, comments,
    } = req.body;

    const updateData: Record<string, unknown> = {};

    if (status            !== undefined) updateData.status            = status;
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

    if (status !== undefined) {
      updateData.important  = status === "important";
      updateData.interested = status === "interested";
    }

    const updatedLead = await prisma.lead.update({
      where: { id: req.params.id },
      data:  updateData,
    });

    return res.json({ success: true, lead: updatedLead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update lead" });
  }
});

/* ================= HEARTBEAT ================= */
/* Accepts: userAgent (string), tabId (string) from frontend */

router.post("/heartbeat", verifyToken, allowRoles("csr"), async (req: any, res) => {
  try {
    const userId     = req.user.id;
    const userAgent  = req.body.userAgent ?? req.headers["user-agent"] ?? "";
    const tabId      = req.body.tabId      ?? "unknown";
    const openedAt   = req.body.openedAt   ?? new Date().toISOString();
    const tabVisible = req.body.tabVisible !== false; // default true
    const hiddenAt   = req.body.hiddenAt   ?? null;

    const existing = userBrowserMap.get(userId);

    userBrowserMap.set(userId, {
      browser:    detectBrowser(userAgent),
      tabId,
      openedAt,
      tabVisible,
      /* Preserve original hiddenAt — only update if:
         - going visible (clear to null)
         - going hidden for first time (set new timestamp)
         - don't overwrite on repeat heartbeats while still away */
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
    userBrowserMap.delete(req.user.id);   // clear browser info on logout
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