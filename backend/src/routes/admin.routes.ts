import express from "express";
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
        _count: {
          select: { leads: true },
        },
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

/* ================= GET ALL CLIENTS / LEADS ================= */
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
      orderBy: { updatedAt: "desc" },
    });

    const stats = {
      totalClients: leads.length,
      activeClients: leads.filter(
        (l) => l.status?.toLowerCase() === "pending"
      ).length,
      interested: leads.filter(
        (l) =>
          l.status?.toLowerCase() === "interested" || l.interested === true
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

/* ================= UPDATE CSR STATUS ================= */
router.put(
  "/csr-status/:id",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const id = String(req.params.id);
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
  async (req, res) => {
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
          uploadFile: {
            select: {
              companyName: true,
            },
          },
          callLogs: {
            orderBy: {
              createdAt: "desc",
            },
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
        (l) => l.important === true || l.status?.toLowerCase() === "important"
      ).length;

      const interested = leads.filter(
        (l) =>
          l.interested === true || l.status?.toLowerCase() === "interested"
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

/* ================= ALL PROJECT WON LEADS ================= */
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
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }).length,
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
      message: "Failed to fetch projects",
    });
  }
});

/* ================= SHUFFLE STATUS ================= */
router.get(
  "/shuffle-status",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const notCompleted = await prisma.lead.findMany({
        where: {
          status: {
            in: ["not completed", "Not Completed"],
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          shuffleAttempts: true,
          csr: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { shuffleAttempts: "asc" },
      });

      const csrs = await prisma.user.findMany({
        where: {
          role: "csr",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { createdAt: "asc" },
      });

      return res.json({
        success: true,
        totalNotCompleted: notCompleted.length,
        shuffleOrder: csrs.map((c) => c.name),
        leads: notCompleted.map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          assignedTo: l.csr?.name,
          shuffleAttempts: l.shuffleAttempts,
          attemptsLeft: 2 - l.shuffleAttempts,
          willDeleteNext: l.shuffleAttempts >= 2,
        })),
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch shuffle status",
      });
    }
  }
);

/* ================= RUN SHUFFLE MANUALLY ================= */
router.post(
  "/run-shuffle",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      console.log("[TEST Shuffle] Manual trigger by admin");

      const csrs = await prisma.user.findMany({
        where: {
          role: "csr",
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: { createdAt: "asc" },
      });

      if (csrs.length < 2) {
        return res.status(400).json({
          success: false,
          message: "Need at least 2 active CSRs",
        });
      }

      const notCompleted = await prisma.lead.findMany({
        where: {
          status: {
            in: ["not completed", "Not Completed"],
          },
        },
      });

      if (notCompleted.length === 0) {
        return res.json({
          success: true,
          message: "No not-completed leads found",
          shuffled: 0,
          deleted: 0,
        });
      }

      let deleted = 0;
      let shuffled = 0;
      const details: string[] = [];

      const byCSR = new Map<string, typeof notCompleted>();

      for (const lead of notCompleted) {
        const key = lead.assignedTo;

        if (!byCSR.has(key)) {
          byCSR.set(key, []);
        }

        byCSR.get(key)!.push(lead);
      }

      for (const [csrId, leads] of byCSR.entries()) {
        const toDelete = leads.filter((l) => l.shuffleAttempts >= 2);
        const toShuffle = leads.filter((l) => l.shuffleAttempts < 2);

        for (const lead of toDelete) {
          await prisma.lead.delete({
            where: { id: lead.id },
          });

          deleted++;
          details.push(`Deleted: "${lead.name}" because 3 attempts completed`);
        }

        if (toShuffle.length === 0) continue;

        const otherCSRs = csrs.filter((c) => c.id !== csrId);

        if (otherCSRs.length === 0) continue;

        const fromName = csrs.find((c) => c.id === csrId)?.name ?? csrId;

        for (let i = 0; i < toShuffle.length; i++) {
          const lead = toShuffle[i];
          const target = otherCSRs[i % otherCSRs.length];
          const attempt = lead.shuffleAttempts + 1;

          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              assignedTo: target.id,
              shuffleAttempts: attempt,
              status: "pending",
              followUpNotes: [
                lead.followUpNotes,
                `[Attempt ${attempt}/3] ${fromName} → ${
                  target.name
                } on ${new Date().toLocaleDateString()}`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          });

          shuffled++;
          details.push(
            `"${lead.name}" moved from ${fromName} to ${target.name} attempt ${attempt}/3`
          );
        }
      }

      return res.json({
        success: true,
        shuffled,
        deleted,
        details,
        message: `Done — Shuffled: ${shuffled}, Deleted: ${deleted}`,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        message: "Shuffle failed",
      });
    }
  }
);

export default router;