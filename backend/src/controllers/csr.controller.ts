import {
  Response,
} from "express";

import prisma from "../config/db";

import {
  AuthRequest,
} from "../middleware/auth.middleware";

export const getCSRDashboard =
  async (
    req: AuthRequest,
    res: Response
  ) => {

    try {

      if (!req.user?.id) {

        return res.status(401).json({
          success: false,
          message:
            "Unauthorized",
        });
      }

      /* ================= LATEST FILE ================= */

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
          leads: [],
        });
      }

      /* ================= CSR LEADS ================= */

      const leads =
        await prisma.lead.findMany({
          where: {
            assignedTo:
              req.user.id,

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
        leads,
      });

    } catch (error) {

      console.log(error);

      return res.status(500).json({
        success: false,
        message:
          "Server error",
      });
    }
  };