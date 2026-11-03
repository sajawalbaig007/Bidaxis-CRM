import prisma from "../config/db";
import { flushAdminClientsCache, invalidateCache, invalidatePattern } from "./cache";
import { flushReportCache } from "../controllers/report.controller";
import { clearCsrFilterRowCache } from "./csrDashboardQueries";

/** Clear all server-side caches for one CSR after lead mutations or admin reset. */
export function invalidateCsrLeadCaches(csrId: string, ...extra: string[]): void {
  flushAdminClientsCache();
  flushReportCache();
  clearCsrFilterRowCache(csrId);
  invalidateCache(
    `csr:dashboard:${csrId}`,
    `csr:potential:${csrId}`,
    `csr:leads:${csrId}`,
    `csr:clients:${csrId}`,
    `csr:projects:${csrId}`,
    `csr:not-interested:${csrId}`,
    `csr:bin:${csrId}`,
    `csr:sources:${csrId}`,
    "admin:bin",
    "admin:csrs",
    ...extra,
  );
  invalidatePattern(`csr:tab:${csrId}:`);
  invalidatePattern(`csr:stats:${csrId}`);
  invalidatePattern(`csr:projects:${csrId}:`);
  invalidatePattern(`csr:bin:${csrId}:`);
}

/** File source or its CSR sudo name changed — drop every list that still has the old name. */
export async function invalidateCsrCachesForSource(sourceId: string): Promise<void> {
  invalidateCache("admin:upload-sources");
  const owners = await prisma.lead.findMany({
    where: { uploadFile: { is: { sourceId } } },
    distinct: ["assignedTo"],
    select: { assignedTo: true },
  });
  for (const row of owners) {
    if (row.assignedTo) invalidateCsrLeadCaches(row.assignedTo);
  }
}
