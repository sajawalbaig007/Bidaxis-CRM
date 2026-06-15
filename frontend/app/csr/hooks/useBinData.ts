import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";

export type BinLead = {
  id: string;
  client: string;
  company: string;
  phone: string;
  state: string;
  status: string;
  notPickedCount: number;
  interestedService: string;
  updatedAt: string;
};

type RawLead = {
  id: string;
  name?: string;
  company?: string;
  uploadFile?: { companyName?: string };
  phone?: string;
  state?: string;
  status?: string;
  notPickedCount?: number;
  interestedService?: string;
  updatedAt?: string;
};

function mapBinLead(l: RawLead): BinLead {
  return {
    id:                l.id,
    client:            l.name                    ?? "Unknown",
    company:           l.uploadFile?.companyName ?? l.company ?? "N/A",
    phone:             l.phone                   ?? "N/A",
    state:             l.state                   ?? "",
    status:            l.status                  ?? "",
    notPickedCount:    l.notPickedCount           ?? 0,
    interestedService: l.interestedService        ?? "",
    updatedAt:         l.updatedAt               ?? "",
  };
}

export function useBinData() {
  const [leads, setLeads] = useState<BinLead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/bin");
      setLeads((res.data.leads ?? []).map((l: RawLead) => mapBinLead(l)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);

  return { leads, setLeads, loading, refetch };
}
