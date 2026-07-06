import prisma from "../config/db";
import { findLeadsByPhone } from "./leadPhoneLookup";
import { deleteLeadsCascade } from "./deleteLeadsCascade";

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

/** Remove duplicate pending call-data rows once the client is won / moved to old clients. */
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

export async function hasPriorWonClient(
  phone: string | null | undefined,
  company: string | null | undefined,
  excludeLeadId?: string,
): Promise<boolean> {
  if (phone?.trim()) {
    const related = await findLeadsByPhone(phone);
    if (related.some(l => l.id !== excludeLeadId && isWonClientStatus(l.status))) {
      return true;
    }
  }

  const companyTrim = company?.trim();
  if (companyTrim) {
    const previousWin = await prisma.lead.findFirst({
      where: {
        ...(excludeLeadId ? { id: { not: excludeLeadId } } : {}),
        company: { equals: companyTrim, mode: "insensitive" },
        status:  { in: ["Close Client", "completed"] },
      },
    });
    if (previousWin) return true;
  }

  return false;
}
