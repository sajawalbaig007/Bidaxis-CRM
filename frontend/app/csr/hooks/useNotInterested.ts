import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";

export type NiLead = {
  id: string;
  client: string;
  company: string;
  phone: string;
  email: string;
  state: string;
  status: string;
  notInterestedCount: number;
  notPickedCount: number;
  interestedService: string;
  followUpNotes: string;
  comments: string;
};

type RawLead = {
  id: string;
  name?: string;
  company?: string;
  uploadFile?: { companyName?: string };
  phone?: string;
  email?: string;
  state?: string;
  status?: string;
  notInterestedCount?: number;
  notPickedCount?: number;
  interestedService?: string;
  followUpNotes?: string;
  comments?: string;
};

function mapNiLead(l: RawLead): NiLead {
  return {
    id:                 l.id,
    client:             l.name                    ?? "Unknown",
    company:            l.uploadFile?.companyName ?? l.company ?? "N/A",
    phone:              l.phone                   ?? "N/A",
    email:              l.email                   ?? "",
    state:              l.state                   ?? "",
    status:             l.status                  ?? "",
    notInterestedCount: l.notInterestedCount       ?? 0,
    notPickedCount:     l.notPickedCount           ?? 0,
    interestedService:  l.interestedService        ?? "",
    followUpNotes:      l.followUpNotes            ?? "",
    comments:           l.comments                 ?? "",
  };
}

export function useNotInterested() {
  const [leads, setLeads] = useState<NiLead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/not-interested");
      setLeads((res.data.leads ?? []).map((l: RawLead) => mapNiLead(l)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { leads, setLeads, loading, refetch };
}
