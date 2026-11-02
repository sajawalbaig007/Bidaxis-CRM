import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import {
  importantOnlyWhere,
  isImportantStatusWhere,
  isInterestedStatusWhere,
  scheduledCallWhere,
} from "./adminClientQueries";
import { wonClientStatusWhere } from "./projectLeads";
import { NOT_INTERESTED_LIMIT, NOT_PICKED_LIMIT, activeCsrLeadWhere, mainPipelineWhere, pendingLeadWhere } from "./binLeads";
import { CSR_DASHBOARD_LEAD_SELECT } from "./csrLeadSelect";
import {
  isPotentialClientLead,
} from "./potentialClientBuckets";
import { countUniqueWonClients } from "./uniqueWonClients";
import {
  CSR_FILTER_LEAD_SELECT,
  type CsrTableFilters,
  hasCsrTableFilters,
  leadMatchesTableFilters,
} from "./csrLeadTableFilters";

const STATUS_NI = "Not Interested";
const STATUS_NP = ["not picked", "not completed"] as const;

export type CsrTabKey =
  | "today"
  | "pending"
  | "important"
  | "schedule"
  | "interested"
  | "projectwon"
  | "notinterested"
  | "notpicked"
  | "noowner"
  | "notinservice"
  | "inhouse"
  | "notuseful";

export function buildCsrTabWhere(csrId: string, tab: CsrTabKey): Prisma.LeadWhereInput {
  const base = activeCsrLeadWhere(csrId);

  switch (tab) {
    case "today":
    case "pending":
      return pendingLeadWhere(csrId);
    case "important":
      return { ...base, ...importantOnlyWhere() };
    case "schedule":
      return { ...base, ...scheduledCallWhere() };
    case "interested":
      return { ...base, ...isInterestedStatusWhere() };
    case "projectwon":
      return { ...base, ...wonClientStatusWhere() };
    case "notinterested":
      return {
        ...activeCsrLeadWhere(csrId),
        status: { equals: STATUS_NI, mode: "insensitive" },
        notInterestedCount: { lt: NOT_INTERESTED_LIMIT },
      };
    case "notpicked":
      return {
        ...activeCsrLeadWhere(csrId),
        status: { in: [...STATUS_NP], mode: "insensitive" },
        notPickedCount: { lt: NOT_PICKED_LIMIT },
      };
    case "noowner":
      return { ...base, status: { equals: "no owner available", mode: "insensitive" } };
    case "notinservice":
      return { ...base, status: { equals: "not in service", mode: "insensitive" } };
    case "inhouse":
      return { ...base, status: { equals: "in house", mode: "insensitive" } };
    case "notuseful":
      return { ...base, status: { equals: "Not useful", mode: "insensitive" } };
    default:
      return base;
  }
}

function withCreatedRange(
  where: Prisma.LeadWhereInput,
  from?: string,
  to?: string,
): Prisma.LeadWhereInput {
  if (!from && !to) return where;
  const createdAt: Prisma.DateTimeFilter = {};
  if (from) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
  if (to)   createdAt.lte = new Date(`${to}T23:59:59.999Z`);
  return { AND: [where, { createdAt }] };
}

const WON_STATUSES = new Set(["close client", "completed", "closed"]);

