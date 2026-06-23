import prisma from "../config/db";
import { invalidateCache, flushAdminClientsCache } from "./cache";

/** Remove leads and all child records (notes, sub-contacts, call logs) */
export async function deleteLeadsCascade(leadIds: string[]): Promise<number> {
  if (leadIds.length === 0) return 0;

  await Promise.all([
    prisma.leadNote.deleteMany({ where: { leadId: { in: leadIds } } }),
    prisma.subContact.deleteMany({ where: { leadId: { in: leadIds } } }),
    prisma.callLog.deleteMany({ where: { leadId: { in: leadIds } } }),
  ]);

  const { count } = await prisma.lead.deleteMany({ where: { id: { in: leadIds } } });
  return count;
}

/** Clear CSR + admin caches so dashboards reflect DB deletions immediately */
export async function invalidateAllLeadCaches(csrIds?: string[]): Promise<void> {
  const ids = csrIds?.length
    ? csrIds
    : (await prisma.user.findMany({ where: { role: "csr" }, select: { id: true } })).map(c => c.id);

  flushAdminClientsCache();
  invalidateCache(
    "admin:csrs",
    ...ids.flatMap(csrId => [
      `csr:dashboard:${csrId}`,
      `csr:leads:${csrId}`,
      `csr:projects:${csrId}`,
      `csr:not-interested:${csrId}`,
    ])
  );
}
