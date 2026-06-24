import express from "express";
import prisma from "../config/db";
import { verifyToken } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { getCache, setCache, invalidateCache, flushAdminClientsCache } from "../utils/cache";
import { purgeCsrLeads } from "../utils/purgeCsrLeads";
import { countLeadStatuses } from "../utils/uploadSourceStats";
import { buildProjectLeadWhere, isDisplayableProjectLead } from "../utils/projectLeads";
import { isBinLead } from "../utils/binLeads";
import {
  buildAdminClientListWhere,
  buildAdminClientViewWhere,
  importantOnlyWhere,
  scheduledCallWhere,
  isInterestedStatusWhere,
  ADMIN_LEAD_LIST_SELECT,
  type AdminClientView,
} from "../utils/adminClientQueries";

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

/* ================= CLIENT SUMMARY (fast — dashboard tiles & charts) ================= */
router.get("/clients/summary", verifyToken, allowRoles("admin"), async (_req, res) => {
  try {
    const CACHE_KEY = "admin:clients:summary";
    const cached = getCache<object>(CACHE_KEY);
    if (cached) return res.json(cached);

    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);

    const [
      totalLeads,
      pending,
      interested,
      projectWon,
      completed,
      importantOnly,
      scheduled,
      closed,
      recent,
      chartLeads,
      csrGroups,
      resolvedGroups,
    ] = await Promise.all([
      prisma.lead.count(),
      prisma.lead.count({ where: { status: "pending" } }),
      prisma.lead.count({ where: isInterestedStatusWhere() }),
      prisma.lead.count({ where: { status: { in: ["Close Client", "close client"] } } }),
      prisma.lead.count({ where: { status: { in: ["completed", "closed"] } } }),
      prisma.lead.count({ where: importantOnlyWhere() }),
      prisma.lead.count({ where: scheduledCallWhere() }),
      prisma.lead.count({ where: buildAdminClientViewWhere("closed") }),
      prisma.lead.findMany({
        select: {
          id: true, name: true, status: true, updatedAt: true,
          csr: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
      }),
      prisma.lead.findMany({
        where:   { createdAt: { gte: yearAgo } },
        select:  { createdAt: true },
      }),
      prisma.lead.groupBy({ by: ["assignedTo"], _count: { _all: true } }),
      prisma.lead.groupBy({
        by:    ["assignedTo"],
        where: { status: { in: ["Close Client", "close client", "interested", "important"] } },
        _count: { _all: true },
      }),
    ]);

    const csrIds = [...new Set([
      ...csrGroups.map(g => g.assignedTo),
      ...resolvedGroups.map(g => g.assignedTo),
    ])].filter((id): id is string => typeof id === "string" && id.length > 0);
    const csrUsers = csrIds.length
      ? await prisma.user.findMany({ where: { id: { in: csrIds } }, select: { id: true, name: true } })
      : [];
    const csrNameById = new Map(csrUsers.map(u => [u.id, u.name]));

    const totalMap     = new Map(csrGroups.map(g => [g.assignedTo, g._count._all]));
    const resolvedMap  = new Map(resolvedGroups.map(g => [g.assignedTo, g._count._all]));
    const performers = [...totalMap.entries()]
      .filter(([id]) => typeof id === "string" && id.length > 0)
      .map(([id, total]) => {
        const resolved = resolvedMap.get(id) ?? 0;
        const name = csrNameById.get(id) ?? "Unassigned";
        return { name, resolved, total, rate: total > 0 ? Math.round((resolved / total) * 100) : 0 };
      })
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 5);

    const payload = {
      success: true,
      stats: {
        totalLeads,
        pending,
        important: importantOnly + scheduled,
        importantOnly,
        scheduled,
        interested,
        projectWon,
        completed,
        closed,
      },
      tabCounts: {
        all:        totalLeads,
        important:  importantOnly,
        schedule:   scheduled,
        interested,
        closed,
      },
      distribution: {
        Pending:      pending,
        Important:    importantOnly + scheduled,
        Interested:   interested,
        "Close Client": projectWon,
        Closed:       completed + closed,
      },
      recent,
      chartLeads,
      performers,
    };

    setCache(CACHE_KEY, payload, 120_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch client summary" });
  }
});

