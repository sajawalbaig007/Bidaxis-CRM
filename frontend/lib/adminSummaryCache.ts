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
  chartLeads?: { createdAt: string }[];
  performers?: { name: string; resolved: number; total: number; rate: number }[];
};

let cached: { data: AdminDashboardSummary; at: number } | null = null;
let inflight: Promise<AdminDashboardSummary> | null = null;
const TTL_MS = 90_000;

export function invalidateAdminSummaryCache() {
  cached = null;
}

export async function getAdminSummary(force = false): Promise<AdminDashboardSummary> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return cached.data;
  }
  if (inflight) return inflight;

  inflight = API.get("/admin/clients/summary")
    .then(res => {
      const data = res.data as AdminDashboardSummary;
      cached = { data, at: Date.now() };
      return data;
    })
    .finally(() => { inflight = null; });

  return inflight;
}
