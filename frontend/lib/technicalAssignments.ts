export type TechnicalEstimator = {
  id: string;
  name: string;
  code: string;
};

export type TechnicalAssignment = {
  estimatorId: string;
  estimatorName: string;
  manHours: string;
  deadline: string;
  takeoffDone: boolean;
};

export type TechnicalWorkflowTab =
  | "all"
  | "not_assigned"
  | "assigned"
  | "takeoff_done"
  | "pricing"
  | "final_submission";

export function parseTechnicalAssignments(raw: unknown): TechnicalAssignment[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const out: TechnicalAssignment[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const estimatorId = String(o.estimatorId ?? "").trim();
    const estimatorName = String(o.estimatorName ?? "").trim();
    if (!estimatorId && !estimatorName) continue;
    out.push({
      estimatorId: estimatorId || estimatorName,
      estimatorName: estimatorName || estimatorId,
      manHours: String(o.manHours ?? "").trim(),
      deadline: String(o.deadline ?? "").trim().split("T")[0],
      takeoffDone: o.takeoffDone === true,
    });
  }
  return out;
}

export function projectReceiveDate(p: {
  technicalReceivedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}): string | null {
  return p.technicalReceivedAt || p.createdAt || p.updatedAt || null;
}

export function matchesTechnicalTab(
  tab: TechnicalWorkflowTab,
  p: { projectPhase?: string | null; technicalAssignments?: unknown },
): boolean {
  const phase = (p.projectPhase ?? "not_started").toLowerCase();
  const assignments = parseTechnicalAssignments(p.technicalAssignments);
  const hasAssign = assignments.length > 0;

  switch (tab) {
    case "all":
      return true;
    case "not_assigned":
      return !hasAssign;
    case "assigned":
      return hasAssign && phase === "not_started";
    case "takeoff_done":
      return hasAssign && (phase === "takeoff_started" || phase === "takeoff_completed");
    case "pricing":
      return phase === "pricing_phase";
    case "final_submission":
      return phase === "qa_phase" || phase === "delivery_phase";
    default:
      return true;
  }
}
