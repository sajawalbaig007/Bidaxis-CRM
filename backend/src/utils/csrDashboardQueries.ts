import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import { getCache, setCache } from "./cache";
import {
  importantOnlyWhere,
  isImportantStatusWhere,
  isInterestedStatusWhere,
  scheduledCallWhere,
} from "./adminClientQueries";
import { wonClientStatusWhere } from "./projectLeads";
import { NOT_INTERESTED_LIMIT, NOT_PICKED_LIMIT, activeCsrLeadWhere, mainPipelineWhere, pendingLeadWhere, statusEquals, statusOneOf } from "./binLeads";
import { CSR_DASHBOARD_LEAD_SELECT } from "./csrLeadSelect";
import { estDateYmd } from "./estTime";
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
  | "notuseful"
  | "followup"
  | "potential";

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
        ...statusEquals(STATUS_NI),
        notInterestedCount: { lt: NOT_INTERESTED_LIMIT },
      };
    case "notpicked":
      return {
        ...activeCsrLeadWhere(csrId),
        ...statusOneOf([...STATUS_NP]),
        notPickedCount: { lt: NOT_PICKED_LIMIT },
      };
    case "noowner":
      return { ...base, ...statusEquals("no owner available") };
    case "notinservice":
      return { ...base, ...statusEquals("not in service") };
    case "inhouse":
      return { ...base, ...statusEquals("in house") };
    case "notuseful":
      return { ...base, ...statusEquals("Not useful") };
    case "followup":
      return {
        OR: (
          ["notinterested", "notpicked", "noowner", "notinservice", "inhouse", "notuseful"] as const
        ).map(name => buildCsrTabWhere(csrId, name)),
      };
    case "potential":
      return {
        ...base,
        OR: [importantOnlyWhere(), scheduledCallWhere(), isInterestedStatusWhere()],
      };
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

type SlimFilterRow = Prisma.LeadGetPayload<{ select: typeof CSR_FILTER_LEAD_SELECT }>;

const slimRowCache = new Map<string, { at: number; rows: SlimFilterRow[] }>();
const phoneRowCache = new Map<string, { at: number; rows: { id: string; phone: string | null }[] }>();
const SLIM_ROW_TTL_MS = 60_000;

/** Drop the in-memory filter scan after a lead write so the next filter is fresh. */
export function clearCsrFilterRowCache(csrId?: string): void {
  if (!csrId) {
    slimRowCache.clear();
    phoneRowCache.clear();
    return;
  }
  const prefix = `${csrId}:`;
  for (const key of slimRowCache.keys()) {
    if (key.startsWith(prefix)) slimRowCache.delete(key);
  }
  for (const key of phoneRowCache.keys()) {
    if (key.startsWith(prefix)) phoneRowCache.delete(key);
  }
}

/** 11-digit numbers that start with 1 are the same client as the 10-digit number. */
function phoneIdentity(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length < 7) return null;
  return digits;
}

