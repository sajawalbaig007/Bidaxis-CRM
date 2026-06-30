import API from "./api";

export type AdminDashboardSummary = {
  stats?: {
    totalLeads?: number;
    completed?: number;
    closed?: number;
    pending?: number;
    important?: number;
    interested?: number;
    projectWon?: number;
    onlineCSRs?: number;
    totalOnline?: number;
    importantOnly?: number;
    scheduled?: number;
  };
  tabCounts?: {
    all?: number;
    important?: number;
    schedule?: number;
    interested?: number;
    closed?: number;
  };
  distribution?: Record<string, number>;
  recent?: {
    id?: string;
    name?: string;
    status?: string;
    updatedAt?: string;
    csr?: { name?: string };
  }[];
  recentStatus?: {
    id?: string;
    csrName?: string;
    leadName?: string;
    status?: string;
    createdAt?: string;
  }[];
  chartLeads?: { createdAt: string }[];
  performers?: { name: string; resolved: number; total: number; rate: number }[];
};

let cached: { data: AdminDashboardSummary; at: number } | null = null;
let inflight: Promise<AdminDashboardSummary> | null = null;
const TTL_MS = 90_000;
const STORAGE_KEY = "crm_admin_summary_v1";

function readStorage(): { data: AdminDashboardSummary; at: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data: AdminDashboardSummary; at: number };
    if (!parsed?.data || !parsed?.at) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStorage(entry: { data: AdminDashboardSummary; at: number }) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch {
    /* quota */
  }
}

function clearStorage() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function hydrateFromStorage() {
  if (cached) return;
  const stored = readStorage();
  if (stored) cached = stored;
}

/** Last loaded summary (memory or session) — no API call. */
export function peekAdminSummary(): AdminDashboardSummary | null {
  hydrateFromStorage();
  return cached?.data ?? null;
}

export function invalidateAdminSummaryCache() {
  cached = null;
  clearStorage();
}

export async function getAdminSummary(force = false): Promise<AdminDashboardSummary> {
  hydrateFromStorage();
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return cached.data;
  }
  if (inflight) return inflight;

  inflight = API.get("/admin/clients/summary")
    .then(res => {
      const data = res.data as AdminDashboardSummary;
      const entry = { data, at: Date.now() };
      cached = entry;
      writeStorage(entry);
      return data;
    })
    .finally(() => { inflight = null; });

  return inflight;
}
