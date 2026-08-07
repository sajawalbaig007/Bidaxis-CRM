import prisma from "../config/db";
import { invalidateCsrLeadCaches } from "./csrCache";
import { invalidatePattern, flushAdminClientsCache, invalidateCache } from "./cache";

/** Remove leads and all child records (notes, sub-contacts, call logs). */
export async function deleteLeadsCascade(leadIds: string[]): Promise<number> {
  const ids = [...new Set(leadIds.map(String).filter(Boolean))];
  if (ids.length === 0) return 0;

  await Promise.all([
    prisma.leadNote.deleteMany({ where: { leadId: { in: ids } } }),
    prisma.subContact.deleteMany({ where: { leadId: { in: ids } } }),
    prisma.callLog.deleteMany({ where: { leadId: { in: ids } } }),
  ]);

  let deleted = 0;
  for (const id of ids) {
    try {
      await prisma.lead.delete({ where: { id } });
      deleted += 1;
    } catch {
      // Fallback if delete() fails (e.g. already gone / race)
      const res = await prisma.lead.deleteMany({ where: { id } });
      deleted += res.count;
    }
  }

  // Verify — anything still present means delete failed
  const stillThere = await prisma.lead.count({ where: { id: { in: ids } } });
  if (stillThere > 0) {
    // Last resort: remove from Project DB completely (never leave as "Active")
    await prisma.lead.updateMany({
      where: { id: { in: ids } },
      data: {
        projectTitle: null,
        projectCode: null,
        projectDeadline: null,
        projectBudget: null,
        projectNotes: null,
        projectScope: null,
        projectPhase: null,
        projectPayments: null,
        projectWorkStatus: "completed",
        projectSource: null,
        technicalAssignments: null,
        technicalNotes: null,
        technicalReceivedAt: null,
        deadlineTiming: null,
        hiddenOnTechnical: true,
        isOldClient: false,
        clientCode: null,
        inBin: true,
        binReason: "deleted-other",
        status: "completed",
      },
    });
  }

  return deleted;
}

/** Clear CSR + admin caches so dashboards reflect DB deletions immediately */
export async function invalidateAllLeadCaches(csrIds?: string[]): Promise<void> {
  const ids = csrIds?.length
    ? csrIds
    : (await prisma.user.findMany({ where: { role: "csr" }, select: { id: true } })).map((c) => c.id);

  for (const csrId of ids) invalidateCsrLeadCaches(csrId);
  flushAdminClientsCache();
  invalidatePattern("admin:projects:");
  invalidatePattern("admin:bin:");
  for (const csrId of ids) {
    invalidateCache(`csr:projects:${csrId}`, `csr:leads:${csrId}`, `csr:clients:${csrId}`);
  }
}
