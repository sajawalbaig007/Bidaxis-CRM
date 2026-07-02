import { useCallback, useEffect, useState } from "react";
import { csrClientsApi, type ClientPipelineStats } from "@/lib/csrApiCache";
import toast from "react-hot-toast";
import { apiErrorMessage } from "@/lib/api";

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
type RawLead = {
  id: string;
  name?: string; company?: string; phone?: string; email?: string; state?: string;
  uploadFile?: { companyName?: string };
  status?: string; interestedService?: string; comments?: string;
  projectBudget?: string | null; paidAmount?: string | null;
  isOldClient?: boolean; createdAt?: string; clientCode?: string | null;
  important?: boolean; interested?: boolean;
  contacts?: RawContact[];
  subContacts?: RawContact[];
  notes?: RawNote[];
};

function mapClientLead(l: RawLead): ClientLead {
  const fullNotes = (l.notes ?? []).filter(n => n.text?.trim());
  const legacyNote: NoteEntry[] = [];
  if (fullNotes.length === 0 && l.comments?.trim()) {
    legacyNote.push({ id: "legacy-comments", text: l.comments.trim(), createdAt: l.createdAt ?? new Date().toISOString() });
  }

  const noteHistory: NoteEntry[] = fullNotes.length > 0
    ? fullNotes.map((n: RawNote) => ({
        id:        n.id        ?? String(Math.random()),
        text:      n.text!.trim(),
        createdAt: n.createdAt ?? new Date().toISOString(),
      }))
    : legacyNote;

  return {
    id:                l.id,
    name:              l.name              ?? "Unknown",
    company:           l.uploadFile?.companyName ?? l.company ?? "N/A",
    rawCompany:        l.company           ?? "",
    phone:             l.phone             ?? "N/A",
    email:             l.email             ?? "",
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
      setLeads((res.leads as RawLead[] ?? []).map((l) => mapClientLead(l)));
      if (res.stats) setStats(res.stats);
    } catch (err) {
      console.log(err);
      toast.error(apiErrorMessage(err, "Could not load clients. Please refresh."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);

  return { leads, setLeads, stats, loading, refetch };
}
