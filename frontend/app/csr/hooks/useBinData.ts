import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";
import { useOnCsrDataReset } from "./useOnCsrDataReset";
import type { SubContact } from "./useLeadsData";

export type BinLead = {
  id: string;
  client: string;
  company: string;
  phone: string;
  state: string;
  status: string;
  source: string;
  notPickedCount: number;
  notInterestedCount: number;
  interestedService: string;
  binReason: string | null;
  binPreviousStatus: string | null;
  updatedAt: string;
  subContacts: SubContact[];
};

type RawLead = {
  id: string;
  name?: string;
  company?: string;
  uploadFile?: { companyName?: string; source?: { sudoName?: string } };
  phone?: string;
  state?: string;
  status?: string;
  notPickedCount?: number;
  notInterestedCount?: number;
  interestedService?: string;
  binReason?: string | null;
  binPreviousStatus?: string | null;
  updatedAt?: string;
  subContacts?: { id: string; name: string; designation?: string; phone?: string; email?: string; createdAt?: string; }[];
};

function mapBinLead(l: RawLead): BinLead {
  return {
    id:                 l.id,
    client:             l.name                    ?? "Unknown",
    company:            l.uploadFile?.companyName ?? l.company ?? "N/A",
    phone:              l.phone                   ?? "N/A",
    state:              l.state                   ?? "",
    status:             l.status                  ?? "",
    source:             l.uploadFile?.source?.sudoName ?? "—",
    notPickedCount:     l.notPickedCount           ?? 0,
    notInterestedCount: l.notInterestedCount       ?? 0,
    interestedService:  l.interestedService        ?? "",
    binReason:          l.binReason               ?? null,
    binPreviousStatus:  l.binPreviousStatus       ?? null,
    updatedAt:          l.updatedAt               ?? "",
    subContacts: (l.subContacts ?? []).map(s => ({
      id:          s.id,
      name:        s.name,
      designation: s.designation,
      phone:       s.phone,
      email:       s.email,
      createdAt:   s.createdAt,
    })),
  };
}

export type BinCounts = {
  all: number;
  notpicked: number;
  notinterested: number;
  deleted: number;
  inhouse: number;
  noowner: number;
  notinservice: number;
};

export type BinListFilters = {
  q?: string;
  state?: string;
  phone?: string;
  source?: string;
  status?: string;
};

export function useBinData(tab = "all", page = 1, pageSize = 30, filters: BinListFilters = {}) {
  const [leads, setLeads] = useState<BinLead[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState<BinCounts>({
    all: 0, notpicked: 0, notinterested: 0, deleted: 0, inhouse: 0, noowner: 0, notinservice: 0,
  });
  const [sources, setSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        tab, page: String(page), pageSize: String(pageSize),
      });
      if (filters.q) params.set("q", filters.q);
      if (filters.state) params.set("state", filters.state);
      if (filters.phone) params.set("phone", filters.phone);
      if (filters.source && filters.source !== "all") params.set("source", filters.source);
      if (filters.status && filters.status !== "all") params.set("status", filters.status);
      const res = await API.get(`/csr/bin?${params.toString()}`, { timeout: 30_000 });
      setLeads((res.data?.leads as RawLead[] ?? []).map((l) => mapBinLead(l)));
      setTotal(res.data?.total ?? 0);
      setTotalPages(res.data?.totalPages ?? 1);
      if (res.data?.counts) setCounts(res.data.counts as BinCounts);
      if (Array.isArray(res.data?.sources)) setSources(res.data.sources as string[]);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, filters.q, filters.state, filters.phone, filters.source, filters.status]);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);
  useOnCsrDataReset(() => { void refetch(); });

  return { leads, setLeads, total, totalPages, counts, sources, loading, refetch };
}

export function binCategory(reason: string | null | undefined, status?: string | null, binPreviousStatus?: string | null): "notpicked" | "notinterested" | "deleted" | "inhouse" | "noowner" | "notinservice" | "notuseful" {
  if ((status || "").trim().toLowerCase() === "not useful") return "notuseful";
  const prev = (binPreviousStatus || status || "").toLowerCase();
  if (prev === "in house") return "inhouse";
  if (prev === "no owner available") return "noowner";
  if (prev === "not in service") return "notinservice";
  if (reason === "limit-not-picked" || reason === "deleted-pending" || reason === "deleted-other") return "notpicked";
  if (reason === "limit-not-interested") return "notinterested";
  if (reason?.startsWith("deleted-")) return "deleted";
  if (reason) return "deleted";
  return "notpicked";
}

export function binReasonLabel(reason: string | null | undefined): string {
  switch (reason) {
    case "limit-not-picked":      return "Not Picked — limit reached";
    case "limit-not-interested":  return "Not Interested — limit reached";
    case "deleted-important":     return "Deleted (Important)";
    case "deleted-interested":    return "Deleted (Interested)";
    case "deleted-pending":       return "Deleted (Pending)";
    default:                      return reason ? `Deleted (${reason})` : "Bin";
  }
}
