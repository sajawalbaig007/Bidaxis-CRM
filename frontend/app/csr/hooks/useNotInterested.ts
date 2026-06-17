import { useCallback, useEffect, useState } from "react";
import { csrNotInterestedApi } from "@/lib/csrApiCache";
import { NoteEntry, SubContact } from "./useLeadsData";

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
  noteHistory: NoteEntry[];
  subContacts: SubContact[];
};

type RawNote = { id?: string; text?: string; createdAt?: string; };
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
  notes?: RawNote[];
  subContacts?: { id: string; name: string; designation?: string; phone?: string; email?: string; createdAt?: string; }[];
  createdAt?: string;
};

function mapNiLead(l: RawLead): NiLead {
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
    noteHistory,
    subContacts:        (l.subContacts ?? []).map(s => ({ id: s.id, name: s.name, designation: s.designation, phone: s.phone, email: s.email, createdAt: s.createdAt })),
  };
}

export function useNotInterested() {
  const [leads, setLeads] = useState<NiLead[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const res = await csrNotInterestedApi.get(force);
      setLeads((res.leads as RawLead[] ?? []).map((l) => mapNiLead(l)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);

  return { leads, setLeads, loading, refetch };
}