function bucketFilteredStats(rows: {
  id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  status: string | null;
  nextSchedule: string | null;
  hiddenOnMain: boolean | null;
  notPickedCount: number | null;
  notInterestedCount: number | null;
}[]) {
  const st = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
  const scheduled = (s: string | null | undefined) => !!(s && String(s).trim());
  let pendingCount = 0;
  let importantOnlyCount = 0;
  let scheduledCount = 0;
  let interestedCount = 0;
  let notInterestedCount = 0;
  let notPickedCount = 0;
  let noOwnerCount = 0;
  let notInServiceCount = 0;
  let inHouseCount = 0;
  let mainPipelineCount = 0;
  const wonRows: { id: string; name: string | null; phone: string | null; company: string | null }[] = [];

  for (const row of rows) {
    if (row.hiddenOnMain !== true) mainPipelineCount += 1;
    const status = st(row.status);
    if (status === "pending") pendingCount += 1;
    else if (status === "important" && !scheduled(row.nextSchedule)) importantOnlyCount += 1;
    else if (status === "important" && scheduled(row.nextSchedule)) scheduledCount += 1;
    else if (status === "interested") interestedCount += 1;
    else if (WON_STATUSES.has(status)) {
      wonRows.push({ id: row.id, name: row.name, phone: row.phone, company: row.company });
    } else if (status === "not interested" && (row.notInterestedCount ?? 0) < NOT_INTERESTED_LIMIT) {
      notInterestedCount += 1;
    } else if (
      (status === "not picked" || status === "not completed") &&
      (row.notPickedCount ?? 0) < NOT_PICKED_LIMIT
    ) {
      notPickedCount += 1;
    } else if (status === "no owner available") noOwnerCount += 1;
    else if (status === "not in service") notInServiceCount += 1;
    else if (status === "in house") inHouseCount += 1;
  }

  return {
    pendingCount,
    importantOnlyCount,
    scheduledCount,
    interestedCount,
    projectWonCount: countUniqueWonClients(wonRows),
    notInterestedCount,
    notPickedCount,
    noOwnerCount,
    notInServiceCount,
    inHouseCount,
    totalAssigned: rows.length,
    mainPipelineCount,
    totalLeads: rows.length,
  };
}

export async function getCsrLeadStats(
  csrId: string,
  from?: string,
  to?: string,
  filters?: CsrTableFilters,
) {
  const base = activeCsrLeadWhere(csrId);
  const range = (where: Prisma.LeadWhereInput) => withCreatedRange(where, from, to);

  if (hasCsrTableFilters(filters)) {
    const rows = await prisma.lead.findMany({
      where: range(base),
      select: CSR_FILTER_LEAD_SELECT,
    });
    const matched = rows.filter(row => leadMatchesTableFilters(row, filters));
    return bucketFilteredStats(matched);
  }

  const [
    pendingCount,
    importantOnlyCount,
    scheduledCount,
    interestedCount,
    wonRows,
    notInterestedCount,
    notPickedCount,
    noOwnerCount,
    notInServiceCount,
    inHouseCount,
    totalAssigned,
    mainPipelineCount,
  ] = await Promise.all([
    prisma.lead.count({ where: range(pendingLeadWhere(csrId)) }),
    prisma.lead.count({ where: range({ ...base, ...importantOnlyWhere() }) }),
    prisma.lead.count({ where: range({ ...base, ...scheduledCallWhere() }) }),
    prisma.lead.count({ where: range({ ...base, ...isInterestedStatusWhere() }) }),
    prisma.lead.findMany({
      where: range({ ...base, ...wonClientStatusWhere() }),
      select: { id: true, name: true, phone: true, company: true },
    }),
    prisma.lead.count({ where: range(buildCsrTabWhere(csrId, "notinterested")) }),
    prisma.lead.count({ where: range(buildCsrTabWhere(csrId, "notpicked")) }),
    prisma.lead.count({ where: range(buildCsrTabWhere(csrId, "noowner")) }),
    prisma.lead.count({ where: range(buildCsrTabWhere(csrId, "notinservice")) }),
    prisma.lead.count({ where: range(buildCsrTabWhere(csrId, "inhouse")) }),
    prisma.lead.count({ where: range(base) }),
    prisma.lead.count({ where: range(mainPipelineWhere(csrId)) }),
  ]);

  const projectWonCount = countUniqueWonClients(wonRows);

  return {
    pendingCount,
    importantOnlyCount,
    scheduledCount,
    interestedCount,
    projectWonCount,
    notInterestedCount,
    notPickedCount,
    noOwnerCount,
    notInServiceCount,
    inHouseCount,
    totalAssigned,
    mainPipelineCount,
    /** All assigned leads (non-bin) — use for dashboard totals; no row cap. */
    totalLeads: totalAssigned,
  };
}

