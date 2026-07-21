import { useCallback, useEffect, useState } from "react";
import { csrClientsApi, type ClientPipelineStats } from "@/lib/csrApiCache";
import { useOnCsrDataReset } from "./useOnCsrDataReset";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/lib/api";
import { buildNoteHistory } from "../utils/noteHistory";

export interface SubContact {
  id: string;
  name: string;
  designation?: string;
  phone?: string;
  email?: string;
  createdAt?: string;
}

export interface NoteEntry {
  id: string;
  text: string;
  createdAt: string;
}

export type ClientLead = {
  id: string;
  name: string;
  company: string;
  rawCompany: string;
  phone: string;
  email: string;
  website: string;
  state: string;
  status: string;
  interestedService: string;
  comments: string;
  projectBudget: string;
  paidAmount: string;
  isOldClient: boolean;
  important: boolean;
  interested: boolean;
  createdAt: string;
  clientCode: string | null;
  contacts: SubContact[];
  noteHistory: NoteEntry[];
};

type RawContact = { id?: string; name?: string; designation?: string; phone?: string; email?: string; };
type RawNote   = { id?: string; text?: string; createdAt?: string; };
export type RawClientLead = {
  id: string;
  name?: string; company?: string; phone?: string; email?: string; website?: string; state?: string;
  uploadFile?: { companyName?: string };
  status?: string; interestedService?: string; comments?: string;
  followUpNotes?: string | null;
  projectBudget?: string | null; paidAmount?: string | null;
  isOldClient?: boolean; createdAt?: string; updatedAt?: string; clientCode?: string | null;
  important?: boolean; interested?: boolean;
  contacts?: RawContact[];
  subContacts?: RawContact[];
  notes?: RawNote[];
};

function buildClientNoteHistory(l: RawClientLead): NoteEntry[] {
  return buildNoteHistory(l).noteHistory;
}

/** Group key for same client across multiple won projects (phone, then company). */
export function clientIdentityKey(l: Pick<ClientLead, "id" | "phone" | "rawCompany">): string {
  const digits = (l.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 7) return `phone:${digits}`;
  const co = l.rawCompany?.trim().toLowerCase();
  if (co) return `company:${co}`;
  return `id:${l.id}`;
}

/** One row per client — upload isOldClient flag decides New vs Old tab. */
export function splitWonClientsByIdentity(wonLeads: ClientLead[]): {
  newLeads: ClientLead[];
  oldLeads: ClientLead[];
  repeatKeys: Set<string>;
} {
  const groups = new Map<string, ClientLead[]>();
  for (const l of wonLeads) {
    const k = clientIdentityKey(l);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(l);
  }

  const newLeads: ClientLead[] = [];
  const oldLeads: ClientLead[] = [];
  const repeatKeys = new Set<string>();
  const byDate = (a: ClientLead, b: ClientLead) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

  for (const [key, group] of groups) {
    group.sort(byDate);
    const latest = group[0]!;
    if (group.length >= 2) repeatKeys.add(key);
    if (latest.isOldClient) oldLeads.push(latest);
    else newLeads.push(latest);
  }

  newLeads.sort(byDate);
  oldLeads.sort(byDate);
  return { newLeads, oldLeads, repeatKeys };
}

export function mapClientLead(l: RawClientLead): ClientLead {
  const noteHistory = buildClientNoteHistory(l);

  return {
    id:                l.id,
    name:              l.name              ?? "Unknown",
    company:           l.uploadFile?.companyName ?? l.company ?? "N/A",
    rawCompany:        l.company           ?? "",
    phone:             l.phone             ?? "N/A",
    email:             l.email             ?? "",
    website:           l.website?.trim()   ?? "",
    state:             l.state             ?? "",
    status:            l.status            ?? "pending",
    interestedService: l.interestedService ?? "",
    comments:          l.comments          ?? "",
    projectBudget:     l.projectBudget     ?? "",
    paidAmount:        l.paidAmount        ?? "",
    isOldClient:       l.isOldClient       ?? false,
    important:         l.important         ?? false,
    interested:        l.interested        ?? false,
    createdAt:         l.createdAt         ?? "",
    clientCode:        l.clientCode        ?? null,
    contacts: (l.subContacts ?? l.contacts ?? []).map((c: RawContact) => ({
      id:          c.id          ?? String(Math.random()),
      name:        c.name        ?? "",
      designation: c.designation ?? "",
      phone:       c.phone       ?? "",
      email:       c.email       ?? "",
    })),
    noteHistory,
  };
}

export type { ClientPipelineStats };

export function useLeadsData() {
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [stats, setStats] = useState<ClientPipelineStats>({
    importantCount: 0,
    interestedCount: 0,
    pendingCount: 0,
    totalAssigned: 0,
  });
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const res = await csrClientsApi.get(force);
      setLeads((res.leads as RawClientLead[] ?? []).map((l) => mapClientLead(l)));
      if (res.stats) setStats(res.stats);
    } catch (err) {
      console.log(err);
      toast.error(apiErrorMessage(err, "Could not load clients. Please refresh."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);
  useOnCsrDataReset(() => { void refetch(true); });

  return { leads, setLeads, stats, loading, refetch };
}
