import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";

export interface SubContact {
  id: string;
  name: string;
  designation: string;
  phone: string;
  email: string;
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
  phone: string;
  email: string;
  state: string;
  status: string;
  interestedService: string;
  comments: string;
  isOldClient: boolean;
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
  isOldClient?: boolean; createdAt?: string; clientCode?: string | null;
  contacts?: RawContact[];
  notes?: RawNote[];
};

function mapClientLead(l: RawLead): ClientLead {
  const legacyNote: NoteEntry[] = l.comments
    ? [{ id: "legacy", text: l.comments, createdAt: l.createdAt ?? new Date().toISOString() }]
    : [];

  const noteHistory: NoteEntry[] = (l.notes ?? []).length > 0
    ? (l.notes ?? []).map((n: RawNote) => ({
        id:        n.id        ?? String(Math.random()),
        text:      n.text      ?? "",
        createdAt: n.createdAt ?? new Date().toISOString(),
      }))
    : legacyNote;

  return {
    id:                l.id,
    name:              l.name              ?? "Unknown",
    company:           l.uploadFile?.companyName ?? l.company ?? "N/A",
    phone:             l.phone             ?? "N/A",
    email:             l.email             ?? "",
    state:             l.state             ?? "",
    status:            l.status            ?? "pending",
    interestedService: l.interestedService ?? "",
    comments:          l.comments          ?? "",
    isOldClient:       l.isOldClient       ?? false,
    createdAt:         l.createdAt         ?? "",
    clientCode:        l.clientCode        ?? null,
    contacts: (l.contacts ?? []).map((c: RawContact) => ({
      id:          c.id          ?? String(Math.random()),
      name:        c.name        ?? "",
      designation: c.designation ?? "",
      phone:       c.phone       ?? "",
      email:       c.email       ?? "",
    })),
    noteHistory,
  };
}

export function useLeadsData() {
  const [leads, setLeads] = useState<ClientLead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/leads");
      setLeads((res.data.leads ?? []).map((l: RawLead) => mapClientLead(l)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { leads, setLeads, loading, refetch };
}