function uniqueByPhone<T extends { id: string; phone?: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = phoneIdentity(row.phone) ?? `id:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function loadPhoneRows(cacheKey: string, where: Prisma.LeadWhereInput) {
  const hit = phoneRowCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SLIM_ROW_TTL_MS) return hit.rows;
  const rows = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: { id: true, phone: true },
  });
  phoneRowCache.set(cacheKey, { at: Date.now(), rows });
  return rows;
}

async function loadSlimRows(
  cacheKey: string,
  where: Prisma.LeadWhereInput,
): Promise<SlimFilterRow[]> {
  const hit = slimRowCache.get(cacheKey);
  if (hit && Date.now() - hit.at < SLIM_ROW_TTL_MS) return hit.rows;
  const rows = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: CSR_FILTER_LEAD_SELECT,
  });
  slimRowCache.set(cacheKey, { at: Date.now(), rows });
  return rows;
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
  let notUsefulCount = 0;
  let nearNotInterestedCount = 0;
  let nearNotPickedCount = 0;
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
      if ((row.notInterestedCount ?? 0) >= NOT_INTERESTED_LIMIT - 1) nearNotInterestedCount += 1;
    } else if (
      (status === "not picked" || status === "not completed") &&
      (row.notPickedCount ?? 0) < NOT_PICKED_LIMIT
    ) {
      notPickedCount += 1;
      if ((row.notPickedCount ?? 0) >= NOT_PICKED_LIMIT - 1) nearNotPickedCount += 1;
    } else if (status === "not useful") notUsefulCount += 1;
    else if (status === "no owner available") noOwnerCount += 1;
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
    notUsefulCount,
    nearNotInterestedCount,
    nearNotPickedCount,
    scheduledTodayCount: 0,
    interestedWithServiceCount: 0,
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
    const rows = await loadSlimRows(
      `${csrId}:${from ?? ""}:${to ?? ""}:stats`,
      range(base),
    );
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
    notUsefulCount,
    nearNotInterestedCount,
    nearNotPickedCount,
    scheduledTodayCount,
    interestedWithServiceCount,
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
    prisma.lead.count({ where: range(buildCsrTabWhere(csrId, "notuseful")) }),
    prisma.lead.count({
      where: range({
        ...buildCsrTabWhere(csrId, "notinterested"),
        notInterestedCount: { gte: NOT_INTERESTED_LIMIT - 1, lt: NOT_INTERESTED_LIMIT },
      }),
    }),
    prisma.lead.count({
      where: range({
        ...buildCsrTabWhere(csrId, "notpicked"),
        notPickedCount: { gte: NOT_PICKED_LIMIT - 1, lt: NOT_PICKED_LIMIT },
      }),
    }),
    prisma.lead.count({
      where: range({
        ...base,
        ...scheduledCallWhere(),
        nextSchedule: estDateYmd(),
      }),
    }),
    prisma.lead.count({
      where: range({
        ...base,
        ...isInterestedStatusWhere(),
        NOT: { OR: [{ interestedService: null }, { interestedService: "" }] },
      }),
    }),
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
    notUsefulCount,
    nearNotInterestedCount,
    nearNotPickedCount,
    scheduledTodayCount,
    interestedWithServiceCount,
    totalAssigned,
    mainPipelineCount,
    /** All assigned leads (non-bin) — use for dashboard totals; no row cap. */
    totalLeads: totalAssigned,
  };
}

export function mapDashboardLead<T extends {
  _count?: { notes: number };
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
    noteCount: _count?.notes ?? tableNotes.length,
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
  if (filters?.schedule?.trim()) where.nextSchedule = filters.schedule.trim();

  const dedupe = tab !== "projectwon";

  if (!hasCsrTableFilters(filters)) {
    if (!dedupe) {
      const skip = (page - 1) * pageSize;
      const [total, rawLeads] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
          where,
          orderBy: { createdAt: "asc" },
          skip,
          take: pageSize,
          select: LEAD_LIST_SELECT,
        }),
      ]);
      return {
        leads: rawLeads.map(mapDashboardLead),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }
    const phoneRows = await loadPhoneRows(`${csrId}:${tab}:${from ?? ""}:${to ?? ""}:phones`, where);
    const unique = uniqueByPhone(phoneRows);
    const total = unique.length;
    const pageIds = unique.slice((page - 1) * pageSize, page * pageSize).map(row => row.id);
    const rawLeads = pageIds.length
      ? await prisma.lead.findMany({ where: { id: { in: pageIds } }, select: LEAD_LIST_SELECT })
      : [];
    return {
      leads: reorderByIds(rawLeads, pageIds).map(mapDashboardLead),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const rows = await loadSlimRows(
    `${csrId}:${tab}:${from ?? ""}:${to ?? ""}:tab`,
    where,
  );
  const filteredRows = rows.filter(row => leadMatchesTableFilters(row, filters));
  const matched = dedupe ? uniqueByPhone(filteredRows) : filteredRows;
  const total = matched.length;
  const pageRows = matched.slice((page - 1) * pageSize, page * pageSize);
  const pageIds = pageRows.map(row => row.id);
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
  const { notes: _notes, _count: _noteCount, ...potentialSelect } = LEAD_LIST_SELECT;
  const rawLeads = await prisma.lead.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: potentialSelect,
  });

  const ordered = rawLeads.filter(isPotentialClientLead);
  return ordered.map(mapDashboardLead);
}