/* ================= GET CLIENTS / LEADS (paginated — admin leads page) ================= */
router.get("/clients", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const view = (String(req.query.view || "all") as AdminClientView);
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10) || 50));
    const csrName = req.query.csr ? String(req.query.csr) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const scheduleDate = req.query.scheduleDate ? String(req.query.scheduleDate) : undefined;

    const cacheKey = `admin:clients:list:${view}:${page}:${limit}:${csrName ?? "all"}:${search ?? ""}:${scheduleDate ?? ""}`;
    const cached = getCache<object>(cacheKey);
    if (cached) return res.json(cached);

    const where = buildAdminClientListWhere(view, csrName, search, scheduleDate);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        select:  ADMIN_LEAD_LIST_SELECT,
        orderBy: { updatedAt: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.lead.count({ where }),
    ]);

    const payload = {
      success: true,
      leads,
      total,
      page,
      limit,
      stats: {
        totalClients: total,
        activeClients: view === "all"
          ? await prisma.lead.count({ where: { status: "pending" } })
          : undefined,
      },
    };

    setCache(cacheKey, payload, 60_000);
    return res.json(payload);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch clients" });
  }
});

/* ================= GET SINGLE LEAD (ADMIN) ================= */
router.get("/lead/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const lead = await prisma.lead.findFirst({
      where:   { id: leadId },
      include: {
        uploadFile:  { select: { companyName: true } },
        notes:       { orderBy: { createdAt: "asc" } },
        subContacts: { orderBy: { createdAt: "asc" } },
        csr:         { select: { id: true, name: true, csrCode: true } },
      },
    });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    return res.json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch lead" });
  }
});

/* ================= UPDATE LEAD DETAILS (ADMIN) ================= */
router.put("/lead/:id", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { name, phone, email, state } = req.body;

    const existing = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!existing) return res.status(404).json({ success: false, message: "Lead not found" });

    const updateData: Record<string, unknown> = {};
    if (name  !== undefined) updateData.name  = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (state !== undefined) updateData.state = state;

    const lead = await prisma.lead.update({ where: { id: leadId }, data: updateData });

    flushAdminClientsCache();
    return res.json({ success: true, lead });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update lead" });
  }
});

