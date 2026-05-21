import express from "express";

import prisma from "../config/db";

import {
  verifyToken,
} from "../middleware/auth.middleware";

import {
  allowRoles,
} from "../middleware/role.middleware";

const router =
  express.Router();

/* ================= CSR DASHBOARD ================= */

router.get(
  "/dashboard",

  verifyToken,

  allowRoles("csr"),

  async (
    req: any,
    res
  ) => {

    try {

      const csrId =
        req.user.id;

      /* ================= GET LATEST FILE ================= */

      const latestFile =
        await prisma.uploadFile.findFirst({
          orderBy: {
            createdAt:
              "desc",
          },
        });

      if (!latestFile) {

        return res.json({
          success: true,

          totalLeads: 0,

          leads: [],
        });
      }

      /* ================= GET ONLY LATEST FILE LEADS ================= */

      const leads =
        await prisma.lead.findMany({
          where: {

            assignedTo:
              csrId,

            uploadedFileId:
              latestFile.id,
          },

          orderBy: {
            createdAt:
              "desc",
          },
        });

      return res.json({
        success: true,

        totalLeads:
          leads.length,

        leads,
      });

    } catch (error) {

      console.log(error);

      return res.status(500).json({
        success: false,

        message:
          "Failed to fetch dashboard",
      });
    }
  }
);
/* ================= UPDATE LEAD STATUS ================= */

router.put(
  "/lead/:id",

  verifyToken,

  allowRoles("csr"),

  async (
    req: any,
    res
  ) => {

    try {

      const {
        status,
        nextSchedule,
        nextTime,
        timezone,
      } = req.body;

      const updatedLead =
        await prisma.lead.update({
          where: {
            id: req.params.id,
          },

          data: {
            status,

            nextSchedule,

            nextTime,

            timezone,
          },
        });

      return res.json({
        success: true,
        lead: updatedLead,
      });

    } catch (error) {

      console.log(error);

      return res.status(500).json({
        success: false,
        message:
          "Failed to update lead",
      });
    }
  }
);
export default router;