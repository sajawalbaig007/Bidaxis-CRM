import type { Prisma } from "@prisma/client";

/** Statuses that appear on CSR / admin Active Projects pages */
export const PROJECT_LEAD_STATUSES = ["Close Client", "completed", "close client"];

export function buildProjectLeadWhere(csrId?: string): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    status: { in: [...PROJECT_LEAD_STATUSES] },
    OR: [
      { projectTitle: { not: null } },
      { AND: [{ isOldClient: true }, { clientCode: { not: null } }] },
    ],
  };
  if (csrId) where.assignedTo = csrId;
  return where;
}

export function isDisplayableProjectLead(lead: {
  status?: string | null;
  projectTitle?: string | null;
  isOldClient?: boolean;
  clientCode?: string | null;
}): boolean {
  const st = (lead.status ?? "").toLowerCase();
  if (st !== "close client" && st !== "completed") return false;
  if (lead.projectTitle?.trim()) return true;
  if (lead.isOldClient && lead.clientCode) return true;
  return lead.projectTitle != null && lead.projectTitle !== "";
}
