import prisma from "../config/db";
import { findLeadsByPhone } from "./leadPhoneLookup";
import { deleteLeadsCascade } from "./deleteLeadsCascade";
import { wonClientStatusWhere } from "./projectLeads";
import { notInBinFilter } from "./binLeads";

export function isPendingPipelineStatus(status: string | null | undefined): boolean {
  return (status ?? "").toLowerCase() === "pending";
}

export function isWonClientStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").toLowerCase();
  return s === "close client" || s === "completed" || s === "closed";
}

export function isWonClientUploadStatus(status: string): boolean {
  return isWonClientStatus(status);
}

/** Won deal that counts as a real project (not a bare pipeline row). */
export function isWonProjectLead(lead: {
  status?: string | null;
  projectTitle?: string | null;
  clientCode?: string | null;
  projectBudget?: string | null;
  projectDeadline?: string | null;
}): boolean {
  if (!isWonClientStatus(lead.status)) return false;
  return !!(
    lead.projectTitle?.trim() ||
    lead.clientCode?.trim() ||
    lead.projectBudget?.trim() ||
    lead.projectDeadline?.trim()
  );
}

/** Old client = this phone/company already had a won project before (excluding current lead). */
export async function hasPriorWonClient(
  phone: string | null | undefined,
  company: string | null | undefined,
  excludeLeadId?: string,
): Promise<boolean> {
  if (phone?.trim()) {
    const related = await findLeadsByPhone(phone);
    if (related.some(l => l.id !== excludeLeadId && isWonProjectLead(l))) {
      return true;
    }
  }

  const companyTrim = company?.trim();
  if (companyTrim) {
    const previousWin = await prisma.lead.findFirst({
      where: {
        ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
        company: { equals: companyTrim, mode: "insensitive" },
        OR: [
          { status: { equals: "Close Client", mode: "insensitive" } },
          { status: { equals: "completed", mode: "insensitive" } },
        ],
        AND: {
          OR: [
            { projectTitle: { not: null } },
            { clientCode: { not: null } },
            { projectBudget: { not: null } },
            { projectDeadline: { not: null } },
          ],
        },
      },
    });
    if (previousWin) return true;
  }

  return false;
}

/** Remove duplicate pending call-data rows once the client is won / moved to clients. */
export async function clearPendingDuplicatesForPhone(
  phone: string | null | undefined,
  csrId: string,
  keepLeadId: string,
): Promise<number> {
  if (!phone?.trim()) return 0;

  const matches = await findLeadsByPhone(phone);
  const pendingDupes = matches.filter(
    l =>
      l.id !== keepLeadId &&
      l.assignedTo === csrId &&
      isPendingPipelineStatus(l.status) &&
      !l.inBin,
  );

  if (pendingDupes.length === 0) return 0;
  return deleteLeadsCascade(pendingDupes.map(l => l.id));
}

export async function clearPendingDuplicatesForCompany(
  company: string | null | undefined,
  csrId: string,
  keepLeadId: string,
): Promise<number> {
  const companyTrim = company?.trim();
  if (!companyTrim) return 0;

  const pendingDupes = await prisma.lead.findMany({
    where: {
      id:         { not: keepLeadId },
      assignedTo: csrId,
      company:    { equals: companyTrim, mode: "insensitive" },
      status:     { equals: "pending", mode: "insensitive" },
      ...notInBinFilter(),
    },
    select: { id: true },
  });

  if (pendingDupes.length === 0) return 0;
  return deleteLeadsCascade(pendingDupes.map(l => l.id));
}

/** Drop stale pending call-data rows when the same phone/company already has a won client. */
export async function healPendingDuplicatesForCsr(csrId: string): Promise<number> {
  const wonLeads = await prisma.lead.findMany({
    where: {
      assignedTo: csrId,
      ...wonClientStatusWhere(),
      ...notInBinFilter(),
    },
    select: { id: true, phone: true, company: true },
  });

  let removed = 0;
  for (const lead of wonLeads) {
    if (lead.phone?.trim()) {
      removed += await clearPendingDuplicatesForPhone(lead.phone, csrId, lead.id);
    }
    if (lead.company?.trim()) {
      removed += await clearPendingDuplicatesForCompany(lead.company, csrId, lead.id);
    }
  }
  return removed;
}

/** Keep isOldClient aligned with real repeat business (prior won project), not duplicate rows. */
export async function syncWonClientOldFlags(csrId: string): Promise<void> {
  const wonLeads = await prisma.lead.findMany({
    where: {
      assignedTo: csrId,
      ...wonClientStatusWhere(),
      ...notInBinFilter(),
    },
    select: { id: true, phone: true, company: true, isOldClient: true },
  });

  await Promise.all(
    wonLeads.map(async lead => {
      const shouldBeOld = await hasPriorWonClient(lead.phone, lead.company, lead.id);
      if (lead.isOldClient !== shouldBeOld) {
        await prisma.lead.update({
          where: { id: lead.id },
          data:  { isOldClient: shouldBeOld },
        });
      }
    }),
  );
}

/** Won clients must never appear on call-data; run before list/stats queries. */
export async function healPipelineLeaksForCsr(csrId: string): Promise<number> {
  await prisma.lead.updateMany({
    where: {
      assignedTo: csrId,
      ...wonClientStatusWhere(),
      hiddenOnMain: false,
    },
    data: { hiddenOnMain: true },
  });

  await syncWonClientOldFlags(csrId);
  return healPendingDuplicatesForCsr(csrId);
}

export function sortNotesNewestFirst<T extends { createdAt?: string | Date | null }>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}
