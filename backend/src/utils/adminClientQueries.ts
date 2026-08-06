import type { Prisma } from "@prisma/client";

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



export function buildAdminClientViewWhere(view: AdminClientView): Prisma.LeadWhereInput {

  switch (view) {

    case "important":  return importantOnlyWhere();

    case "schedule":   return scheduledCallWhere();

    case "interested": return isInterestedStatusWhere();

    case "closed":

      return { status: { in: ["closed", "completed", "Close Client", "close client"] } };

    default:           return {};

  }

}



export function buildAdminClientListWhere(

  view: AdminClientView,

  csrName?: string,

  search?: string,

  scheduleDate?: string,

): Prisma.LeadWhereInput {

  const parts: Prisma.LeadWhereInput[] = [buildAdminClientViewWhere(view)];



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

        { name:    { contains: q } },

        { company: { contains: q } },

        { phone:   { contains: q } },

        { email:   { contains: q } },

      ],

    });

  }



  return parts.length === 1 ? parts[0] : { AND: parts };

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

  nextSchedule:      true,

  nextTime:          true,

  timezone:          true,

  updatedAt:         true,

  csr: { select: { id: true, name: true, csrCode: true } },

  uploadFile: { select: { companyName: true } },

  _count: { select: { notes: true } },

  notes: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { text: true, createdAt: true },
  },

} satisfies Prisma.LeadSelect;

