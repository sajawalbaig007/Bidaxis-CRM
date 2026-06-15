"use client";

import { useEffect, useRef, useState } from "react";
import { StickyNote, Plus, Pencil, Trash2, Check, X, Clock, Loader2 } from "lucide-react";
import { NoteEntry } from "../../hooks/useLeadsData";
import API from "@/lib/api";

interface CommentCellProps {
  id: string;
  noteHistory?: NoteEntry[];
  comment?: string;
  onAddNote?:    (id: string, text: string) => Promise<unknown>;
  onSave?:       (id: string, text: string) => Promise<void>;
  onNoteUpdated?: (id: string, noteId: string, text: string) => void;
  onNoteDeleted?: (id: string, noteId: string) => void;
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return ""; }
}

export default function CommentCell({
  id, noteHistory, comment, onAddNote, onSave, onNoteUpdated, onNoteDeleted,
}: CommentCellProps) {
  const [open,      setOpen]      = useState(false);
  const [draft,     setDraft]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [editText,  setEditText]  = useState("");
  const [editSaving,setEditSaving]= useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const popupRef  = useRef<HTMLDivElement>(null);
  const btnRef    = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<"bottom" | "top">("bottom");

  const notes = noteHistory ?? [];
  const sorted = [...notes].reverse(); // newest first

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (
        popupRef.current  && !popupRef.current.contains(e.target as Node) &&
        btnRef.current    && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  /* Determine popup position */
  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos(rect.bottom + 340 > window.innerHeight ? "top" : "bottom");
    }
    setOpen(v => !v);
  };

  /* ── Add note ── */
  const handleAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      if (onAddNote) await onAddNote(id, text);
      else if (onSave) await onSave(id, text);
      setDraft("");
    } finally { setSaving(false); }
  };

  /* ── Update note ── */
  const handleUpdate = async (noteId: string) => {
    const text = editText.trim();
    if (!text) return;
    setEditSaving(true);
    try {
      await API.put(`/csr/lead/${id}/notes/${noteId}`, { text });
      onNoteUpdated?.(id, noteId, text);
      setEditId(null);
    } catch { /* toast from interceptor */ }
    finally { setEditSaving(false); }
  };

  /* ── Delete note ── */
  const handleDelete = async (noteId: string) => {
    setDeleting(noteId);
    try {
      await API.delete(`/csr/lead/${id}/notes/${noteId}`);
      onNoteDeleted?.(id, noteId);
    } catch { /* toast from interceptor */ }
    finally { setDeleting(null); }
  };

  const count = notes.length + (comment ? 1 : 0);

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-xl border text-[12px] font-semibold transition-all ${
          count > 0
            ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
            : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        }`}
      >
        <StickyNote size={13} />
        {count > 0 ? <span>{count} note{count !== 1 ? "s" : ""}</span> : <span>Note</span>}
      </button>

      {/* Popup */}
      {open && (
        <div
          ref={popupRef}
          className={`absolute z-[200] w-[300px] bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-gray-100 overflow-hidden ${
            pos === "bottom" ? "top-10 left-0" : "bottom-10 left-0"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-amber-50">
            <div className="flex items-center gap-2">
              <StickyNote size={14} className="text-amber-600" />
              <span className="text-[13px] font-bold text-amber-800">Notes</span>
              {count > 0 && (
                <span className="bg-amber-200 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {count}
                </span>
              )}
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Notes list */}
          <div className="max-h-[260px] overflow-y-auto divide-y divide-gray-50">
            {/* Legacy comment (admin mode) */}
            {comment && (
              <div className="px-4 py-3">
                <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap">{comment}</p>
              </div>
            )}

            {/* LeadNote history */}
            {sorted.length === 0 && !comment && (
              <div className="py-8 text-center">
                <StickyNote size={24} className="text-gray-200 mx-auto mb-2" />
                <p className="text-[12px] text-gray-400">No notes yet</p>
              </div>
            )}

            {sorted.map(note => (
              <div key={note.id} className="px-4 py-3 group">
                {editId === note.id ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                      className="w-full text-[12px] rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 outline-none resize-none text-gray-800 placeholder:text-gray-300"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => void handleUpdate(note.id)}
                        disabled={editSaving || !editText.trim()}
                        className="flex-1 h-7 rounded-lg bg-amber-500 text-white text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {editSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={() => setEditId(null)}
                        className="flex-1 h-7 rounded-lg bg-gray-100 text-gray-500 text-[11px] font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div>
                    <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap">{note.text}</p>
                    {note.createdAt && (
                      <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                        <Clock size={9} />{fmtTime(note.createdAt)}
                      </p>
                    )}
                    {/* Actions — show on hover */}
                    {(onAddNote || onNoteUpdated) && (
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditId(note.id); setEditText(note.text); }}
                          className="flex items-center gap-1 h-6 px-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 text-[10px] font-semibold transition-colors"
                        >
                          <Pencil size={9} /> Edit
                        </button>
                        <button
                          onClick={() => void handleDelete(note.id)}
                          disabled={deleting === note.id}
                          className="flex items-center gap-1 h-6 px-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 text-[10px] font-semibold transition-colors disabled:opacity-50"
                        >
                          {deleting === note.id ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add note */}
          <div className="border-t border-gray-100 p-3 bg-gray-50/50">
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void handleAdd(); }}
              rows={2}
              placeholder="Add a note… (Ctrl+Enter to save)"
              className="w-full text-[12px] rounded-xl border border-gray-200 bg-white px-3 py-2 outline-none resize-none text-gray-800 placeholder:text-gray-300 focus:border-amber-400 transition-colors"
            />
            <button
              onClick={() => void handleAdd()}
              disabled={saving || !draft.trim()}
              className="mt-2 w-full h-8 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[12px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {saving ? "Saving…" : "Add Note"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
