import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchAllCsrTabLeadsCached } from "@/lib/csrTabApiCache";
import { BackendLead, Lead, mapBackendLead } from "../types/lead";
import { apiErrorMessage } from "@/lib/api";

/** Leads for no-owner / not-in-service / in-house tabs — cached tab API instead of heavy dashboard. */
export function useCsrMiscStatusLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const [noOwner, notInService, inHouse] = await Promise.all([
        fetchAllCsrTabLeadsCached("noowner", undefined, undefined, force),
        fetchAllCsrTabLeadsCached("notinservice", undefined, undefined, force),
        fetchAllCsrTabLeadsCached("inhouse", undefined, undefined, force),
      ]);
      const merged = [
        ...(noOwner.leads as BackendLead[]),
        ...(notInService.leads as BackendLead[]),
        ...(inHouse.leads as BackendLead[]),
      ].map(mapBackendLead);
      setLeads(merged);
    } catch (err) {
      console.log(err);
      toast.error(apiErrorMessage(err, "Could not load follow-up leads. Please refresh."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);

  return { leads, loading, refetch };
}
