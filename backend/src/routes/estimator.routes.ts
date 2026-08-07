import express from "express";
import prisma from "../config/db";
import { verifyToken, AuthRequest } from "../middleware/auth.middleware";
import { allowRoles } from "../middleware/role.middleware";
import { buildProjectLeadWhere, isDisplayableProjectLead } from "../utils/projectLeads";
import {
  assignmentBelongsToEstimator,
  parseTechnicalAssignments,
  serializeTechnicalAssignments,
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

router.get("/projects", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

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
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

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
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });

    const mine = raw
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

router.put("/project/:id/takeoff", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const leadId = String(req.params.id);
    const takeoffDone = req.body?.takeoffDone === true;

    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { technicalAssignments: true, assignedTo: true, projectPhase: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }

    const list = parseTechnicalAssignments(existing.technicalAssignments);
    const idx = list.findIndex((a) => assignmentBelongsToEstimator(a, me));
    if (idx < 0) {
      return res.status(403).json({ success: false, message: "This project is not assigned to you" });
    }

    list[idx] = { ...list[idx], takeoffDone };
    const allDone = list.length > 0 && list.every((a) => a.takeoffDone);
    const anyDone = list.some((a) => a.takeoffDone);
    let nextPhase = existing.projectPhase ?? "not_started";
    if (allDone) nextPhase = "takeoff_completed";
    else if (anyDone && (nextPhase === "not_started" || !nextPhase)) nextPhase = "takeoff_started";
    else if (!allDone && nextPhase === "takeoff_completed") nextPhase = "takeoff_started";

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        technicalAssignments: serializeTechnicalAssignments(list),
        projectPhase: nextPhase,
      },
      include: projectInclude(),
    });

    const mineAsg = parseTechnicalAssignments(lead.technicalAssignments).find((a) =>
      assignmentBelongsToEstimator(a, me),
    );

    invalidatePattern("admin:projects:");
    invalidateCache(`csr:projects:${lead.assignedTo}`);

    return res.json({ success: true, lead: { ...lead, myAssignment: mineAsg } });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to update takeoff" });
  }
});

router.post("/lead/:id/notes", async (req: AuthRequest, res) => {
  try {
    const me = await currentEstimator(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const leadId = String(req.params.id);
    const text = String(req.body?.text ?? "").trim();
    if (!text) {
      return res.status(400).json({ success: false, message: "Note text is required" });
    }

    const existing = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { technicalAssignments: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Project not found" });
    }
    const allowed = parseTechnicalAssignments(existing.technicalAssignments).some((a) =>
      assignmentBelongsToEstimator(a, me),
    );
    if (!allowed) {
      return res.status(403).json({ success: false, message: "This project is not assigned to you" });
    }

    const note = await prisma.leadNote.create({
      data: { leadId, text },
    });
    return res.json({ success: true, note });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: "Failed to add note" });
  }
});

export default router;
