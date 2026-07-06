"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, Plus, StickyNote } from "lucide-react";
import type { NoteEntry } from "../../hooks/useLeadsData";
import API from "@/lib/api";

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return ""; }
}

interface NoteHistoryPanelProps {
  leadId: string;
  noteHistory?: NoteEntry[];
  noteCount?: number;
  onAddNote?: (id: string, text: string) => Promise<unknown>;
}

export default function NoteHistoryPanel({ leadId, noteHistory = [], noteCount, onAddNote }: NoteHistoryPanelProps) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const pre = noteHistory.filter(n => n.text?.trim());
    if (pre.length > 0) {
      setNotes([...pre].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
      return;
    }
    if ((noteCount ?? 0) === 0) { setNotes([]); return; }
    setLoading(true);
    void API.get(`/csr/lead/${leadId}`)
      .then(res => {
        const fetched: NoteEntry[] = (res.data.lead?.notes ?? [])
          .filter((n: { text?: string }) => n.text?.trim())
          .map((n: { id: string; text: string; createdAt: string }) => ({
            id: n.id, text: n.text, createdAt: n.createdAt,
          }));
        setNotes(fetched.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
      })
      .catch(() => setNotes([]))
      .finally(() => setLoading(false));
  }, [leadId, noteHistory, noteCount]);

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text || !onAddNote) return;
    setSaving(true);
    try {
      const result = await onAddNote(leadId, text);
      let newNote: NoteEntry = { id: Date.now().toString(), text, createdAt: new Date().toISOString() };
      if (result && typeof result === "object" && "id" in (result as object)) {
        newNote = result as NoteEntry;
      }
      setNotes(prev => [newNote, ...prev]);
      setDraft("");
    } finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl sm:rounded-2xl border border-gray-100 bg-[#FAFAFA] overflow-hidden">
      <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-gray-100 bg-amber-50/80">
        <StickyNote size={13} className="text-amber-600" />
        <span className="text-[11px] sm:text-xs font-bold text-amber-800">Note History</span>
        {notes.length > 0 && (
          <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">{notes.length}</span>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-gray-100">
        {loading && (
          <div className="py-6 text-center">
            <Loader2 size={18} className="animate-spin text-amber-500 mx-auto" />
          </div>
        )}
        {!loading && notes.length === 0 && (
          <p className="py-4 text-center text-[11px] text-gray-400">No notes yet</p>
        )}
        {!loading && notes.map(note => (
          <div key={note.id} className="px-3 sm:px-4 py-2.5">
            <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap">{note.text}</p>
            {note.createdAt && (
              <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                <Clock size={9} />{fmtTime(note.createdAt)}
              </p>
            )}
          </div>
        ))}
      </div>
      {onAddNote && (
        <div className="p-3 border-t border-gray-100 bg-white">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="Add a note…"
            className="w-full text-[12px] rounded-xl border border-gray-200 px-3 py-2 outline-none resize-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={saving || !draft.trim()}
            className="mt-2 w-full h-8 rounded-xl bg-amber-500 text-white text-[12px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            Add Note
          </button>
        </div>
      )}
    </div>
  );
}