router.post("/lead/:id/subcontacts", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const { name, designation, phone, email } = req.body as { name: string; designation?: string; phone?: string; email?: string };
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name is required" });

    const lead = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    const subContact = await prisma.subContact.create({
      data: { leadId, name: name.trim(), designation: designation?.trim() || null, phone: phone?.trim() || null, email: email?.trim() || null },
    });
    flushAdminClientsCache();
    invalidateCache(`csr:dashboard:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
    return res.status(201).json({ success: true, subContact });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to add sub-contact" });
  }
});

router.delete("/lead/:id/subcontacts/:subId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const leadId = String(req.params.id);
    const subId  = String(req.params.subId);

    const lead = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });

    await prisma.subContact.delete({ where: { id: subId } });
    flushAdminClientsCache();
    invalidateCache(`csr:dashboard:${lead.assignedTo}`, `csr:leads:${lead.assignedTo}`);
    return res.json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to delete sub-contact" });
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
    flushAdminClientsCache();
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

      flushAdminClientsCache();
      invalidateCache("admin:csrs", `csr:dashboard:${csrId}`, `csr:leads:${csrId}`, `csr:projects:${csrId}`, `csr:not-interested:${csrId}`);
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

      flushAdminClientsCache();
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

    const existing = await prisma.lead.findFirst({ where: { id: leadId } });
    if (!existing) return res.status(404).json({ success: false, message: "Lead not found" });

    const prevCsrId = existing.assignedTo;

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data:  {
        assignedTo:        csrId,
        inBin:             false,
        binReason:         null,
        binPreviousStatus: null,
      },
    });

    flushAdminClientsCache();
    invalidateCache(
      "admin:bin",
      `csr:dashboard:${csrId}`,
      `csr:leads:${csrId}`,
      `csr:not-interested:${csrId}`,
      `csr:bin:${csrId}`,
      `csr:dashboard:${prevCsrId}`,
      `csr:leads:${prevCsrId}`,
      `csr:not-interested:${prevCsrId}`,
      `csr:bin:${prevCsrId}`,
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
          sudoName:    src.sudoName,
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
    const sudoNameRaw = String(req.body.sudoName ?? "").trim();
    const sudoName = sudoNameRaw || null;
    if (!name) {
      return res.status(400).json({ success: false, message: "Source name is required" });
    }

    const existing = await prisma.uploadSource.findUnique({ where: { name } });
    if (existing) {
      if (sudoName && existing.sudoName !== sudoName) {
        const updated = await prisma.uploadSource.update({
          where: { id: existing.id },
          data:  { sudoName },
        });
        return res.json({ success: true, source: updated, created: false, updated: true });
      }
      return res.json({ success: true, source: existing, created: false });
    }

    const source = await prisma.uploadSource.create({ data: { name, sudoName } });
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
      source:  { id: source.id, name: source.name, sudoName: source.sudoName, createdAt: source.createdAt },
      stats,
      uploads,
      leads,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch source details" });
  }
});

router.patch("/upload-sources/:sourceId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const sourceId = String(req.params.sourceId);
    const existing = await prisma.uploadSource.findUnique({ where: { id: sourceId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Source not found" });
    }

    const nameRaw = req.body.name !== undefined ? String(req.body.name).trim() : undefined;
    const sudoNameRaw = req.body.sudoName !== undefined ? String(req.body.sudoName).trim() : undefined;

    if (nameRaw !== undefined && !nameRaw) {
      return res.status(400).json({ success: false, message: "Source name cannot be empty" });
    }

    if (nameRaw && nameRaw !== existing.name) {
      const conflict = await prisma.uploadSource.findUnique({ where: { name: nameRaw } });
      if (conflict) {
        return res.status(409).json({ success: false, message: "A source with this name already exists" });
      }
    }

    const source = await prisma.uploadSource.update({
      where: { id: sourceId },
      data: {
        ...(nameRaw !== undefined ? { name: nameRaw } : {}),
        ...(sudoNameRaw !== undefined ? { sudoName: sudoNameRaw || null } : {}),
      },
    });

    return res.json({ success: true, source });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update upload source" });
  }
});

router.delete("/upload-sources/:sourceId", verifyToken, allowRoles("admin"), async (req, res) => {
  try {
    const sourceId = String(req.params.sourceId);
    const existing = await prisma.uploadSource.findUnique({ where: { id: sourceId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Source not found" });
    }

    await prisma.uploadFile.updateMany({
      where: { sourceId },
      data:  { sourceId: null },
    });

    await prisma.uploadSource.delete({ where: { id: sourceId } });

    return res.json({ success: true, message: "Source deleted" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to delete upload source" });
  }
});

/* ================= RESTORE LEGACY COMMENTS → LeadNote ================= */
router.post("/migrate-legacy-notes", verifyToken, allowRoles("admin"), async (_req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        OR: [
          { comments: { not: null } },
          { followUpNotes: { not: null } },
        ],
      },
      select: {
        id: true,
        comments: true,
        followUpNotes: true,
        createdAt: true,
        _count: { select: { notes: true } },
      },
    });

    let migrated = 0;
    for (const lead of leads) {
      if (lead._count.notes > 0) continue;

      const text = [lead.comments?.trim(), lead.followUpNotes?.trim()].filter(Boolean).join("\n\n");
      if (!text) continue;

      await prisma.leadNote.create({
        data: {
          leadId: lead.id,
          text,
          createdAt: lead.createdAt,
        },
      });
      migrated++;
    }

    flushAdminClientsCache();
    return res.json({
      success: true,
      message: `Restored notes on ${migrated} lead(s) from legacy comments fields`,
      migrated,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Migration failed" });
  }
});

export default router;