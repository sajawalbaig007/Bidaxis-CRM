import express from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { getCache, setCache, invalidateCache } from "../utils/cache";
import { purgeCsrLeads } from "../utils/purgeCsrLeads";
import { countLeadStatuses } from "../utils/uploadSourceStats";
import { buildProjectLeadWhere, isDisplayableProjectLead } from "../utils/projectLeads";
import { isBinLead } from "../utils/binLeads";

const router = express.Router();

/* ================= ADMIN DASHBOARD ================= */
router.get("/dashboard", verifyToken, allowRoles("admin"), (req, res) => {
  res.json({ success: true, message: "Welcome Admin" });
});

/* ================= GET ALL CSRS ================= */
router.get("/csrs", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const CACHE_KEY = "admin:csrs";
    const cached = getCache<object>(CACHE_KEY);
    if (cached) return res.json(cached);

    const csrs = await prisma.user.findMany({
      where: { role: "csr" },
      select: {
        id: true,
        name: true,
        email: true,
        csrCode: true,
        isActive: true,
        isOnline: true,
        lastActive: true,
        createdAt: true,
        _count: { select: { leads: true } },
      },
      orderBy: { csrCode: "asc" },
    });

    const payload = { success: true, csrs };
    setCache(CACHE_KEY, payload, 15_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch CSRs" });
  }
});

