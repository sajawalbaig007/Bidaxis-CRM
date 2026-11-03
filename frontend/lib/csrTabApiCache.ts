import API, { getTokenUserId } from "./api";

type Entry<T> = { userId: string; data: T; at: number; gen: number };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
let cacheGeneration = 0;

const STATS_TTL_MS = 60_000;
const TAB_TTL_MS   = 45_000;
const POTENTIAL_TTL_MS = 45_000;
export const CSR_TAB_PAGE_SIZE = 30;
export const CSR_FILTER_BATCH_SIZE = 500;

function read<T>(key: string, ttlMs: number): T | null {
  const userId = getTokenUserId() ?? "";
  const hit = store.get(key);
  if (!hit || hit.userId !== userId || hit.gen !== cacheGeneration || Date.now() - hit.at >= ttlMs) {
    return null;
  }
  return hit.data as T;
}

function write<T>(key: string, data: T, genAtStart: number) {
  const userId = getTokenUserId() ?? "";
  if (!userId || genAtStart !== cacheGeneration) return;
  store.set(key, { userId, data, at: Date.now(), gen: cacheGeneration });
}

async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>, force = false): Promise<T> {
  if (!force) {
    const hit = read<T>(key, ttlMs);
    if (hit !== null) return hit;
  }

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const genAtStart = cacheGeneration;
  const p = fetcher()
    .then(data => {
      write(key, data, genAtStart);
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
  sources?: string[];
};

export type CsrTableFilterParams = {
  q?: string;
  state?: string;
  tz?: string;
  phone?: string;
  source?: string;
  trade?: string;
  schedule?: string;
};

function appendTableFilters(params: URLSearchParams, filters?: CsrTableFilterParams) {
  if (!filters) return;
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.state?.trim()) params.set("state", filters.state.trim());
  if (filters.tz?.trim()) params.set("tz", filters.tz.trim());
  if (filters.phone?.trim()) params.set("phone", filters.phone.trim());
  if (filters.source?.trim()) params.set("source", filters.source.trim());
  if (filters.trade?.trim()) params.set("trade", filters.trade.trim());
  if (filters.schedule?.trim()) params.set("schedule", filters.schedule.trim());
}

function filterCacheKey(filters?: CsrTableFilterParams): string {
  if (!filters) return "";
  return [filters.q, filters.state, filters.tz, filters.phone, filters.source, filters.trade, filters.schedule]
    .map(v => v?.trim() ?? "")
    .join("|");
}

export async function fetchCsrStatsCached(
  force = false,
  from?: string,
  to?: string,
  filters?: CsrTableFilterParams,
): Promise<CsrStatsPayload> {
  const key = `csr:stats:${from ?? ""}:${to ?? ""}:${filterCacheKey(filters)}`;
  return cached(key, STATS_TTL_MS, async () => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    appendTableFilters(params, filters);
    const qs = params.toString();
    const res = await API.get(`/csr/stats${qs ? `?${qs}` : ""}`, { timeout: 45_000 });
    return res.data as CsrStatsPayload;
  }, force);
}

export async function fetchCsrTabLeadsCached(
  tab: string,
  page: number,
  from?: string,
  to?: string,
  force = false,
  pageSize = CSR_TAB_PAGE_SIZE,
  filters?: CsrTableFilterParams,
): Promise<CsrTabLeadsPayload> {
  const key = `csr:tab:${tab}:${page}:${pageSize}:${from ?? ""}:${to ?? ""}:${filterCacheKey(filters)}`;
  return cached(key, TAB_TTL_MS, async () => {
    const params = new URLSearchParams({ tab, page: String(page), pageSize: String(pageSize) });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    appendTableFilters(params, filters);
    const res = await API.get(`/csr/tab-leads?${params}`, { timeout: 60_000 });
    return res.data as CsrTabLeadsPayload;
  }, force);
}

/** One request, max 500 rows — for filter batch mode (replaces multi-page parallel fetch) */
export async function fetchCsrTabLeadsBatchCached(
  tab: string,
  from?: string,
  to?: string,
  force = false,
  batchSize = CSR_FILTER_BATCH_SIZE,
): Promise<CsrTabLeadsPayload> {
  return fetchCsrTabLeadsCached(tab, 1, from, to, force, batchSize);
}

/** @deprecated Use fetchCsrTabLeadsBatchCached — kept for compatibility */
export async function fetchAllCsrTabLeadsCached(
  tab: string,
  from?: string,
  to?: string,
  force = false,
): Promise<CsrTabLeadsPayload> {
  return fetchCsrTabLeadsBatchCached(tab, from, to, force);
}

export async function fetchPotentialLeadsCached(force = false): Promise<{ success: boolean; leads: unknown[] }> {
  return cached("csr:potential", POTENTIAL_TTL_MS, async () => {
    const res = await API.get("/csr/potential-leads", { timeout: 45_000 });
    return res.data as { success: boolean; leads: unknown[] };
  }, force);
}

/** Light invalidation after lead mutations — stats + tab lists only */
export function invalidateCsrTabCaches() {
  cacheGeneration += 1;
  for (const key of store.keys()) {
    if (key.startsWith("csr:")) store.delete(key);
  }
  for (const key of inflight.keys()) {
    if (key.startsWith("csr:")) inflight.delete(key);
  }
}
