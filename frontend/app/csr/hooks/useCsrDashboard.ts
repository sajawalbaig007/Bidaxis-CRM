import { useCallback, useEffect, useState } from "react";
import { getCsrDashboard, invalidateCsrDashboardCache } from "@/lib/csrDashboardCache";
import { BackendLead, Lead, mapBackendLead } from "../types/lead";

export function useCsrDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (force = false) => {
    try {
      setLoading(true);
      if (force) invalidateCsrDashboardCache();
      const data = await getCsrDashboard(force);
      setLeads((data.leads ?? []).map((lead: BackendLead) => mapBackendLead(lead)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);

  return { leads, setLeads, loading, refetch };
}
