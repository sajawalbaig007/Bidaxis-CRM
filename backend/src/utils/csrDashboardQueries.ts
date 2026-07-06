import type { Prisma } from "@prisma/client";
import prisma from "../config/db";
import {
  importantOnlyWhere,
  isInterestedStatusWhere,
  scheduledCallWhere,
} from "./adminClientQueries";
import { wonClientStatusWhere } from "./projectLeads";
import { NOT_INTERESTED_LIMIT, NOT_PICKED_LIMIT, activeCsrLeadWhere, mainPipelineWhere, pendingLeadWhere } from "./binLeads";
import { CSR_DASHBOARD_LEAD_SELECT } from "./csrLeadSelect";

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
  | "inhouse";

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
    default:
      return base;
  }
}

export async function getCsrLeadStats(csrId: string) {
  const base = activeCsrLeadWhere(csrId);

  const [
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
  ] = await Promise.all([
    prisma.lead.count({ where: pendingLeadWhere(csrId) }),
    prisma.lead.count({ where: { ...base, ...importantOnlyWhere() } }),
    prisma.lead.count({ where: { ...base, ...scheduledCallWhere() } }),
    prisma.lead.count({ where: { ...base, ...isInterestedStatusWhere() } }),
    prisma.lead.count({ where: { ...base, ...wonClientStatusWhere() } }),
    prisma.lead.count({ where: buildCsrTabWhere(csrId, "notinterested") }),
    prisma.lead.count({ where: buildCsrTabWhere(csrId, "notpicked") }),
    prisma.lead.count({ where: buildCsrTabWhere(csrId, "noowner") }),
    prisma.lead.count({ where: buildCsrTabWhere(csrId, "notinservice") }),
    prisma.lead.count({ where: buildCsrTabWhere(csrId, "inhouse") }),
    prisma.lead.count({ where: base }),
    prisma.lead.count({ where: mainPipelineWhere(csrId) }),
  ]);

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
    totalLeads: mainPipelineCount,
  };
}

export function mapDashboardLead<T extends { _count: { notes: number }; notes?: { id: string; text: string; createdAt: Date }[] }>(
  lead: T,
) {
  const { _count, notes, ...rest } = lead as T & { notes?: { id: string; text: string; createdAt: Date }[] };
  const latest = notes?.[0];
  return {
    ...rest,
    noteCount: _count.notes,
    latestNote: latest
      ? { id: latest.id, text: latest.text, createdAt: latest.createdAt }
      : null,
  };
}

const LEAD_LIST_SELECT = {
  ...CSR_DASHBOARD_LEAD_SELECT,
  notes: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { id: true, text: true, createdAt: true },
  },
};

export async function fetchCsrTabLeads(opts: {
  csrId: string;
  tab: CsrTabKey;
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
}) {
  const { csrId, tab, page, pageSize, from, to } = opts;
  const where: Prisma.LeadWhereInput = { ...buildCsrTabWhere(csrId, tab) };

  if (from || to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (from) createdAt.gte = new Date(`${from}T00:00:00.000Z`);
    if (to)   createdAt.lte = new Date(`${to}T23:59:59.999Z`);
    where.createdAt = createdAt;
  }

  const [total, rawLeads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      select: LEAD_LIST_SELECT,
      orderBy: { updatedAt: "desc" },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
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

/** Potential clients — important / schedule / interested only */
export async function fetchPotentialLeads(csrId: string) {
  const where: Prisma.LeadWhereInput = {
    ...activeCsrLeadWhere(csrId),
    OR: [
      importantOnlyWhere(),
      scheduledCallWhere(),
      isInterestedStatusWhere(),
    ],
  };

  const rawLeads = await prisma.lead.findMany({
    where,
    select: LEAD_LIST_SELECT,
    orderBy: { updatedAt: "desc" },
  });

  return rawLeads.map(mapDashboardLead);
}
