import express from "express";
import prisma from "../config/db";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { buildProjectLeadWhere, isDisplayableProjectLead } from "../utils/projectLeads";
import {
  assignmentBelongsToEstimator,
  parseTechnicalAssignments,
  serializeTechnicalAssignments,
  appendTechnicalNote,
  serializeTechnicalNotes,
  pauseAssignmentTimer,
  startAssignmentTimer,
  pauseOtherRunningTimersForEstimator,
  pauseTimersOnLeadIds,
  syncPhaseFromAssignments,
  assignmentElapsedSeconds,
  canCompleteAfterTimer,
  MIN_COMPLETE_TIMER_SECONDS,
  type TechnicalAssignment,
} from "../utils/technicalEstimators";
import { invalidatePattern, invalidateCache } from "../utils/cache";

const router = express.Router();

router.use(verifyToken, allowRoles("estimator"));

async function currentEstimator(req: AuthRequest) {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { id: true, name: true },
  });
  return user;
}

function projectInclude() {
  return {
    csr: { select: { id: true, name: true, email: true, csrCode: true } },
    uploadFile: { select: { companyName: true } },
    notes: { orderBy: { createdAt: "asc" as const }, take: 20 },
  };
}

function withMyAssignment(lead: { technicalAssignments: string | null }, me: { id: string; name: string }) {
  const all = parseTechnicalAssignments(lead.technicalAssignments);
  const mineAsg = all.find((a) => assignmentBelongsToEstimator(a, me));
  return { ...lead, myAssignment: mineAsg, technicalAssignments: serializeTechnicalAssignments(all) };
}

/* ================= GET ONE ASSIGNED PROJECT ================= */
router.get("/lead/:id", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    const leadId = String(req.params.id);
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { notes: { orderBy: { createdAt: "asc" }, take: 50 } },
    });
    if (!lead) return res.status(404).json({ success: false, message: "Project not found" });

    const mine = parseTechnicalAssignments(lead.technicalAssignments).some((a) =>
      assignmentBelongsToEstimator(a, me),
    );
    if (!mine) {
      return res.status(403).json({ success: false, message: "This project is not assigned to you" });
    }
    return res.json({ success: true, lead: withMyAssignment(lead, me) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch project" });
  }
});

router.get("/projects", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    const raw = await prisma.lead.findMany({
      where: {
        ...buildProjectLeadWhere(),
        technicalAssignments: { not: null },
      },
      include: projectInclude(),
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const leads = raw
      .filter(isDisplayableProjectLead)
      .filter((lead) => (lead as { hiddenOnTechnical?: boolean }).hiddenOnTechnical !== true)
      .map((lead) => {
        const all = parseTechnicalAssignments(lead.technicalAssignments);
        const mine = all.filter((a) => assignmentBelongsToEstimator(a, me));
        if (mine.length === 0) return null;
        return {
          ...lead,
          myAssignment: mine[0],
          technicalAssignments: serializeTechnicalAssignments(all),
        };
      })
      .filter(Boolean);

    const typed = leads as Array<{ myAssignment: TechnicalAssignment }>;
    const stats = {
      total: typed.length,
      takeoffDone: typed.filter((l) => l.myAssignment?.takeoffDone).length,
      pending: typed.filter((l) => !l.myAssignment?.takeoffDone).length,
    };

    return res.json({ success: true, leads, stats });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to fetch projects" });
  }
});

