import prisma from "../config/db";

/** Estimator roster for Technical Active Projects. */
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
  scopes: string[];
  divisions: string[];
  /** Scope work instructions for the estimator (what to do in this scope). */
  workDetail: string;
  /** Task complete (estimator finished; Miss can reopen to pending). */
  takeoffDone: boolean;
  /** Accumulated work time in seconds (persists across pauses). */
  timerSeconds: number;
  /** ISO timestamp while running; null when paused/idle. */
  timerStartedAt: string | null;
};

/** Sync projectPhase from assignment complete flags (assigned ↔ takeoff). */
export function syncPhaseFromAssignments(
  list: TechnicalAssignment[],
  currentPhase: string | null | undefined,
): string {
  const phase = (currentPhase ?? "not_started").toLowerCase();
  if (phase === "pricing_phase" || phase === "qa_phase" || phase === "delivery_phase") {
    return currentPhase ?? phase;
  }
  if (list.length === 0) return "not_started";
  const allDone = list.every((a) => a.takeoffDone);
  const anyDone = list.some((a) => a.takeoffDone);
  if (allDone) return "takeoff_completed";
  if (anyDone) return "takeoff_started";
  return "not_started";
}

function asStringList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(/[,|;/]+/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

const SEED_ESTIMATORS: TechnicalEstimator[] = [
  { id: "tech-1", name: "Noman Khan", code: "TECH-01" },
  { id: "tech-2", name: "Muhammad Abdullah", code: "TECH-02" },
  { id: "tech-3", name: "Rizwan Sabir", code: "TECH-03" },
  { id: "tech-4", name: "Usama Jameel", code: "TECH-04" },
  { id: "tech-5", name: "Khaldoon Abrar", code: "TECH-05" },
  { id: "tech-6", name: "Muhammad Zaid", code: "TECH-06" },
  { id: "tech-7", name: "Muhammad Bariq", code: "TECH-07" },
  { id: "tech-8", name: "Afaq", code: "TECH-08" },
];

/** Live estimator users from Admin Users (role=estimator). */
export async function listTechnicalEstimators(): Promise<TechnicalEstimator[]> {
  try {
    // Prefer active estimators; if none active, still return inactive so Miss can see roster.
    const users = await prisma.user.findMany({
      where: { role: "estimator" },
      select: { id: true, name: true, csrCode: true, isActive: true },
      orderBy: { name: "asc" },
    });
    const active = users.filter((u) => u.isActive !== false);
    const pool = active.length > 0 ? active : users;
    if (pool.length > 0) {
      return pool.map((u, i) => ({
        id: u.id,
        name: u.name,
        code: (u.csrCode ?? "").trim() || `EST-${String(i + 1).padStart(2, "0")}`,
      }));
    }
  } catch (err) {
    console.error("listTechnicalEstimators failed:", err);
  }
  return [];
}

export function getSeedTechnicalEstimators(): TechnicalEstimator[] {
  return SEED_ESTIMATORS.map((e) => ({ ...e }));
}

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
    const timerSeconds = Math.max(0, Math.floor(Number(o.timerSeconds ?? 0) || 0));
    const startedRaw = o.timerStartedAt != null ? String(o.timerStartedAt).trim() : "";
    out.push({
      estimatorId: estimatorId || estimatorName,
      estimatorName: estimatorName || estimatorId,
      manHours: String(o.manHours ?? "").trim(),
      deadline: String(o.deadline ?? "").trim().split("T")[0],
      scopes: asStringList(o.scopes ?? o.scope),
      divisions: asStringList(o.divisions ?? o.division),
      workDetail: String(o.workDetail ?? o.scopeDetail ?? "").trim(),
      takeoffDone: o.takeoffDone === true,
      timerSeconds,
      timerStartedAt: startedRaw || null,
    });
  }
  return out;
}

export function normalizeTechnicalAssignmentsInput(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  const list = parseTechnicalAssignments(raw);
  return JSON.stringify(list);
}

export function serializeTechnicalAssignments(list: TechnicalAssignment[]): string {
  return JSON.stringify(list);
}

/** Match assignment to logged-in estimator by user id or name. */
export function assignmentBelongsToEstimator(
  a: TechnicalAssignment,
  user: { id: string; name: string },
): boolean {
  if (a.estimatorId === user.id) return true;
  const an = a.estimatorName.trim().toLowerCase();
  const un = user.name.trim().toLowerCase();
  return !!an && !!un && an === un;
}

