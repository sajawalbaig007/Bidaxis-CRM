import { Response } from "express";
import prisma from "../config/db";
import { AuthRequest } from "../middleware/auth.middleware";

/* ================= GET DASHBOARD ================= */

export const getCSRDashboard = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const latestFile = await prisma.uploadFile.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!latestFile) {
      return res.json({ success: true, leads: [] });
    }

    const leads = await prisma.lead.findMany({
      where: {
        assignedTo: req.user.id,
        uploadedFileId: latestFile.id,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ success: true, leads });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ================= UPDATE LEAD ================= */

export const updateLead = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const id = req.params.id as string;
    const {
      status,
      nextSchedule,
      nextTime,
      timezone,
      followUpNotes,
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

    if (!lead) {
      return res.status(404).json({ success: false, message: "Lead not found" });
    }

    /* Build update object dynamically */
    const updateData: Record<string, any> = {};

    if (status !== undefined)            updateData.status            = status;
    if (nextSchedule !== undefined)      updateData.nextSchedule      = nextSchedule;
    if (nextTime !== undefined)          updateData.nextTime          = nextTime;
    if (timezone !== undefined)          updateData.timezone          = timezone;
    if (followUpNotes !== undefined)     updateData.followUpNotes     = followUpNotes;
    if (interestedService !== undefined) updateData.interestedService = interestedService;
    if (projectTitle !== undefined)      updateData.projectTitle      = projectTitle;
    if (projectDeadline !== undefined)   updateData.projectDeadline   = projectDeadline;
    if (projectBudget !== undefined)     updateData.projectBudget     = projectBudget;
    if (projectNotes !== undefined)      updateData.projectNotes      = projectNotes;

    /* Sync boolean flags */
    if (status === "important")  updateData.important  = true;
    if (status === "interested") updateData.interested = true;
    if (
      status === "completed" ||
      status === "not completed" ||
      status === "pending"
    ) {
      updateData.important  = false;
      updateData.interested = false;
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: updateData,
    });

    return res.json({ success: true, lead: updated });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};