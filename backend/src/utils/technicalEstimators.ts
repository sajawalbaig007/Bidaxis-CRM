import prisma from "../config/db";

/** Estimator roster for Technical Active Projects (aligned with payroll seed). */
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

/** Prefer live estimator users; fall back to payroll seed names. */
export async function listTechnicalEstimators(): Promise<TechnicalEstimator[]> {
  try {
    const users = await prisma.user.findMany({
      where: { role: "estimator", isActive: true },
      select: { id: true, name: true, csrCode: true },
      orderBy: { name: "asc" },
    });
    if (users.length > 0) {
      return users.map((u, i) => ({
        id: u.id,
        name: u.name,
        code: (u.csrCode ?? "").trim() || `EST-${String(i + 1).padStart(2, "0")}`,
      }));
    }
  } catch {
    /* schema may not have estimator role yet — use seed */
  }
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