export function pauseAssignmentTimer(a: TechnicalAssignment, now = Date.now()): TechnicalAssignment {
  if (!a.timerStartedAt) return { ...a, timerStartedAt: null };
  const started = new Date(a.timerStartedAt).getTime();
  const add = Number.isFinite(started) ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  return {
    ...a,
    timerSeconds: a.timerSeconds + add,
    timerStartedAt: null,
  };
}

export function startAssignmentTimer(a: TechnicalAssignment, now = Date.now()): TechnicalAssignment {
  if (a.takeoffDone) return a;
  if (a.timerStartedAt) return a;
  return { ...a, timerStartedAt: new Date(now).toISOString() };
}

export function assignmentElapsedSeconds(a: TechnicalAssignment, now = Date.now()): number {
  let total = a.timerSeconds;
  if (a.timerStartedAt) {
    const started = new Date(a.timerStartedAt).getTime();
    if (Number.isFinite(started)) total += Math.max(0, Math.floor((now - started) / 1000));
  }
  return total;
}

/** Pause running timers for this estimator on specific leads (fast path). */
export async function pauseTimersOnLeadIds(
  user: { id: string; name: string },
  leadIds: string[],
): Promise<void> {
  const ids = [...new Set(leadIds.map(String).filter(Boolean))];
  if (ids.length === 0) return;
  const now = Date.now();
  const leads = await prisma.lead.findMany({
    where: { id: { in: ids } },
    select: { id: true, technicalAssignments: true },
  });
  for (const lead of leads) {
    const list = parseTechnicalAssignments(lead.technicalAssignments);
    let changed = false;
    const next = list.map((a) => {
      if (!assignmentBelongsToEstimator(a, user)) return a;
      if (!a.timerStartedAt) return a;
      changed = true;
      return pauseAssignmentTimer(a, now);
    });
    if (!changed) continue;
    await prisma.lead.update({
      where: { id: lead.id },
      data: { technicalAssignments: serializeTechnicalAssignments(next) },
    });
  }
}

/** Pause any running timers for this estimator on other projects (one active timer). */
export async function pauseOtherRunningTimersForEstimator(
  user: { id: string; name: string },
  exceptLeadId?: string,
): Promise<void> {
  const raw = await prisma.lead.findMany({
    where: {
      technicalAssignments: { not: null },
      ...(exceptLeadId ? { id: { not: exceptLeadId } } : {}),
    },
    select: { id: true, technicalAssignments: true },
    take: 200,
  });

  const now = Date.now();
  for (const lead of raw) {
    const list = parseTechnicalAssignments(lead.technicalAssignments);
    let changed = false;
    const next = list.map((a) => {
      if (!assignmentBelongsToEstimator(a, user)) return a;
      if (!a.timerStartedAt) return a;
      changed = true;
      return pauseAssignmentTimer(a, now);
    });
    if (!changed) continue;
    await prisma.lead.update({
      where: { id: lead.id },
      data: { technicalAssignments: serializeTechnicalAssignments(next) },
    });
  }
}

/** Keep timer / complete flags when Miss re-assigns same estimator. */
export function mergeAssignmentProgress(
  incoming: TechnicalAssignment[],
  previous: TechnicalAssignment[],
): TechnicalAssignment[] {
  return incoming.map((a) => {
    const old = previous.find(
      (p) =>
        p.estimatorId === a.estimatorId ||
        (!!p.estimatorName &&
          !!a.estimatorName &&
          p.estimatorName.toLowerCase() === a.estimatorName.toLowerCase()),
    );
    if (!old) {
      return {
        ...a,
        takeoffDone: false,
        timerSeconds: 0,
        timerStartedAt: null,
      };
    }
    return {
      ...a,
      takeoffDone: old.takeoffDone,
      timerSeconds: old.timerSeconds,
      timerStartedAt: old.takeoffDone ? null : old.timerStartedAt,
    };
  });
}

export type TechnicalNoteEntry = {
  id: string;
  text: string;
  createdAt: string;
};

export function parseTechnicalNotes(raw: unknown): TechnicalNoteEntry[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [{ id: `legacy-${Date.now()}`, text: trimmed, createdAt: new Date().toISOString() }];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: TechnicalNoteEntry[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const text = String(o.text ?? "").trim();
    if (!text) continue;
    out.push({
      id: String(o.id ?? `n-${Date.now()}-${out.length}`),
      text,
      createdAt: String(o.createdAt ?? new Date().toISOString()),
    });
  }
  return out;
}

export function serializeTechnicalNotes(list: TechnicalNoteEntry[]): string {
  return JSON.stringify(list);
}

export function appendTechnicalNote(raw: unknown, text: string): TechnicalNoteEntry[] {
  const list = parseTechnicalNotes(raw);
  const note: TechnicalNoteEntry = {
    id: `tn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  return [...list, note];
}
