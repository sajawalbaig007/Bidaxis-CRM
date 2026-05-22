import express from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";

const router = express.Router();

/* ================= CSR DASHBOARD ================= */

router.get(
  "/dashboard",
  verifyToken,
  allowRoles("csr"),
  async (req: any, res) => {
    try {
      const csrId = req.user.id;

      const latestFile = await prisma.uploadFile.findFirst({
        orderBy: { createdAt: "desc" },
      });

      if (!latestFile) {
        return res.json({ success: true, totalLeads: 0, leads: [] });
      }

      const leads = await prisma.lead.findMany({
        where: {
          assignedTo: csrId,
          uploadedFileId: latestFile.id,
        },
        orderBy: { createdAt: "desc" },
      });

      return res.json({ success: true, totalLeads: leads.length, leads });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: "Failed to fetch dashboard" });
    }
  }
);

/* ================= UPDATE LEAD ================= */

router.put(
  "/lead/:id",
  verifyToken,
  allowRoles("csr"),
  async (req: any, res) => {
    try {
      const {
        status,
        nextSchedule,
        nextTime,
        timezone,
        followUpNotes,
        // NEW — Interested service
        interestedService,
        // NEW — Project Won fields
        projectTitle,
        projectDeadline,
        projectBudget,
        projectNotes,
      } = req.body;

      /* Build update object — only include fields that were sent */
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

      /* Sync boolean flags based on status */
      if (status !== undefined) {
        updateData.important  = status === "important";
        updateData.interested = status === "interested";
      }

      const updatedLead = await prisma.lead.update({
        where: { id: req.params.id },
        data: updateData,
      });

      return res.json({ success: true, lead: updatedLead });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: "Failed to update lead" });
    }
  }
);

export default router;