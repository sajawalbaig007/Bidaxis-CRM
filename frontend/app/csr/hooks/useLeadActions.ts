import { Dispatch, SetStateAction } from "react";

import API from "@/lib/api";

import { invalidateAllCsrListCaches } from "@/lib/csrApiCache";

import { invalidateCsrTabCaches } from "@/lib/csrTabApiCache";

import { Lead } from "../types/lead";

import { NoteEntry } from "./useLeadsData";



export function useLeadActions(setLeads: Dispatch<SetStateAction<Lead[]>>) {

  const invalidateCaches = () => {

    invalidateCsrTabCaches();

    invalidateAllCsrListCaches();

  };



  const saveComment = async (id: string, comment: string) => {

    setLeads(prev => prev.map(l => (l.id === id ? { ...l, comments: comment } : l)));

    await API.put(`/csr/lead/${id}`, { comments: comment });

  };



  const addNote = async (id: string, text: string): Promise<NoteEntry | null> => {

    const optimistic: NoteEntry = {

      id: `tmp-${Date.now()}`,

      text,

      createdAt: new Date().toISOString(),

    };

    setLeads(prev => prev.map(l =>

      l.id === id

        ? {

            ...l,

            noteCount: (l.noteCount ?? 0) + 1,

            noteHistory: [optimistic, ...(l.noteHistory ?? [])],

            latestNote: optimistic,

          }

        : l

    ));



    try {

      const res = await API.post(`/csr/lead/${id}/notes`, { text });

      const note: NoteEntry = res.data.note

        ? { id: res.data.note.id, text: res.data.note.text, createdAt: res.data.note.createdAt }

        : { id: Date.now().toString(), text, createdAt: new Date().toISOString() };

      setLeads(prev => prev.map(l =>

        l.id === id

          ? {

              ...l,

              noteHistory: [note, ...(l.noteHistory ?? []).filter(n => n.id !== optimistic.id)],

              latestNote: note,

            }

          : l

      ));

      return note;

    } catch (err) {

      setLeads(prev => prev.map(l =>

        l.id === id

          ? {

              ...l,

              noteCount: Math.max(0, (l.noteCount ?? 1) - 1),

              noteHistory: (l.noteHistory ?? []).filter(n => n.id !== optimistic.id),

            }

          : l

      ));

      throw err;

    }

  };



  const updateLead = async (id: string, payload: Record<string, unknown>) => {

    const now = new Date().toISOString();

    setLeads(prev => prev.map(l => {

      if (l.id !== id) return l;

      const next = { ...l, ...payload } as Lead;

      if ("status" in payload) next.statusUpdatedAt = now;

      return next;

    }));



    const res = await API.put(`/csr/lead/${id}`, payload);

    invalidateCaches();



    if (res.data?.redistributed) {

      setLeads(prev => prev.filter(l => l.id !== id));

    }

    return res.data;

  };



  return { saveComment, addNote, updateLead };

}

