import type { Prisma } from "@prisma/client";
import { wonClientStatusWhere } from "./projectLeads";
import { notInBinFilter } from "./binLeads";
import { parseProjectCodeSeq } from "./nextProjectCode";

export type AdminClientView = "all" | "important" | "schedule" | "interested" | "closed";

/**
 * Status is the source of truth for page routing.
 * Do not OR with boolean flags alone — stale important/interested flags
 * were putting leads on the wrong CSR pages after status changes.
 */
export function isImportantStatusWhere(): Prisma.LeadWhereInput {
  return { status: { equals: "important", mode: "insensitive" } };
}

export function isInterestedStatusWhere(): Prisma.LeadWhereInput {
  return { status: { equals: "interested", mode: "insensitive" } };
}



export function leadHasMeetingDate(nextSchedule?: string | null): boolean {
  return !!(nextSchedule && String(nextSchedule).trim());
}

function noScheduleWhere(): Prisma.LeadWhereInput {
  return {
    OR: [
      { nextSchedule: { isSet: false } },
      { nextSchedule: null },
      { nextSchedule: "" },
    ],
  };
}

function hasScheduleWhere(): Prisma.LeadWhereInput {
  return {
    AND: [
      { nextSchedule: { isSet: true } },
      { NOT: { nextSchedule: "" } },
    ],
  };
}



/** Important flag only — no scheduled meeting date (matches CSR isImportantOnly) */

export function importantOnlyWhere(): Prisma.LeadWhereInput {

  return {

    AND: [isImportantStatusWhere(), noScheduleWhere()],

  };

}



/** Important + meeting scheduled (matches CSR isScheduledCall) */

export function scheduledCallWhere(): Prisma.LeadWhereInput {

  return {

    AND: [isImportantStatusWhere(), hasScheduleWhere()],

  };

}



/** CSR Clients page: won deals assigned to a CSR, not in bin (New + Old). */
export function closedClientStatusWhere(): Prisma.LeadWhereInput {
  return {
    AND: [
      wonClientStatusWhere(),
      notInBinFilter(),
      { csr: { is: { role: "csr" } } },
    ],
  };
}

/** Important + Schedule + Interested + Closed (Admin Leads "All" pill). */
export function allAdminClientViewsWhere(): Prisma.LeadWhereInput {
  return {
    OR: [
      importantOnlyWhere(),
      scheduledCallWhere(),
      isInterestedStatusWhere(),
      closedClientStatusWhere(),
    ],
  };
}

export type AdminClientBucket = Exclude<AdminClientView, "all">;

export function adminClientBucket(
  status?: string | null,
  nextSchedule?: string | null,
): AdminClientBucket | null {
  const s = (status ?? "").toLowerCase();
  const hasSchedule = leadHasMeetingDate(nextSchedule);
  if (s === "important") return hasSchedule ? "schedule" : "important";
  if (s === "interested") return "interested";
  if (s === "close client" || s === "completed" || s === "closed") return "closed";
  return null;
}

export type AdminIdentityLead = {
  id: string;
  phone?: string | null;
  company?: string | null;
  clientCode?: string | null;
  projectCode?: string | null;
};

/** `CODE-01` / `code-02` → family key from the part before `-`. */
export function clientCodeFamilyKey(
  clientCode?: string | null,
  projectCode?: string | null,
): string | null {
  const raw = (clientCode ?? "").trim() || (projectCode ?? "").trim();
  if (!raw) return null;
  const parsed = parseProjectCodeSeq(raw);
  const base = (parsed?.base ?? raw).trim();
  return base ? `code:${base.toLowerCase()}` : null;
}

export function adminLeadIdentityKey(lead: AdminIdentityLead, preferClientCode: boolean): string {
  if (preferClientCode) {
    const codeKey = clientCodeFamilyKey(lead.clientCode, lead.projectCode);
    if (codeKey) return codeKey;
  }
  const digits = (lead.phone ?? "").replace(/\D/g, "");
  const co = (lead.company ?? "").trim().toLowerCase();
  if (digits.length >= 7) return `phone:${digits}`;
  if (co) return `company:${co}`;
  return `id:${lead.id}`;
}

