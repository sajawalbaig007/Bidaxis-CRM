import API, { getTokenUserId } from "./api";

type Entry<T> = { userId: string; data: T; at: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const STATS_TTL_MS = 45_000;
const TAB_TTL_MS   = 45_000;
const POTENTIAL_TTL_MS = 45_000;

function read<T>(key: string, ttlMs: number): T | null {
  const userId = getTokenUserId() ?? "";
  const hit = store.get(key);
  if (!hit || hit.userId !== userId || Date.now() - hit.at >= ttlMs) return null;
  return hit.data as T;
}

function write<T>(key: string, data: T) {
  const userId = getTokenUserId() ?? "";
  if (!userId) return;
  store.set(key, { userId, data, at: Date.now() });
}

async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>, force = false): Promise<T> {
  if (!force) {
    const hit = read<T>(key, ttlMs);
    if (hit !== null) return hit;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = fetcher()
    .then(data => {
      write(key, data);
      return data;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

export type CsrStatsPayload = {
  success: boolean;
  stats: {
    pendingCount: number;
    importantOnlyCount: number;
    scheduledCount: number;
    interestedCount: number;
    projectWonCount: number;
    notInterestedCount: number;
    notPickedCount: number;
    noOwnerCount: number;
    notInServiceCount: number;
    inHouseCount: number;
    totalAssigned: number;
    totalLeads: number;
  };
};

export type CsrTabLeadsPayload = {
  success: boolean;
  leads: unknown[];
  total: number;
  totalPages: number;
};

export async function fetchCsrStatsCached(force = false): Promise<CsrStatsPayload> {
  return cached("csr:stats", STATS_TTL_MS, async () => {
    const res = await API.get("/csr/stats", { timeout: 60_000 });
    return res.data as CsrStatsPayload;
  }, force);
}

export async function fetchCsrTabLeadsCached(
  tab: string,
  page: number,
  from?: string,
  to?: string,
  force = false,
  pageSize = 30,
): Promise<CsrTabLeadsPayload> {
  const key = `csr:tab:${tab}:${page}:${pageSize}:${from ?? ""}:${to ?? ""}`;
  return cached(key, TAB_TTL_MS, async () => {
    const params = new URLSearchParams({ tab, page: String(page), pageSize: String(pageSize) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await API.get(`/csr/tab-leads?${params}`, { timeout: 90_000 });
    return res.data as CsrTabLeadsPayload;
  }, force);
}

/** Load every page for a tab — full CSR dataset (no hidden pages) */
export async function fetchAllCsrTabLeadsCached(
  tab: string,
  from?: string,
  to?: string,
  force = false,
): Promise<CsrTabLeadsPayload> {
  const key = `csr:tab-all:${tab}:${from ?? ""}:${to ?? ""}`;
  return cached(key, TAB_TTL_MS, async () => {
    const pageSize = 2000;
    const first = await fetchCsrTabLeadsCached(tab, 1, from, to, force, pageSize);
    const total = first.total ?? first.leads.length;
    const totalPages = Math.max(1, first.totalPages ?? 1);
    if (totalPages <= 1) {
      return { success: true, leads: first.leads, total, totalPages: 1 };
    }
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        fetchCsrTabLeadsCached(tab, i + 2, from, to, force, pageSize),
      ),
    );
    const leads = [first.leads, ...rest.map(r => r.leads)].flat();
    return {
      success: true,
      leads,
      total: total || leads.length,
      totalPages: Math.max(1, Math.ceil((total || leads.length) / 30)),
    };
  }, force);
}

export async function fetchPotentialLeadsCached(force = false): Promise<{ success: boolean; leads: unknown[] }> {
  return cached("csr:potential", POTENTIAL_TTL_MS, async () => {
    const res = await API.get("/csr/potential-leads", { timeout: 60_000 });
    return res.data as { success: boolean; leads: unknown[] };
  }, force);
}

/** Light invalidation after lead mutations — stats + tab lists only */
export function invalidateCsrTabCaches() {
  for (const key of store.keys()) {
    if (key.startsWith("csr:")) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith("csr:")) inflight.delete(key);
  }
}
