import { useCallback, useEffect, useState } from "react";
import { csrClientsApi, type ClientPipelineStats } from "@/lib/csrApiCache";
import { useOnCsrDataReset } from "./useOnCsrDataReset";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/lib/api";
import { buildNoteHistory } from "../utils/noteHistory";
import { parseProjectCodeSeq } from "@/lib/projectCodeSeq";

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
  /** Set when this row is a reply to another sticky on the same lead. */
  parentId?: string | null;
  /** Nested replies (oldest → newest) when this is a root sticky. */
  replies?: NoteEntry[];
  authorId?: string;
  authorRole?: string;
  authorName?: string;
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
  projectCode: string | null;
  projectScope: string;
  extraProjects: { code: string; scope: string }[];
  contacts: SubContact[];
  noteHistory: NoteEntry[];
};

type RawContact = { id?: string; name?: string; designation?: string; phone?: string; email?: string; };
type RawNote   = { id?: string; text?: string; createdAt?: string; parentId?: string | null };
export type RawClientLead = {
  id: string;
  name?: string; company?: string; phone?: string; email?: string; website?: string; state?: string;
  uploadFile?: { companyName?: string };
  status?: string; interestedService?: string; comments?: string;
  followUpNotes?: string | null;
  projectBudget?: string | null; paidAmount?: string | null;
  isOldClient?: boolean; createdAt?: string; updatedAt?: string;
  clientCode?: string | null; projectCode?: string | null; projectScope?: string | null;
  important?: boolean; interested?: boolean;
  contacts?: RawContact[];
  subContacts?: RawContact[];
  notes?: RawNote[];
};

function buildClientNoteHistory(l: RawClientLead): NoteEntry[] {
  return buildNoteHistory(l).noteHistory;
}

function extrasFromGroup(group: ClientLead[]): { code: string; scope: string }[] {
  const seen = new Set<string>();
  const extras: { code: string; scope: string }[] = [];
  for (const lead of group) {
    const project = (lead.projectCode || "").trim();
    const client = (lead.clientCode || "").trim();
    const raw = project || (/-\d+$/.test(client) ? client : "");
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push({
      code: raw,
      scope: (lead.projectScope || lead.interestedService || "").trim(),
    });
  }
  extras.sort((a, b) => {
    const sa = parseProjectCodeSeq(a.code)?.seq ?? 0;
    const sb = parseProjectCodeSeq(b.code)?.seq ?? 0;
    return sa - sb;
  });
  return extras;
}

/** Group key for same client across multiple won projects (phone, then company). */
export function clientIdentityKey(l: Pick<ClientLead, "id" | "phone" | "rawCompany">): string {
  const digits = (l.phone ?? "").replace(/\D/g, "");
  if (digits.length >= 7) return `phone:${digits}`;
  const co = l.rawCompany?.trim().toLowerCase();
  if (co) return `company:${co}`;
  return `id:${l.id}`;
}

/** One row per client — 2+ won projects or isOldClient → Old tab. */
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
    if (group.length >= 2) repeatKeys.add(key);
    /* Prefer oldest row so extra projects stay in Active Projects, not Clients */
    const representative = [...group].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )[0]!;
    const isOld = group.length >= 2 || group.some(l => l.isOldClient);
    const withExtras = { ...representative, extraProjects: extrasFromGroup(group) };
    if (isOld) oldLeads.push({ ...withExtras, isOldClient: true });
    else newLeads.push(withExtras);
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
    projectCode:       l.projectCode       ?? null,
    projectScope:      l.projectScope      ?? "",
    extraProjects:     [],
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