export function dedupeAdminLeads<T extends AdminIdentityLead>(
  leads: T[],
  preferClientCode = false,
): {
  unique: T[];
  extraProjectCountById: Map<string, number>;
  extraProjectSuffixesById: Map<string, string[]>;
} {
  const groups = new Map<string, T[]>();
  for (const lead of leads) {
    const key = adminLeadIdentityKey(lead, preferClientCode);
    const group = groups.get(key);
    if (group) group.push(lead);
    else groups.set(key, [lead]);
  }
  const unique: T[] = [];
  const extraProjectCountById = new Map<string, number>();
  const extraProjectSuffixesById = new Map<string, string[]>();
  for (const group of groups.values()) {
    const representative = group[0]!;
    unique.push(representative);
    const seen = new Set<string>();
    const extras: { suffix: string; seq: number }[] = [];
    const repRaw = (representative.clientCode || representative.projectCode || "").trim().toLowerCase();
    for (const lead of group) {
      const raw = (lead.clientCode || lead.projectCode || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      if (seen.has(key) || key === repRaw) continue;
      seen.add(key);
      const parsed = parseProjectCodeSeq(raw);
      const m = raw.match(/-(\d+)$/);
      extras.push({
        suffix: m?.[1] ?? (parsed ? String(parsed.seq) : raw),
        seq: parsed?.seq ?? Number.MAX_SAFE_INTEGER,
      });
    }
    extras.sort((a, b) => a.seq - b.seq || a.suffix.localeCompare(b.suffix));
    const suffixes = extras.map(e => e.suffix);
    extraProjectSuffixesById.set(representative.id, suffixes);
    extraProjectCountById.set(representative.id, suffixes.length);
  }
  return { unique, extraProjectCountById, extraProjectSuffixesById };
}

/** Same uniqueness as CSR Clients: one row per phone, else company, else id. */
export function uniqueLeadsByClientIdentity<T extends AdminIdentityLead>(leads: T[]): T[] {
  return dedupeAdminLeads(leads, false).unique;
}

/** Closed / old clients: one row per client-code prefix (`CODE` in `CODE-01`). */
export function uniqueClosedLeadsByClientCode<T extends AdminIdentityLead>(leads: T[]): T[] {
  return dedupeAdminLeads(leads, true).unique;
}

/** @deprecated alias — use uniqueLeadsByClientIdentity */
export const uniqueLeadsByPhone = uniqueLeadsByClientIdentity;

export function buildAdminClientViewWhere(view: AdminClientView): Prisma.LeadWhereInput {
  switch (view) {
    case "important":  return importantOnlyWhere();
    case "schedule":   return scheduledCallWhere();
    case "interested": return isInterestedStatusWhere();
    case "closed":     return closedClientStatusWhere();
    case "all":        return allAdminClientViewsWhere();
    default:           return allAdminClientViewsWhere();
  }
}



export function buildAdminClientListWhere(
  view: AdminClientView | "important_status",
  csrName?: string,
  search?: string,
  scheduleDate?: string,
  extras?: {
    state?: string;
    phonePrefix?: string;
    areaCodes?: string[];
  },
): Prisma.LeadWhereInput {
  const parts: Prisma.LeadWhereInput[] = [
    view === "important_status" ? isImportantStatusWhere() : buildAdminClientViewWhere(view),
  ];

  if (csrName && csrName !== "all") {
    parts.push({ csr: { name: csrName } });
  }

  if (scheduleDate && view === "schedule") {
    parts.push({ nextSchedule: scheduleDate });
  }

  const q = search?.trim();
  if (q) {
    parts.push({
      OR: [
        { name: { contains: q } },
        { company: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { ownerName: { contains: q } },
        { projectTitle: { contains: q } },
        { projectCode: { contains: q } },
        { clientCode: { contains: q } },
        { interestedService: { contains: q } },
        { status: { contains: q } },
        { comments: { contains: q } },
        { projectNotes: { contains: q } },
        { state: { contains: q } },
        { csr: { is: { name: { contains: q } } } },
        { csr: { is: { csrCode: { contains: q } } } },
      ],
    });
  }

  const phonePrefix = extras?.phonePrefix?.replace(/\D/g, "") ?? "";
  if (phonePrefix) {
    parts.push({ phone: { contains: phonePrefix } });
  }

  const state = extras?.state?.trim() ?? "";
  const areaCodes = (extras?.areaCodes ?? []).map(c => c.replace(/\D/g, "")).filter(c => c.length >= 3);
  if (state) {
    const stateOr: Prisma.LeadWhereInput[] = [
      { state: { contains: state, mode: "insensitive" } },
    ];
    for (const code of areaCodes.slice(0, 40)) {
      stateOr.push({ phone: { contains: code } });
    }
    parts.push({ OR: stateOr });
  }

  return parts.length === 1 ? parts[0]! : { AND: parts };
}



export const ADMIN_LEAD_LIST_SELECT = {

  id:                true,

  name:              true,

  company:           true,

  phone:             true,

  email:             true,

  state:             true,

  status:            true,

  important:         true,

  interested:        true,

  isOldClient:       true,

  clientCode:        true,

  projectCode:       true,

  interestedService: true,

  comments:          true,

  followUpNotes:     true,

  nextSchedule:      true,

  nextTime:          true,

  timezone:          true,

  createdAt:         true,

  updatedAt:         true,

  csr: { select: { id: true, name: true, csrCode: true } },

  uploadFile: { select: { companyName: true } },

  subContacts: {
    select: { id: true, phone: true, email: true, name: true },
  },

  _count: { select: { notes: true } },

  notes: {
    orderBy: { createdAt: "desc" as const },
    take: 5,
    select: { id: true, text: true, createdAt: true, parentId: true },
  },

} satisfies Prisma.LeadSelect;

