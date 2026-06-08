import { Response } from "express";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* ─── LIMITS ─── */
const NOT_INTERESTED_LIMIT = 7;
const NOT_PICKED_LIMIT     = 3;

/* ─── Helper: pick a random OTHER CSR and reassign the lead ─── */
async function redistributeLead(leadId: string, currentCsrId: string) {
  /* Get all active CSR users except the current one */
  const otherCsrs = await prisma.user.findMany({
    where: {
      id:   { not: currentCsrId },
      role: "csr",               // adjust if your role field is different
    },
    select: { id: true },
  });

  if (otherCsrs.length === 0) return; // no one else to assign to

  const randomCsr = otherCsrs[Math.floor(Math.random() * otherCsrs.length)];

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      assignedTo:          randomCsr.id,
      status:              "pending",          // reset so new CSR sees it fresh
      notInterestedCount:  0,                  // reset counter
      notPickedCount:      0,
    },
  });
}

/* ================= GET DASHBOARD ================= */

export const getCSRDashboard = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const latestFile = await prisma.uploadFile.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!latestFile) return res.json({ success: true, leads: [] });

    const leads = await prisma.lead.findMany({
      where: { assignedTo: req.user.id, uploadedFileId: latestFile.id },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, leads });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= GET NOT-INTERESTED / NOT-PICKED LEADS ================= */
/* Used by the new "Not Interested" sidebar page */

export const getNotInterestedLeads = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const leads = await prisma.lead.findMany({
      where: {
        assignedTo: req.user.id,
        status: { in: ["Not Interested", "not picked", "completed", "not completed"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    return res.json({ success: true, leads });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= UPDATE LEAD ================= */

export const updateLead = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const id = req.params.id as string;
    const {
      status,
      nextSchedule,
      nextTime,
      timezone,
      followUpNotes,
      comments,
      interestedService,
      projectTitle,
      projectDeadline,
      projectBudget,
      projectNotes,
    } = req.body;

    /* Verify lead belongs to this CSR */
    const lead = await prisma.lead.findFirst({
      where: { id, assignedTo: req.user.id },
    });

    if (!lead)
      return res.status(404).json({ success: false, message: "Lead not found" });

    /* Build update object */
    const updateData: Record<string, unknown> = {};

    if (nextSchedule  !== undefined) updateData.nextSchedule      = nextSchedule;
    if (nextTime      !== undefined) updateData.nextTime          = nextTime;
    if (timezone      !== undefined) updateData.timezone          = timezone;
    if (followUpNotes !== undefined) updateData.followUpNotes     = followUpNotes;
    if (comments      !== undefined) updateData.comments          = comments;
    if (interestedService !== undefined) updateData.interestedService = interestedService;
    if (projectTitle    !== undefined) updateData.projectTitle    = projectTitle;
    if (projectDeadline !== undefined) updateData.projectDeadline = projectDeadline;
    if (projectBudget   !== undefined) updateData.projectBudget   = projectBudget;
    if (projectNotes    !== undefined) updateData.projectNotes    = projectNotes;

    /* ── STATUS LOGIC WITH TRY LIMITS ── */
    if (status !== undefined) {
      updateData.status = status;

      /* ─ NOT INTERESTED (limit = 7) ─ */
      if (status === "Not Interested" || status === "completed") {
        const newCount = (lead.notInterestedCount ?? 0) + 1;
        updateData.notInterestedCount = newCount;
        updateData.important  = false;
        updateData.interested = false;

        /* Save first, then redistribute if limit reached */
        await prisma.lead.update({ where: { id }, data: updateData });

        if (newCount >= NOT_INTERESTED_LIMIT) {
          await redistributeLead(id, req.user.id);
          return res.json({
            success:      true,
            redistributed: true,
            message:      `Lead reached ${NOT_INTERESTED_LIMIT} "Not Interested" attempts and has been reassigned to another CSR.`,
          });
        }

        return res.json({
          success: true,
          lead: await prisma.lead.findUnique({ where: { id } }),
          triesLeft: NOT_INTERESTED_LIMIT - newCount,
        });
      }

      /* ─ NOT PICKED (limit = 3) ─ */
      if (status === "not picked" || status === "not completed") {
        const newCount = (lead.notPickedCount ?? 0) + 1;
        updateData.notPickedCount = newCount;
        updateData.important  = false;
        updateData.interested = false;

        await prisma.lead.update({ where: { id }, data: updateData });

        if (newCount >= NOT_PICKED_LIMIT) {
          await redistributeLead(id, req.user.id);
          return res.json({
            success:      true,
            redistributed: true,
            message:      `Lead reached ${NOT_PICKED_LIMIT} "Not Picked" attempts and has been reassigned to another CSR.`,
          });
        }

        return res.json({
          success: true,
          lead: await prisma.lead.findUnique({ where: { id } }),
          triesLeft: NOT_PICKED_LIMIT - newCount,
        });
      }

      /* ─ IMPORTANT ─ */
      if (status === "important") {
        updateData.important  = true;
        updateData.interested = false;
      }

      /* ─ INTERESTED ─ */
      if (status === "interested") {
        updateData.important  = false;
        updateData.interested = true;
      }

      /* ─ OTHER (pending, Close Client, etc.) ─ */
      if (["pending", "Close Client"].includes(status)) {
        updateData.important  = false;
        updateData.interested = false;
      }
    }

    const updated = await prisma.lead.update({ where: { id }, data: updateData });
    return res.json({ success: true, lead: updated });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};