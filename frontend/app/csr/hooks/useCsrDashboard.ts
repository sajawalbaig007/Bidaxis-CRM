import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";
import { BackendLead, Lead, mapBackendLead } from "../types/lead";

export function useCsrDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/dashboard");
      setLeads((res.data.leads ?? []).map((lead: BackendLead) => mapBackendLead(lead)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);

  return { leads, setLeads, loading, refetch };
}
