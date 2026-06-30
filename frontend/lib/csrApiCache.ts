import API, { getTokenUserId } from "./api";

type CacheEntry<T> = { userId: string; data: T; at: number };

function createFetcher<T>(url: string, ttlMs: number) {
  let cached: CacheEntry<T> | null = null;
  let inflight: Promise<T> | null = null;

  return {
    get(force = false): Promise<T> {
      const userId = getTokenUserId() ?? "";
      if (!force && userId && cached?.userId === userId && Date.now() - cached.at < ttlMs) {
        return Promise.resolve(cached.data);
      }
      if (inflight) return inflight;

      inflight = API.get(url)
        .then(res => {
          const data = res.data as T;
          if (userId) cached = { userId, data, at: Date.now() };
          return data;
        })
        .finally(() => { inflight = null; });

      return inflight;
    },
    invalidate() {
      cached = null;
      inflight = null;
    },
  };
}

export const csrLeadsApi          = createFetcher<{ leads: unknown[] }>("/csr/leads", 28_000);
export const csrNotInterestedApi  = createFetcher<{ leads: unknown[] }>("/csr/not-interested", 28_000);
export const csrProjectsApi       = createFetcher<{ leads: unknown[] }>("/csr/projects", 28_000);
export const csrBinApi            = createFetcher<{ leads: unknown[] }>("/csr/bin", 28_000);

export function invalidateAllCsrListCaches() {
  csrLeadsApi.invalidate();
  csrNotInterestedApi.invalidate();
  csrProjectsApi.invalidate();
  csrBinApi.invalidate();
}