router.get("/dashboard", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    const raw = await prisma.lead.findMany({
      where: {
        ...buildProjectLeadWhere(),
        technicalAssignments: { not: null },
      },
      select: {
        id: true,
        projectTitle: true,
        projectCode: true,
        projectDeadline: true,
        projectPhase: true,
        technicalAssignments: true,
        updatedAt: true,
        hiddenOnTechnical: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const mine = raw
      .filter((lead) => lead.hiddenOnTechnical !== true)
      .map((lead) => {
        const all = parseTechnicalAssignments(lead.technicalAssignments);
        const a = all.find((x) => assignmentBelongsToEstimator(x, me));
        if (!a) return null;
        return { ...lead, myAssignment: a };
      })
      .filter(Boolean) as Array<{
        id: string;
        projectTitle: string | null;
        projectCode: string | null;
        projectDeadline: string | null;
        projectPhase: string | null;
        updatedAt: Date;
        myAssignment: TechnicalAssignment;
      }>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdue = mine.filter((p) => {
      if (p.myAssignment.takeoffDone) return false;
      const d = p.myAssignment.deadline || p.projectDeadline;
      if (!d) return false;
      const dt = new Date(d);
      if (Number.isNaN(dt.getTime())) return false;
      return dt < today;
    });

    return res.json({
      success: true,
      stats: {
        total: mine.length,
        pending: mine.filter((p) => !p.myAssignment.takeoffDone).length,
        takeoffDone: mine.filter((p) => p.myAssignment.takeoffDone).length,
        overdue: overdue.length,
      },
      recent: mine.slice(0, 8),
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to load dashboard" });
  }
});

/* ================= TIMER: start | pause ================= */
router.put("/project/:id/timer", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    const leadId = String(req.params.id);
    const action = String(req.body?.action ?? "").toLowerCase();
    if (action !== "start" && action !== "pause") {
      return res.status(400).json({ success: false, message: "action must be start or pause" });
    }

    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { technicalAssignments: true, assignedTo: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Project not found" });

    const list = parseTechnicalAssignments(existing.technicalAssignments);
    const idx = list.findIndex((a) => assignmentBelongsToEstimator(a, me));
    if (idx < 0) {
      return res.status(403).json({ success: false, message: "This project is not assigned to you" });
    }

    const current = list[idx]!;
    if (current.takeoffDone) {
      return res.status(400).json({
        success: false,
        message: "Completed tasks are locked. Ask Technical Manager to set pending if needed.",
      });
    }

    if (action === "start") {
      const pauseIds = Array.isArray(req.body?.pauseProjectIds)
        ? (req.body.pauseProjectIds as unknown[]).map((x) => String(x)).filter((id) => id && id !== leadId)
        : [];
      if (pauseIds.length > 0) {
        await pauseTimersOnLeadIds(me, pauseIds);
      } else {
        await pauseOtherRunningTimersForEstimator(me, leadId);
      }
      list[idx] = startAssignmentTimer(current);
    } else {
      const clientElapsed = Number(req.body?.clientElapsedSeconds);
      if (Number.isFinite(clientElapsed) && clientElapsed >= 0) {
        list[idx] = {
          ...current,
          timerSeconds: Math.max(current.timerSeconds, Math.floor(clientElapsed)),
          timerStartedAt: null,
        };
      } else {
        list[idx] = pauseAssignmentTimer(current);
      }
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: { technicalAssignments: serializeTechnicalAssignments(list) },
      include: projectInclude(),
    });

    invalidatePattern("admin:projects:");
    invalidateCache(`csr:projects:${lead.assignedTo}`);

    return res.json({ success: true, lead: withMyAssignment(lead, me) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update timer" });
  }
});

/* ================= COMPLETE TASK (estimator can only complete, not reopen) ================= */
router.put("/project/:id/complete", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    const leadId = String(req.params.id);
    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { technicalAssignments: true, assignedTo: true, projectPhase: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Project not found" });

    const list = parseTechnicalAssignments(existing.technicalAssignments);
    const idx = list.findIndex((a) => assignmentBelongsToEstimator(a, me));
    if (idx < 0) {
      return res.status(403).json({ success: false, message: "This project is not assigned to you" });
    }

    if (list[idx]!.takeoffDone) {
      return res.status(400).json({ success: false, message: "Task is already completed" });
    }

    const clientElapsed = Number(req.body?.clientElapsedSeconds);
    const serverElapsed = assignmentElapsedSeconds(list[idx]!);
    const elapsed =
      Number.isFinite(clientElapsed) && clientElapsed >= 0
        ? Math.max(serverElapsed, Math.floor(clientElapsed))
        : serverElapsed;
    if (!canCompleteAfterTimer(elapsed)) {
      const left = Math.max(0, MIN_COMPLETE_TIMER_SECONDS - elapsed);
      return res.status(400).json({
        success: false,
        message: `Start the timer and wait ${left || MIN_COMPLETE_TIMER_SECONDS}s before Complete.`,
      });
    }

    const paused =
      Number.isFinite(clientElapsed) && clientElapsed >= 0
        ? {
            ...list[idx]!,
            timerSeconds: Math.max(list[idx]!.timerSeconds, Math.floor(clientElapsed)),
            timerStartedAt: null,
          }
        : pauseAssignmentTimer(list[idx]!);
    list[idx] = { ...paused, takeoffDone: true, pricingSent: false };
    const nextPhase = syncPhaseFromAssignments(list, existing.projectPhase);

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        technicalAssignments: serializeTechnicalAssignments(list),
        projectPhase: nextPhase,
      },
      include: projectInclude(),
    });

    invalidatePattern("admin:projects:");
    invalidateCache(`csr:projects:${lead.assignedTo}`);

    return res.json({ success: true, lead: withMyAssignment(lead, me) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to complete task" });
  }
});

/* Legacy takeoff endpoint — estimator may only mark complete, never reopen */
router.put("/project/:id/takeoff", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    const takeoffDone = req.body?.takeoffDone === true;
    if (!takeoffDone) {
      return res.status(403).json({
        success: false,
        message: "Only Technical Manager can set a completed task back to pending.",
      });
    }

    const leadId = String(req.params.id);
    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { technicalAssignments: true, assignedTo: true, projectPhase: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Project not found" });

    const list = parseTechnicalAssignments(existing.technicalAssignments);
    const idx = list.findIndex((a) => assignmentBelongsToEstimator(a, me));
    if (idx < 0) {
      return res.status(403).json({ success: false, message: "This project is not assigned to you" });
    }

    const elapsed = assignmentElapsedSeconds(list[idx]!);
    if (!canCompleteAfterTimer(elapsed)) {
      const left = Math.max(0, MIN_COMPLETE_TIMER_SECONDS - elapsed);
      return res.status(400).json({
        success: false,
        message: `Start the timer and wait ${left || MIN_COMPLETE_TIMER_SECONDS}s before Complete.`,
      });
    }

    list[idx] = { ...pauseAssignmentTimer(list[idx]!), takeoffDone: true, pricingSent: false };
    const nextPhase = syncPhaseFromAssignments(list, existing.projectPhase);

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        technicalAssignments: serializeTechnicalAssignments(list),
        projectPhase: nextPhase,
      },
      include: projectInclude(),
    });

    invalidatePattern("admin:projects:");
    invalidateCache(`csr:projects:${lead.assignedTo}`);

    return res.json({ success: true, lead: withMyAssignment(lead, me) });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update takeoff" });
  }
});

router.post("/lead/:id/notes", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

    const leadId = String(req.params.id);
    const text = String(req.body?.text ?? "").trim();
    if (!text) return res.status(400).json({ success: false, message: "Note text is required" });

    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { technicalAssignments: true, technicalNotes: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: "Project not found" });

    const allowed = parseTechnicalAssignments(existing.technicalAssignments).some((a) =>
      assignmentBelongsToEstimator(a, me),
    );
    if (!allowed) {
      return res.status(403).json({ success: false, message: "This project is not assigned to you" });
    }

    const next = appendTechnicalNote(existing.technicalNotes, text);
    const note = next[next.length - 1];
    await prisma.lead.update({
      where: { id: leadId },
      data: { technicalNotes: serializeTechnicalNotes(next) },
    });
    return res.json({ success: true, note, technicalNotes: next });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to add note" });
  }
});

export default router;
