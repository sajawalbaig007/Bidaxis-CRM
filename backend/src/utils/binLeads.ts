import type { Prisma } from "@prisma/client";

export const NOT_INTERESTED_LIMIT = 3;
export const NOT_PICKED_LIMIT     = 7;

export type BinReason =
  | "limit-not-picked"
  | "limit-not-interested"
  | "deleted-important"
  | "deleted-interested"
  | "deleted-pending"
  | "deleted-other";

export function binReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "limit-not-picked":      return "Not Picked — limit reached";
    case "limit-not-interested":  return "Not Interested — limit reached";
    case "deleted-important":     return "Deleted (Important)";
    case "deleted-interested":    return "Deleted (Interested)";
    case "deleted-pending":       return "Deleted (Pending)";
    default:                      return reason ? `Deleted (${reason})` : "Bin";
  }
}

export function resolveDeleteBinReason(status: string | null | undefined): BinReason {
  const s = (status ?? "").toLowerCase();
  if (s === "important")  return "deleted-important";
  if (s === "interested") return "deleted-interested";
  if (s === "pending")    return "deleted-pending";
  return "deleted-other";
}

/** Leads still being retried on Not Interested / Not Picked pages */
export function buildActiveRetryWhere(csrId: string): Prisma.LeadWhereInput {
  return {
    assignedTo: csrId,
    inBin:      false,
    OR: [
      {
        status:             "Not Interested",
        notInterestedCount: { lt: NOT_INTERESTED_LIMIT },
      },
      {
        status:         { in: ["not picked", "not completed"] },
        notPickedCount: { lt: NOT_PICKED_LIMIT },
      },
    ],
  };
}

/** CSR or admin bin — limit reached and manually deleted leads */
export function buildBinWhere(csrId?: string): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    OR: [
      { inBin: true },
      {
        AND: [
          { status: { in: ["not picked", "not completed"] } },
          { notPickedCount: { gte: NOT_PICKED_LIMIT } },
        ],
      },
      {
        AND: [
          { status: "Not Interested" },
          { notInterestedCount: { gte: NOT_INTERESTED_LIMIT } },
        ],
      },
    ],
  };
  if (csrId) where.assignedTo = csrId;
  return where;
}

export function isBinLead(lead: {
  inBin?: boolean;
  status?: string | null;
  notPickedCount?: number | null;
  notInterestedCount?: number | null;
}): boolean {
  if (lead.inBin) return true;
  const st = lead.status ?? "";
  if (["not picked", "not completed"].includes(st) && (lead.notPickedCount ?? 0) >= NOT_PICKED_LIMIT) return true;
  if (st === "Not Interested" && (lead.notInterestedCount ?? 0) >= NOT_INTERESTED_LIMIT) return true;
  return false;
}