/* ================= GET ALL CLIENTS / LEADS ================= */
router.get("/clients", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const CACHE_KEY = "admin:clients";
    const cached = getCache<object>(CACHE_KEY);
    if (cached) return res.json(cached);

    /* Lean select — charts only need id, name, status, createdAt, updatedAt, csr.name */
    const leads = await prisma.lead.findMany({
      select: {
        id:         true,
        name:       true,
        status:     true,
        interested: true,
        createdAt:  true,
        updatedAt:  true,
        csr: { select: { id: true, name: true, csrCode: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const stats = {
      totalClients:  leads.length,
      activeClients: leads.filter(l => l.status?.toLowerCase() === "pending").length,
      interested:    leads.filter(l => l.status?.toLowerCase() === "interested" || l.interested).length,
      closed:        leads.filter(l => ["closed","completed","close client"].includes(l.status?.toLowerCase() || "")).length,
    };

    const payload = { success: true, leads, stats };
    setCache(CACHE_KEY, payload, 60_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch clients" });
  }
});

/* ================= UPDATE LEAD NOTE ================= */
router.patch("/lead/:id/note", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const { comments } = req.body;
    await prisma.lead.update({
      where: { id: String(req.params.id) },
      data:  { comments: comments ?? "" },
    });
    invalidateCache("admin:clients");
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ success: false, message: "Failed to save note" });
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
        select: { id: true, name: true, email: true, isActive: true },
      });

      invalidateCache("admin:csrs");
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
        (l) => l.status?.toLowerCase() === "close client"
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

/* ================= ALL ACTIVE PROJECT LEADS (all CSRs) ================= */
router.get("/projects", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const csrId = typeof req.query.csrId === "string" ? req.query.csrId : undefined;

    const rawLeads = await prisma.lead.findMany({
      where: buildProjectLeadWhere(csrId),
      include: {
        csr: {
          select: {
            id: true,
            name: true,
            email: true,
            csrCode: true,
          },
        },
        uploadFile: {
          select: {
            companyName: true,
          },
        },
        notes: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const leads = rawLeads.filter(isDisplayableProjectLead);

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

/* ================= UPDATE PROJECT (ADMIN) ================= */
router.put("/project/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const {
      projectCode, projectTitle, projectBudget, projectDeadline, projectNotes,
    } = req.body;

    const updateData: Record<string, unknown> = {};

    if (projectCode     !== undefined) updateData.projectCode     = projectCode;
    if (projectTitle    !== undefined) updateData.projectTitle    = projectTitle;
    if (projectBudget   !== undefined) updateData.projectBudget   = projectBudget;
    if (projectDeadline !== undefined) updateData.projectDeadline = projectDeadline;
    if (projectNotes    !== undefined) updateData.projectNotes    = projectNotes;

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data:  updateData,
    });

    return res.json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update project" });
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

/* ================= RESET A SINGLE CSR'S LEADS ================= */
router.delete(
  "/csr-leads/:csrId",
  verifyToken,
  allowRoles("admin"),
  async (req, res) => {
    try {
      const csrId = String(req.params.csrId);

      const csr = await prisma.user.findUnique({
        where: { id: csrId },
        select: { id: true, name: true, role: true },
      });

      if (!csr) {
        return res.status(404).json({ success: false, message: "CSR not found" });
      }

      if (csr.role !== "csr") {
        return res.status(400).json({ success: false, message: "User is not a CSR" });
      }

      /* Permanently purge all lead data for this CSR from DB */
      const purged = await purgeCsrLeads(csrId);

      invalidateCache("admin:clients", "admin:csrs", `csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
      return res.json({
        success: true,
        message: `Removed all data for ${csr.name} from database`,
        deleted: purged.leadsDeleted,
        purged,
        csrName: csr.name,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ success: false, message: "Failed to reset CSR data" });
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

      const deleteIds: string[] = [];
      const updateOps: Promise<unknown>[] = [];

      for (const [csrId, leads] of byCSR.entries()) {
        const toDelete  = leads.filter((l) => l.shuffleAttempts >= 2);
        const toShuffle = leads.filter((l) => l.shuffleAttempts < 2);

        for (const lead of toDelete) {
          deleteIds.push(lead.id);
          deleted++;
          details.push(`Deleted: "${lead.name}" because 3 attempts completed`);
        }

        if (toShuffle.length === 0) continue;

        const otherCSRs = csrs.filter((c) => c.id !== csrId);
        if (otherCSRs.length === 0) continue;

        const fromName = csrs.find((c) => c.id === csrId)?.name ?? csrId;

        for (let i = 0; i < toShuffle.length; i++) {
          const lead    = toShuffle[i];
          const target  = otherCSRs[i % otherCSRs.length];
          const attempt = lead.shuffleAttempts + 1;

          updateOps.push(
            prisma.lead.update({
              where: { id: lead.id },
              data: {
                assignedTo:      target.id,
                shuffleAttempts: attempt,
                status:          "pending",
                followUpNotes:   [
                  lead.followUpNotes,
                  `[Attempt ${attempt}/3] ${fromName} → ${target.name} on ${new Date().toLocaleDateString()}`,
                ].filter(Boolean).join("\n"),
              },
            })
          );

          shuffled++;
          details.push(`"${lead.name}" moved from ${fromName} to ${target.name} attempt ${attempt}/3`);
        }
      }

      /* ── BATCH: 1 deleteMany + parallel updates ── */
      await Promise.all([
        deleteIds.length
          ? prisma.lead.deleteMany({ where: { id: { in: deleteIds } } })
          : Promise.resolve(),
        ...updateOps,
      ]);

      invalidateCache("admin:clients");
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

/* ================= ADMIN BIN (all not-picked + not-interested leads) ================= */

router.get("/bin", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const csrId = typeof req.query.csrId === "string" ? req.query.csrId : undefined;

    const rawLeads = await prisma.lead.findMany({
      where: csrId ? { assignedTo: csrId } : {},
      include: {
        csr:        { select: { id: true, name: true, csrCode: true } },
        uploadFile: { select: { companyName: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    const leads = rawLeads.filter(isBinLead);
    return res.json({ success: true, leads });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch bin" });
  }
});

/* ================= REASSIGN LEAD TO SPECIFIC CSR (ADMIN) ================= */

router.put("/lead/:id/reassign", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { csrId } = req.body;

    if (!csrId) return res.status(400).json({ success: false, message: "CSR ID is required" });

    const targetCsr = await prisma.user.findFirst({ where: { id: csrId, role: "csr" } });
    if (!targetCsr) return res.status(404).json({ success: false, message: "CSR not found" });

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data:  {
        assignedTo:         csrId,
        inBin:              false,
        binReason:          null,
        binPreviousStatus:  null,
        status:             "pending",
        notInterestedCount: 0,
        notPickedCount:     0,
        important:          false,
        interested:         false,
      },
    });

    invalidateCache(
      "admin:clients",
      "admin:bin",
      `csr:dashboard:${csrId}`,
      `csr:leads:${csrId}`,
      `csr:not-interested:${csrId}`,
      `csr:bin:${csrId}`,
    );
    return res.json({ success: true, lead, message: `Lead reassigned to ${targetCsr.name}` });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to reassign lead" });
  }
});

/* ================= UPLOAD SOURCES (admin-only — hidden from CSR) ================= */

async function statsForSource(sourceId: string) {
  const uploads = await prisma.uploadFile.findMany({
    where:   { sourceId },
    select:  { id: true, fileName: true, totalLeads: true, companyName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const fileIds = uploads.map(u => u.id);
  const leads = fileIds.length
    ? await prisma.lead.findMany({
        where:   { uploadedFileId: { in: fileIds } },
        select:  { status: true },
      })
    : [];

  return {
    stats:   countLeadStatuses(leads),
    uploads,
  };
}

router.get("/upload-sources", verifyToken, allowRoles("admin"), async (_req, res) => {
  try {
    const sources = await prisma.uploadSource.findMany({ orderBy: { name: "asc" } });

    const enriched = await Promise.all(
      sources.map(async (src) => {
        const { stats, uploads } = await statsForSource(src.id);
        return {
          id:          src.id,
          name:        src.name,
          createdAt:   src.createdAt,
          uploadCount: uploads.length,
          lastUpload:  uploads[0]?.createdAt ?? null,
          stats,
        };
      })
    );

    return res.json({ success: true, sources: enriched });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch upload sources" });
  }
});

router.post("/upload-sources", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const name = String(req.body.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Source name is required" });
    }

    const existing = await prisma.uploadSource.findUnique({ where: { name } });
    if (existing) {
      return res.json({ success: true, source: existing, created: false });
    }

    const source = await prisma.uploadSource.create({ data: { name } });
    return res.json({ success: true, source, created: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to create upload source" });
  }
});

router.get("/upload-sources/:sourceId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const sourceId = String(req.params.sourceId);
    const source = await prisma.uploadSource.findUnique({ where: { id: sourceId } });
    if (!source) {
      return res.status(404).json({ success: false, message: "Source not found" });
    }

    const { stats, uploads } = await statsForSource(sourceId);

    const leads = uploads.length
      ? await prisma.lead.findMany({
          where:   { uploadedFileId: { in: uploads.map(u => u.id) } },
          select:  {
            id: true, name: true, phone: true, email: true, status: true,
            company: true, interestedService: true, updatedAt: true,
            csr: { select: { name: true } },
          },
          orderBy: { updatedAt: "desc" },
          take:    200,
        })
      : [];

    return res.json({
      success: true,
      source:  { id: source.id, name: source.name, createdAt: source.createdAt },
      stats,
      uploads,
      leads,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch source details" });
  }
});

export default router;