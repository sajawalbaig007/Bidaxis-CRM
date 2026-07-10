import { flushAdminClientsCache, invalidateCache, invalidatePattern } from "./cache";

/** Clear all server-side caches for one CSR after lead mutations or admin reset. */
export function invalidateCsrLeadCaches(csrId: string, ...extra: string[]): void {
  flushAdminClientsCache();
  invalidateCache(
    `csr:dashboard:${csrId}`,
    `csr:stats:${csrId}`,
    `csr:potential:${csrId}`,
    `csr:leads:${csrId}`,
    `csr:clients:${csrId}`,
    `csr:projects:${csrId}`,
    `csr:not-interested:${csrId}`,
    `csr:bin:${csrId}`,
    "admin:bin",
    "admin:csrs",
    ...extra,
  );
  invalidatePattern(`csr:tab:${csrId}:`);
}
