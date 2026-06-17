import API from "./api";

export type CsrDashboardLead = {
  id: string;
  name?: string;
  status?: string;
  nextSchedule?: string;
  nextTime?: string;
  timezone?: string;
};

export type CsrDashboardData = {
  success: boolean;
  totalLeads: number;
  leads: CsrDashboardLead[];
};

let cached: { data: CsrDashboardData; at: number } | null = null;
let inflight: Promise<CsrDashboardData> | null = null;
const TTL_MS = 28_000;

export function invalidateCsrDashboardCache() {
  cached = null;
}

export async function getCsrDashboard(force = false): Promise<CsrDashboardData> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return cached.data;
  }
  if (inflight) return inflight;

  inflight = API.get("/csr/dashboard")
    .then(res => {
      const data = res.data as CsrDashboardData;
      cached = { data, at: Date.now() };
      return data;
    })
    .finally(() => { inflight = null; });

  return inflight;
}
