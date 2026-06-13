import { Dispatch, SetStateAction } from "react";
import API from "@/lib/api";
import { Lead } from "../types/lead";

export function useLeadActions(setLeads: Dispatch<SetStateAction<Lead[]>>) {
  const saveComment = async (id: string, comment: string) => {
    await API.put(`/csr/lead/${id}`, { comments: comment });
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, comments: comment } : l)));
  };

  const updateLead = async (id: string, payload: Record<string, unknown>) => {
    const res = await API.put(`/csr/lead/${id}`, payload);
    if (res.data?.redistributed) {
      setLeads(prev => prev.filter(l => l.id !== id));
    } else {
      setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...payload } as Lead : l)));
    }
    return res.data;
  };

  return { saveComment, updateLead };
}