export function mapDashboardLead<T extends {
  _count: { notes: number };
  notes?: { id: string; text: string; createdAt: Date }[];
  comments?: string | null;
  followUpNotes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}>(lead: T) {
  const { _count, notes, comments, followUpNotes, createdAt, updatedAt, ...rest } = lead;
  const tableNotes = notes ?? [];
  const latest = tableNotes[0];
  return {
    ...rest,
    comments,
    followUpNotes,
    createdAt,
    updatedAt,
    notes: tableNotes,
    noteCount: _count.notes,
    latestNote: latest
      ? { id: latest.id, text: latest.text, createdAt: latest.createdAt }
      : null,
  };
}

const LEAD_LIST_SELECT = {
  ...CSR_DASHBOARD_LEAD_SELECT,
  subContacts: {
    orderBy: { createdAt: "asc" as const },
    select: { id: true, name: true, designation: true, phone: true, email: true, createdAt: true },
  },
  notes: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    select: { id: true, text: true, createdAt: true, parentId: true },
  },
};

type OldestNoteSlim = {
  id: string;
  createdAt: Date;
  notes: { createdAt: Date }[];
};

function compareOldestNote(a: OldestNoteSlim, b: OldestNoteSlim): number {
  const ta = a.notes[0]?.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const tb = b.notes[0]?.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return a.createdAt.getTime() - b.createdAt.getTime();
}

export async function fetchLeadIdsByOldestNote(where: Prisma.LeadWhereInput): Promise<string[]> {
  const rows = await prisma.lead.findMany({
    where,
    select: {
      id: true,
      createdAt: true,
      notes: { orderBy: { createdAt: "asc" as const }, take: 1, select: { createdAt: true } },
    },
  });
  rows.sort(compareOldestNote);
  return rows.map(r => r.id);
}

export function reorderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const map = new Map(rows.map(r => [r.id, r]));
  const out: T[] = [];
  for (const id of ids) {
    const row = map.get(id);
    if (row) out.push(row);
  }
  return out;
}

export async function fetchCsrTabLeads(opts: {
  csrId: string;
  tab: CsrTabKey;
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  filters?: CsrTableFilters;
}) {
  const { csrId, tab, page, pageSize, from, to, filters } = opts;
  const where: Prisma.LeadWhereInput = { ...buildCsrTabWhere(csrId, tab) };

  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
    if (to)   createdAt.lte = new Date(`${to}T23:59:59.999Z`);
    where.createdAt = createdAt;
  }

  let ids: string[];
  if (hasCsrTableFilters(filters)) {
    const rows = await prisma.lead.findMany({
      where,
      select: {
        ...CSR_FILTER_LEAD_SELECT,
        notes: { orderBy: { createdAt: "asc" as const }, take: 1, select: { createdAt: true } },
      },
    });
    const matched = rows.filter(row => leadMatchesTableFilters(row, filters));
    matched.sort(compareOldestNote);
    ids = matched.map(row => row.id);
  } else {
    ids = await fetchLeadIdsByOldestNote(where);
  }
  const total = ids.length;
  const pageIds = ids.slice((page - 1) * pageSize, page * pageSize);
  const rawLeads = pageIds.length
    ? await prisma.lead.findMany({
        where: { id: { in: pageIds } },
        select: LEAD_LIST_SELECT,
      })
    : [];

  return {
    leads: reorderByIds(rawLeads, pageIds).map(mapDashboardLead),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Potential clients — important / schedule / interested only */
export async function fetchPotentialLeads(csrId: string) {
  const where: Prisma.LeadWhereInput = {
    ...activeCsrLeadWhere(csrId),
    OR: [isImportantStatusWhere(), isInterestedStatusWhere()],
  };
  const [ids, rawLeads] = await Promise.all([
    fetchLeadIdsByOldestNote(where),
    prisma.lead.findMany({
      where,
      select: LEAD_LIST_SELECT,
    }),
  ]);

  const ordered = reorderByIds(rawLeads, ids).filter(isPotentialClientLead);
  return ordered.map(mapDashboardLead);
}
