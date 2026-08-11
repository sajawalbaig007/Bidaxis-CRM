import prisma from "../config/db";
import { notInBinFilter } from "./binLeads";
import { clientIdentityKey, isWonClientStatus } from "./leadClientPromotion";
import { buildProjectLeadWhere, isDisplayableProjectLead } from "./projectLeads";
import {
  assignmentElapsedSeconds,
  listTechnicalEstimators,
  parseTechnicalAssignments,
} from "./technicalEstimators";
import {
  ESTIMATOR_KPI_FIELD_KEYS,
  isEstimatorKpiFieldKey,
  monthBounds,
  type EstimatorKpiFieldKey,
} from "./technicalKpiRecords";
import { CSR_REPORT_TIMEZONE, formatDurationMs } from "./estTime";

export type EstimatorKpiAutoField = {
  fieldKey: EstimatorKpiFieldKey;
  value: string;
  note: string;
  /** Fields that cannot be auto-derived stay null */
  auto: boolean;
};

export type EstimatorKpiAutoRow = {
  estimatorId: string;
  name: string;
  code: string;
  fields: EstimatorKpiAutoField[];
};

function formatShortEst(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CSR_REPORT_TIMEZONE,
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(value);
}

function formatDayKeyEst(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CSR_REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function hoursLabel(seconds: number): string {
  const h = Math.max(0, seconds) / 3600;
  if (h < 10) return `${h.toFixed(1)}h`;
  return `${Math.round(h * 10) / 10}h`;
}

function parseManHours(raw: string): number {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function assignmentOverdue(deadline: string, takeoffDone: boolean, todayYmd: string): boolean {
  if (takeoffDone || !deadline) return false;
  return deadline < todayYmd;
}

function leadTouchesMonth(
  lead: { technicalReceivedAt?: Date | null; updatedAt: Date },
  bounds: { from: Date; to: Date },
): boolean {
  const received = lead.technicalReceivedAt ?? lead.updatedAt;
  if (received >= bounds.from && received < bounds.to) return true;
  return lead.updatedAt >= bounds.from && lead.updatedAt < bounds.to;
}

type WonIdentityLead = {
  id: string;
  phone?: string | null;
  company?: string | null;
  status?: string | null;
  isOldClient?: boolean;
  createdAt: Date;
};

/** Returning client = flagged old OR had a prior won project before this lead. */
function isRetainedClientLead(
  lead: {
    id: string;
    phone?: string | null;
    company?: string | null;
    isOldClient?: boolean;
    createdAt: Date;
  },
  priorWinsByKey: Map<string, WonIdentityLead[]>,
): boolean {
  if (lead.isOldClient) return true;
  const key = clientIdentityKey(lead);
  const prior = (priorWinsByKey.get(key) ?? []).filter(
    (w) => w.id !== lead.id && w.createdAt.getTime() < lead.createdAt.getTime(),
  );
  return prior.length > 0;
}

function clientLabel(lead: {
  name?: string | null;
  company?: string | null;
  clientCode?: string | null;
  projectCode?: string | null;
}): string {
  return (
    lead.company?.trim() ||
    lead.name?.trim() ||
    lead.clientCode?.trim() ||
    lead.projectCode?.trim() ||
    "Client"
  );
}

/** Auto-computed KPI suggestions for the selected month (still editable when saved). */
export async function buildEstimatorKpiAuto(month: string): Promise<{
  month: string;
  generatedAt: string;
  estimators: EstimatorKpiAutoRow[];
}> {
  const bounds = monthBounds(month);
  if (!bounds) {
    return { month, generatedAt: new Date().toISOString(), estimators: [] };
  }

  const now = Date.now();
  const todayYmd = new Date().toISOString().split("T")[0] ?? "";

  const [roster, rawLeads, wonIdentityLeads, sessions] = await Promise.all([
    listTechnicalEstimators(),
    prisma.lead.findMany({
      where: buildProjectLeadWhere(),
      select: {
        id: true,
        name: true,
        company: true,
        phone: true,
        status: true,
        projectTitle: true,
        projectCode: true,
        clientCode: true,
        isOldClient: true,
        projectPhase: true,
        projectDeadline: true,
        projectWorkStatus: true,
        interestedService: true,
        trade: true,
        technicalAssignments: true,
        technicalReceivedAt: true,
        hiddenOnTechnical: true,
        inBin: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
    prisma.lead.findMany({
      where: {
        ...notInBinFilter(),
        OR: [
          { status: { equals: "Close Client", mode: "insensitive" } },
          { status: { equals: "completed", mode: "insensitive" } },
          { status: { equals: "closed", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        phone: true,
        company: true,
        status: true,
        isOldClient: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    }),
    prisma.csrWorkSession.findMany({
      where: {
        loginAt: { gte: bounds.from, lt: bounds.to },
        user: { role: "estimator" },
      },
      select: {
        userId: true,
        loginAt: true,
        logoutAt: true,
        dashboardMs: true,
        awayMs: true,
      },
      orderBy: { loginAt: "asc" },
      take: 5000,
    }),
  ]);

  const leads = rawLeads
    .filter(isDisplayableProjectLead)
    .filter((l) => (l as { hiddenOnTechnical?: boolean | null }).hiddenOnTechnical !== true)
    .filter((l) => leadTouchesMonth(l, bounds));

  const priorWinsByKey = new Map<string, WonIdentityLead[]>();
  for (const w of wonIdentityLeads) {
    if (!isWonClientStatus(w.status)) continue;
    const key = clientIdentityKey(w);
    const list = priorWinsByKey.get(key) ?? [];
    list.push(w);
    priorWinsByKey.set(key, list);
  }

  type Acc = {
    id: string;
    name: string;
    code: string;
    delivered: number;
    pending: number;
    assigned: number;
    overdue: number;
    onTimeDone: number;
    doneWithDeadline: number;
    loggedSeconds: number;
    plannedHours: number;
    trades: Set<string>;
    projectLines: string[];
    timerHoursSamples: number[];
    retainedProjects: number;
    retainedLines: string[];
  };

  const byId = new Map<string, Acc>();
  for (const e of roster) {
    byId.set(e.id, {
      id: e.id,
      name: e.name,
      code: e.code,
      delivered: 0,
      pending: 0,
      assigned: 0,
      overdue: 0,
      onTimeDone: 0,
      doneWithDeadline: 0,
      loggedSeconds: 0,
      plannedHours: 0,
      trades: new Set(),
      projectLines: [],
      timerHoursSamples: [],
      retainedProjects: 0,
      retainedLines: [],
    });
  }

  const ensure = (estimatorId: string, estimatorName: string): Acc => {
    const existing = byId.get(estimatorId);
    if (existing) return existing;
    const byName = [...byId.values()].find(
      (m) => m.name.trim().toLowerCase() === estimatorName.trim().toLowerCase(),
    );
    if (byName) return byName;
    const created: Acc = {
      id: estimatorId,
      name: estimatorName,
      code: "—",
      delivered: 0,
      pending: 0,
      assigned: 0,
      overdue: 0,
      onTimeDone: 0,
      doneWithDeadline: 0,
      loggedSeconds: 0,
      plannedHours: 0,
      trades: new Set(),
      projectLines: [],
      timerHoursSamples: [],
      retainedProjects: 0,
      retainedLines: [],
    };
    byId.set(estimatorId, created);
    return created;
  };

  for (const lead of leads) {
    const assignments = parseTechnicalAssignments(lead.technicalAssignments);
    if (assignments.length === 0) continue;
    const code = (lead.projectCode ?? lead.clientCode ?? "").trim() || "—";
    const title = (lead.projectTitle ?? "").trim() || "Untitled";
    const retained = isRetainedClientLead(lead, priorWinsByKey);
    const retainedLabel = clientLabel(lead);
    const tradeBits = [
      ...(lead.interestedService ? [lead.interestedService] : []),
      ...(lead.trade ? [lead.trade] : []),
    ];

    for (const a of assignments) {
      const acc = ensure(a.estimatorId, a.estimatorName);
      const logged = assignmentElapsedSeconds(a, now);
      acc.assigned += 1;
      acc.loggedSeconds += logged;
      acc.plannedHours += parseManHours(a.manHours);
      for (const t of tradeBits) if (t.trim()) acc.trades.add(t.trim());
      for (const s of a.scopes) if (s.trim()) acc.trades.add(s.trim());

      if (a.takeoffDone) {
        acc.delivered += 1;
        if (logged > 0) acc.timerHoursSamples.push(logged / 3600);
        if (a.deadline) {
          acc.doneWithDeadline += 1;
          // completed with a deadline set counts as on-time for KPI auto (deadline was met before reopen)
          acc.onTimeDone += 1;
        }
      } else {
        acc.pending += 1;
        if (assignmentOverdue(a.deadline, false, todayYmd)) acc.overdue += 1;
      }

      if (logged > 0 || a.takeoffDone || !a.takeoffDone) {
        const status = a.takeoffDone ? "done" : assignmentOverdue(a.deadline, false, todayYmd) ? "overdue" : "pending";
        acc.projectLines.push(
          `${code} ${title}: ${hoursLabel(logged)}${a.manHours ? ` / ${a.manHours}h planned` : ""} (${status})`,
        );
      }
    }

    if (retained) {
      const credited = new Set<string>();
      for (const a of assignments) {
        if (credited.has(a.estimatorId)) continue;
        credited.add(a.estimatorId);
        const acc = ensure(a.estimatorId, a.estimatorName);
        acc.retainedProjects += 1;
        acc.retainedLines.push(`${retainedLabel} · ${code} ${title}`);
      }
    }
  }

  const sessionsByUser = new Map<string, typeof sessions>();
  for (const s of sessions) {
    const list = sessionsByUser.get(s.userId) ?? [];
    list.push(s);
    sessionsByUser.set(s.userId, list);
  }

  const estimators: EstimatorKpiAutoRow[] = [...byId.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((acc) => {
      const userSessions = sessionsByUser.get(acc.id) ?? [];
      const dayLines: string[] = [];
      let checkInDays = 0;
      let totalDash = 0;
      for (const s of userSessions) {
        checkInDays += 1;
        const end = s.logoutAt ?? new Date();
        const wall = Math.max(0, end.getTime() - s.loginAt.getTime());
        const tracked = Math.max(0, (s.dashboardMs ?? 0) + (s.awayMs ?? 0));
        const totalMs = tracked > 0 ? Math.min(tracked, wall || tracked) : wall;
        totalDash += s.dashboardMs ?? 0;
        const day = formatDayKeyEst(s.loginAt);
        const inLabel = formatShortEst(s.loginAt);
        const outLabel = s.logoutAt ? formatShortEst(s.logoutAt) : "Still checked in";
        dayLines.push(
          `${day}: In ${inLabel} · Out ${outLabel} · ${formatDurationMs(totalMs)} (dash ${formatDurationMs(s.dashboardMs ?? 0)})`,
        );
      }

      const punctuality =
        acc.assigned > 0
          ? `${Math.round(((acc.assigned - acc.overdue) / acc.assigned) * 100)}% on track (${acc.overdue} overdue / ${acc.pending} pending)`
          : "No assignments";

      const avgTakeoff =
        acc.timerHoursSamples.length > 0
          ? `${(acc.timerHoursSamples.reduce((s, n) => s + n, 0) / acc.timerHoursSamples.length).toFixed(1)}h avg timer on completed`
          : acc.delivered > 0
            ? `${acc.delivered} completed (no timer samples)`
            : "No completed takeoffs";

      const productivity =
        acc.assigned > 0
          ? `${hoursLabel(acc.loggedSeconds)} logged · ${acc.plannedHours || 0}h planned · ${acc.delivered}/${acc.assigned} done`
          : userSessions.length > 0
            ? `${formatDurationMs(totalDash)} dashboard time this month`
            : "No timer / session data";

      const projectTime =
        acc.projectLines.length > 0
          ? acc.projectLines.slice(0, 40).join("\n")
          : "No project timer data";

      const checkInOut =
        dayLines.length > 0
          ? `${checkInDays} day(s)\n${dayLines.join("\n")}`
          : "No check-in sessions this month";

      const trades =
        acc.trades.size > 0 ? [...acc.trades].sort((a, b) => a.localeCompare(b)).join(", ") : "No trades/scopes yet";

      const fieldMap: Partial<Record<EstimatorKpiFieldKey, { value: string; note: string; auto: boolean }>> = {
        projects_delivered: {
          value: String(acc.delivered),
          note: `Auto: completed takeoffs this month (${month})`,
          auto: true,
        },
        productivity: {
          value: productivity,
          note: `Auto: assignment timers + planned hours (${month})`,
          auto: true,
        },
        project_time_spent: {
          value: projectTime,
          note: `Auto: per-project timer logged vs planned (${month})`,
          auto: true,
        },
        checkin_checkout: {
          value: checkInOut,
          note: "Auto: daily estimator check-in / check-out (EST)",
          auto: true,
        },
        punctuality: {
          value: punctuality,
          note: `Auto: pending overdue vs assigned (${month})`,
          auto: true,
        },
        avg_takeoff: {
          value: avgTakeoff,
          note: `Auto: average timer hours on completed takeoffs (${month})`,
          auto: true,
        },
        trades_history: {
          value: trades,
          note: `Auto: scopes / trades from assigned projects (${month})`,
          auto: true,
        },
        retained_clients: {
          value: acc.retainedProjects > 0 ? String(acc.retainedProjects) : "",
          note:
            acc.retainedLines.length > 0
              ? `Auto: returning-client projects this month — ${acc.retainedLines.slice(0, 12).join("; ")}`
              : `Auto: returning-client projects credited to estimator (${month})`,
          auto: true,
        },
        team_query_mistakes: { value: "", note: "Manual", auto: false },
        final_remarks: { value: "", note: "Manual", auto: false },
        marks_out_of_10: { value: "", note: "Manual", auto: false },
        rating_stars: { value: "", note: "Manual", auto: false },
      };

      const fields: EstimatorKpiAutoField[] = ESTIMATOR_KPI_FIELD_KEYS.map((key) => {
        const f = fieldMap[key] ?? { value: "", note: "Manual", auto: false };
        return { fieldKey: key, value: f.value, note: f.note, auto: f.auto && !!f.value.trim() };
      });

      return {
        estimatorId: acc.id,
        name: acc.name,
        code: acc.code,
        fields,
      };
    });

  return {
    month,
    generatedAt: new Date().toISOString(),
    estimators,
  };
}

export function autoFieldsForEstimator(
  snapshot: Awaited<ReturnType<typeof buildEstimatorKpiAuto>>,
  estimatorId: string,
): EstimatorKpiAutoField[] {
  const row = snapshot.estimators.find((e) => e.estimatorId === estimatorId);
  return (row?.fields ?? []).filter((f) => f.auto && f.value.trim());
}

export { isEstimatorKpiFieldKey };
