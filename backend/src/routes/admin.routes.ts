import express, { Request, Response } from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";

const router = express.Router();

/* ================= ADMIN DASHBOARD ================= */

router.get("/dashboard", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, message: "Welcome Admin" });
});

/* ================= GET ALL CSRS ================= */

router.get("/csrs", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const csrs = await prisma.user.findMany({
      where: { role: "csr" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        isOnline: true,
        lastActive: true,
        createdAt: true,
        _count: { select: { leads: true } },
      },
      orderBy: { name: "asc" },
    });

    return res.json({ success: true, csrs });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch CSRs",
    });
  }
});

/* ================= UPDATE CSR STATUS ================= */

router.put(
  "/csr-status/:id",
  verifyToken,
  allowRoles("admin"),
  async (req: Request<{ id: string }>, res: Response) => {
    try {
      const { id } = req.params;
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
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
        },
      });

      return res.json({
        success: true,
        message: `CSR ${
          csr.isActive ? "activated" : "deactivated"
        } successfully`,
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
  async (req: Request<{ csrId: string }>, res: Response) => {
    try {
      const { csrId } = req.params;

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
            select: { companyName: true },
          },
          callLogs: {
            orderBy: { createdAt: "desc" },
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
        (l) =>
          l.important === true ||
          l.status?.toLowerCase() === "important"
      ).length;

      const interested = leads.filter(
        (l) =>
          l.interested === true ||
          l.status?.toLowerCase() === "interested"
      ).length;

      const projectWon = leads.filter(
        (l) => l.status?.toLowerCase() === "project won"
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

export default router;