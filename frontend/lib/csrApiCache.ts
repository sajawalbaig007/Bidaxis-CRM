import API from "./api";

type CacheEntry<T> = { data: T; at: number };

function createFetcher<T>(url: string, ttlMs: number) {
  let cached: CacheEntry<T> | null = null;
  let inflight: Promise<T> | null = null;

  return {
    get(force = false): Promise<T> {
      if (!force && cached && Date.now() - cached.at < ttlMs) {
        return Promise.resolve(cached.data);
      }
      if (inflight) return inflight;

      inflight = API.get(url)
        .then(res => {
          const data = res.data as T;
          cached = { data, at: Date.now() };
          return data;
        })
        .finally(() => { inflight = null; });

      return inflight;
    },
    invalidate() {
      cached = null;
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
