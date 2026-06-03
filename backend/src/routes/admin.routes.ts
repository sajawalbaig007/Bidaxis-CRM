import express from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";

const router = express.Router();

router.get("/dashboard", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, message: "Welcome Admin" });
});

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

router.get("/clients", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      include: {
        csr: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        uploadFile: {
          select: {
            companyName: true,
            fileName: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    const stats = {
      totalClients: leads.length,
      activeClients: leads.filter(
        (l) => l.status?.toLowerCase() === "pending"
      ).length,
      interested: leads.filter(
        (l) => l.status?.toLowerCase() === "interested" || l.interested === true
      ).length,
      closed: leads.filter((l) =>
        ["closed", "completed", "project won"].includes(
          l.status?.toLowerCase() || ""
        )
      ).length,
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
      message: "Failed to fetch clients",
    });
  }
});

router.put("/csr-status/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false",
      });
    }

    const existingCSR = await prisma.user.findUnique({ where: { id } });

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
});

router.get("/csr-history/:csrId", verifyToken, allowRoles("admin"), async (req, res) => {
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
        uploadFile: { select: { companyName: true } },
        callLogs: { orderBy: { createdAt: "desc" } },
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
      (l) => l.interested === true || l.status?.toLowerCase() === "interested"
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
});

router.get("/projects", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      where: { status: "project won" },
      include: {
        csr: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        uploadFile: {
          select: {
            companyName: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const now = new Date();

    const stats = {
      total: leads.length,
      withBudget: leads.filter((l) => l.projectBudget).length,
      thisMonth: leads.filter((l) => {
        const d = new Date(l.updatedAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
    };

    return res.json({ success: true, leads, stats });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
});

export default router;