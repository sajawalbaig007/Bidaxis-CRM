import { Dispatch, SetStateAction } from "react";
import API from "@/lib/api";
import { invalidateAllCsrListCaches } from "@/lib/csrApiCache";
import { invalidateCsrDashboardCache } from "@/lib/csrDashboardCache";
import { Lead } from "../types/lead";
import { NoteEntry } from "./useLeadsData";

export function useLeadActions(setLeads: Dispatch<SetStateAction<Lead[]>>) {
  const invalidateCaches = () => {
    invalidateCsrDashboardCache();
    invalidateAllCsrListCaches();
  };

  const saveComment = async (id: string, comment: string) => {
    await API.put(`/csr/lead/${id}`, { comments: comment });
    invalidateCaches();
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, comments: comment } : l)));
  };

  const addNote = async (id: string, text: string): Promise<NoteEntry | null> => {
    const res = await API.post(`/csr/lead/${id}/notes`, { text });
    invalidateCaches();
    const note: NoteEntry = res.data.note
      ? { id: res.data.note.id, text: res.data.note.text, createdAt: res.data.note.createdAt }
      : { id: Date.now().toString(), text, createdAt: new Date().toISOString() };
    setLeads(prev => prev.map(l =>
      l.id === id
        ? { ...l, noteCount: (l.noteCount ?? 0) + 1, noteHistory: [...(l.noteHistory ?? []), note] }
        : l
    ));
    return note;
  };

  const updateLead = async (id: string, payload: Record<string, unknown>) => {
    const res = await API.put(`/csr/lead/${id}`, payload);
    invalidateCaches();
    if (res.data?.redistributed) {
      setLeads(prev => prev.filter(l => l.id !== id));
    } else {
      setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...payload } as Lead : l)));
    }
    return res.data;
  };

  return { saveComment, addNote, updateLead };
}
