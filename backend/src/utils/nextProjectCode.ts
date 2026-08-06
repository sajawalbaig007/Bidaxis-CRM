import prisma from "../config/db";
import { notInBinFilter } from "./binLeads";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Next code for a client: `{base}-1`, `{base}-2`, … based on max existing suffix. */
export async function allocateNextProjectCode(
  baseCode: string,
  opts?: { assignedTo?: string },
): Promise<string> {
  const base = baseCode.trim();
  if (!base) return "";

  const where: Record<string, unknown> = {
    ...notInBinFilter(),
    OR: [
      { clientCode: base },
      { projectCode: base },
      { projectCode: { startsWith: `${base}-` } },
    ],
  };
  if (opts?.assignedTo) where.assignedTo = opts.assignedTo;

  const leads = await prisma.lead.findMany({
    where,
    select: { projectCode: true },
  });

  let max = 0;
  const re = new RegExp(`^${escapeRegex(base)}-(\\d+)$`, "i");
  for (const l of leads) {
    const pc = l.projectCode?.trim();
    if (!pc) continue;
    if (pc.toLowerCase() === base.toLowerCase()) {
      max = Math.max(max, 0);
      continue;
    }
    const m = pc.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }

  return `${base}-${max + 1}`;
}
