import { isProjectActive } from "@/lib/projectFields";

export type TechnicalEstimator = {
  id: string;
  name: string;
  code: string;
};

export const DEFAULT_TECHNICAL_ESTIMATORS: TechnicalEstimator[] = [
  { id: "tech-1", name: "Noman Khan", code: "TECH-01" },
  { id: "tech-2", name: "Muhammad Abdullah", code: "TECH-02" },
  { id: "tech-3", name: "Rizwan Sabir", code: "TECH-03" },
  { id: "tech-4", name: "Usama Jameel", code: "TECH-04" },
  { id: "tech-5", name: "Khaldoon Abrar", code: "TECH-05" },
  { id: "tech-6", name: "Muhammad Zaid", code: "TECH-06" },
  { id: "tech-7", name: "Muhammad Bariq", code: "TECH-07" },
  { id: "tech-8", name: "Afaq", code: "TECH-08" },
];

export type TechnicalAssignment = {
  estimatorId: string;
  estimatorName: string;
  manHours: string;
  deadline: string;
  scopes: string[];
  divisions: string[];
  /** Scope work instructions for the estimator. */
  workDetail: string;
  takeoffDone: boolean;
  timerSeconds: number;
  timerStartedAt: string | null;
};

export const DIVISION_OPTIONS = [
  "Division 1",
  "Division 2",
  "Division 3",
  "Division 4",
  "Division 5",
  "Division 6",
  "Division 7",
  "Division 8",
  "Division 9",
] as const;

function asStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/[,|;/]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function formatScopeSummary(scopes: string[] | undefined | null): string {
  const list = (scopes ?? []).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return "—";
  if (list.length === 1) return list[0]!;
  return `${list[0]} +${list.length - 1}`;
}

export function formatDivisionSummary(divisions: string[] | undefined | null): string {
  const list = (divisions ?? []).map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return "—";
  if (list.length === 1) return list[0]!;
  return `${list[0]} +${list.length - 1}`;
}

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
      scopes: asStringList(o.scopes ?? o.scope),
      divisions: asStringList(o.divisions ?? o.division),
      workDetail: String(o.workDetail ?? o.scopeDetail ?? "").trim(),
      takeoffDone: o.takeoffDone === true,
      timerSeconds: Math.max(0, Math.floor(Number(o.timerSeconds ?? 0) || 0)),
      timerStartedAt: o.timerStartedAt ? String(o.timerStartedAt).trim() || null : null,
    });
  }
  return out;
}

export function assignmentElapsedSeconds(
  a: Pick<TechnicalAssignment, "timerSeconds" | "timerStartedAt">,
  now = Date.now(),
): number {
  let total = a.timerSeconds ?? 0;
  if (a.timerStartedAt) {
    const started = new Date(a.timerStartedAt).getTime();
    if (Number.isFinite(started)) total += Math.max(0, Math.floor((now - started) / 1000));
  }
  return total;
}

export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function projectReceiveDate(p: {
  technicalReceivedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}): string | null {
  return p.technicalReceivedAt || p.createdAt || p.updatedAt || null;
}

const LATE_PHASES = new Set(["pricing_phase", "qa_phase", "delivery_phase"]);

export function matchesTechnicalTab(
  tab: TechnicalWorkflowTab,
  p: {
    projectPhase?: string | null;
    technicalAssignments?: unknown;
    status?: string | null;
    projectDeadline?: string | null;
    projectWorkStatus?: string | null;
  },
): boolean {
  const phase = (p.projectPhase ?? "not_started").toLowerCase();
  const assignments = parseTechnicalAssignments(p.technicalAssignments);
  const hasAssign = assignments.length > 0;
  const anyPending = assignments.some((a) => !a.takeoffDone);
  const allDone = hasAssign && assignments.every((a) => a.takeoffDone);
  const inLatePhase = LATE_PHASES.has(phase);

  switch (tab) {
    case "all":
      return true;
    case "not_assigned":
      // Active projects that are not yet assigned to any estimator
      return !hasAssign && isProjectActive(p);
    case "assigned":
      // Has work still pending — includes reopened from Take Off
      return hasAssign && anyPending && !inLatePhase;
    case "takeoff_done":
      // All estimators completed takeoff
      return allDone && !inLatePhase;
    case "pricing":
      return phase === "pricing_phase";
    case "final_submission":
      return phase === "qa_phase" || phase === "delivery_phase";
    default:
      return true;
  }
}

export type TechnicalWorkflowStatusKey =
  | TechnicalWorkflowTab
  | "completed"
  | "not_completed"
  | "in_progress";

/** Single status label shared by Admin Status column + Technical tabs. */
export function getTechnicalWorkflowStatus(p: {
  projectPhase?: string | null;
  technicalAssignments?: unknown;
  status?: string | null;
  projectDeadline?: string | null;
  projectWorkStatus?: string | null;
}): { key: TechnicalWorkflowStatusKey; label: string } {
  const order: { tab: Exclude<TechnicalWorkflowTab, "all">; label: string }[] = [
    { tab: "final_submission", label: "Final Submission" },
    { tab: "pricing", label: "Pricing" },
    { tab: "takeoff_done", label: "Take Off Done" },
    { tab: "assigned", label: "Assigned" },
    { tab: "not_assigned", label: "Not Assigned" },
  ];
  for (const { tab, label } of order) {
    if (matchesTechnicalTab(tab, p)) return { key: tab, label };
  }

  const work = (p.projectWorkStatus ?? "").toLowerCase();
  if (work === "completed" || (p.status ?? "").toLowerCase() === "completed") {
    return { key: "completed", label: "Completed" };
  }
  if (work === "not_completed") return { key: "not_completed", label: "Not Completed" };
  if (work === "in_progress" || isProjectActive(p)) {
    return { key: "in_progress", label: "In Progress" };
  }
  return { key: "not_completed", label: "Not Completed" };
}

export type TechnicalNoteEntry = {
  id: string;
  text: string;
  createdAt: string;
};

export function parseTechnicalNotes(raw: unknown): TechnicalNoteEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const o = item as Record<string, unknown>;
        const text = String(o.text ?? "").trim();
        if (!text) return null;
        return {
          id: String(o.id ?? ""),
          text,
          createdAt: String(o.createdAt ?? ""),
        };
      })
      .filter((x): x is TechnicalNoteEntry => !!x && !!x.id);
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      return parseTechnicalNotes(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  return [];
}
