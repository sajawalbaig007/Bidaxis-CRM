"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { StickyNote, Plus, Pencil, Trash2, Check, X, Clock, Loader2 } from "lucide-react";
import { NoteEntry } from "../../hooks/useLeadsData";
import API from "@/lib/api";
import { buildNoteHistory } from "../../utils/noteHistory";

interface CommentCellProps {
  id: string;
  noteHistory?: NoteEntry[];
  noteCount?: number;
  comment?: string;
  apiRole?: "csr" | "admin";
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
  id, noteHistory, noteCount, comment, apiRole = "csr", onAddNote, onSave, onNoteUpdated, onNoteDeleted,
}: CommentCellProps) {
  const [open,        setOpen]        = useState(false);
  const [draft,       setDraft]       = useState("");
  const [saving,      setSaving]      = useState(false);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editText,    setEditText]    = useState("");
  const [editSaving,  setEditSaving]  = useState(false);
  const [deleting,    setDeleting]    = useState<string | null>(null);
  const [popupStyle,  setPopupStyle]  = useState<React.CSSProperties>({});

  /* lazy-loaded notes: null = not fetched yet */
  const [localNotes,    setLocalNotes]    = useState<NoteEntry[] | null>(null);
  const [notesLoading,  setNotesLoading]  = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);
  const btnRef   = useRef<HTMLButtonElement>(null);
  const fetchStartedRef = useRef(false);

  /* ── Notes to display in popup ── */
  const displayNotes = (localNotes !== null ? localNotes : (noteHistory ?? []))
    .filter(n => n.text?.trim())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const legacyComment = comment?.trim() && !displayNotes.some(n => n.text === comment.trim())
    ? comment.trim()
    : null;
  const latestNote   = displayNotes[0];
  const latestPreview = latestNote?.text?.trim()
    ? (latestNote.text.length > 48 ? `${latestNote.text.slice(0, 48)}…` : latestNote.text)
    : legacyComment
      ? (legacyComment.length > 48 ? `${legacyComment.slice(0, 48)}…` : legacyComment)
      : null;

  /* ── Count badge ── */
  const preloadedCount = (noteHistory?.length ?? 0) > 0 ? noteHistory!.length : (noteCount ?? 0);
  const displayCount   = localNotes !== null ? localNotes.length : preloadedCount;
  const count          = displayCount + (legacyComment ? 1 : 0);

  /* Sync parent note updates (status change / optimistic add) */
  useEffect(() => {
    if (!noteHistory?.length) return;
    setLocalNotes(prev => {
      if (prev === null) return null;
      const ids = new Set(prev.map(n => n.id));
      const incoming = noteHistory.filter(n => !ids.has(n.id));
      if (!incoming.length) return prev;
      return [...incoming, ...prev];
    });
  }, [noteHistory]);

  /* Close on outside click */
  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target as Node) &&
        btnRef.current   && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  /* Reposition popup when it's open and window scrolls/resizes */
  const calcStyle = () => {
    if (!btnRef.current) return;
    const rect       = btnRef.current.getBoundingClientRect();
    const popupH     = 400;
    const popupW     = 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const left       = Math.min(rect.left, window.innerWidth - popupW - 8);

    if (spaceBelow < popupH && rect.top > popupH) {
      setPopupStyle({ position: "fixed", bottom: window.innerHeight - rect.top + 4, left });
    } else {
      setPopupStyle({ position: "fixed", top: rect.bottom + 4, left });
    }
  };

  useEffect(() => {
    if (!open) return;
    calcStyle();
    window.addEventListener("scroll", calcStyle, true);
    window.addEventListener("resize", calcStyle);
    return () => {
      window.removeEventListener("scroll", calcStyle, true);
      window.removeEventListener("resize", calcStyle);
    };
  }, [open]);

  const loadNotesIfNeeded = async () => {
    if (localNotes !== null || fetchStartedRef.current) return;

    const loadedCount = (noteHistory ?? []).filter(n => n.text?.trim()).length;
    const shouldFetch =
      (noteCount ?? 0) > loadedCount ||
      loadedCount === 0;

    if (!shouldFetch && !comment?.trim()) return;

    fetchStartedRef.current = true;
    setNotesLoading(true);
    try {
      const res = await API.get(`/${apiRole}/lead/${id}`);
      const raw = res.data.lead;
      const fetched: NoteEntry[] = (raw?.notes ?? []).map(
        (n: { id: string; text: string; createdAt: string }) => ({
          id: n.id, text: n.text, createdAt: n.createdAt,
        })
      );
      const { noteHistory } = buildNoteHistory({
        notes: fetched,
        comments: raw?.comments,
        followUpNotes: raw?.followUpNotes,
        createdAt: raw?.createdAt,
        updatedAt: raw?.updatedAt,
      });
      setLocalNotes(noteHistory);
    } catch {
      setLocalNotes([]);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleOpen = () => {
    calcStyle();
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen) void loadNotesIfNeeded();
  };

  /* ── Add note ── */
  const handleAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    const tempNote: NoteEntry = { id: `tmp-${Date.now()}`, text, createdAt: new Date().toISOString() };
    setLocalNotes(prev => [tempNote, ...(prev ?? [])]);
    setDraft("");
    setSaving(true);
    try {
      let result: unknown;
      if (onAddNote)    result = await onAddNote(id, text);
      else if (onSave)  await onSave(id, text);

      let newNote: NoteEntry | null = null;
      if (result && typeof result === "object" && "id" in (result as object)) {
        newNote = result as NoteEntry;
      }
      if (!newNote) {
        newNote = { id: Date.now().toString(), text, createdAt: new Date().toISOString() };
      }
      setLocalNotes(prev => prev !== null
        ? [newNote!, ...prev.filter(n => n.id !== tempNote.id)]
        : [newNote!]
      );
    } catch {
      setLocalNotes(prev => prev !== null ? prev.filter(n => n.id !== tempNote.id) : null);
    } finally { setSaving(false); }
  };

  /* ── Update note ── */
  const handleUpdate = async (noteId: string) => {
    const text = editText.trim();
    if (!text) return;
    setEditSaving(true);
    try {
      await API.put(`/${apiRole}/lead/${id}/notes/${noteId}`, { text });
      setLocalNotes(prev => prev !== null ? prev.map(n => n.id === noteId ? { ...n, text } : n) : null);
      onNoteUpdated?.(id, noteId, text);
      setEditId(null);
    } catch { /* toast from interceptor */ }
    finally { setEditSaving(false); }
  };

  /* ── Delete note ── */
  const handleDelete = async (noteId: string) => {
    setDeleting(noteId);
    try {
      await API.delete(`/${apiRole}/lead/${id}/notes/${noteId}`);
      setLocalNotes(prev => prev !== null ? prev.filter(n => n.id !== noteId) : null);
      onNoteDeleted?.(id, noteId);
    } catch { /* toast from interceptor */ }
    finally { setDeleting(null); }
  };

  const popup = open && (
    <div
      ref={popupRef}
      style={{ ...popupStyle, zIndex: 9999, width: 300 }}
      className="bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-gray-100 overflow-hidden"
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
      <div className="max-h-65 overflow-y-auto divide-y divide-gray-50">
        {/* Legacy comment (only if not already in note history) */}
        {legacyComment && (
          <div className="px-4 py-3">
            <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap">{legacyComment}</p>
          </div>
        )}

        {notesLoading && (
          <div className="py-8 text-center">
            <Loader2 size={20} className="text-amber-500 mx-auto mb-2 animate-spin" />
            <p className="text-[12px] text-gray-400">Loading notes…</p>
          </div>
        )}

        {!notesLoading && displayNotes.length === 0 && !legacyComment && (
          <div className="py-8 text-center">
            <StickyNote size={24} className="text-gray-200 mx-auto mb-2" />
            <p className="text-[12px] text-gray-400">No notes yet</p>
          </div>
        )}

        {!notesLoading && displayNotes.map(note => (
          <div key={note.id} className="px-4 py-3 group">
            {editId === note.id ? (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  rows={3}
                  className="w-full text-[12px] rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 outline-none resize-none text-gray-800"
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
              <div>
                <p className="text-[12px] text-gray-800 leading-snug whitespace-pre-wrap">{note.text}</p>
                {note.createdAt && (
                  <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={9} />{fmtTime(note.createdAt)}
                  </p>
                )}
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
  );

  return (
    <div className="relative min-w-0 max-w-[200px]">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`flex flex-col items-start gap-0.5 w-full min-w-[88px] h-auto min-h-8 px-3 py-1.5 rounded-xl border text-left text-[12px] font-semibold transition-all ${
          count > 0
            ? "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"
            : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:bg-gray-800 dark:border-gray-700"
        }`}
      >
        <span className="flex items-center gap-1.5">
          <StickyNote size={13} className="shrink-0" />
          {count > 0 ? <span>{count} note{count !== 1 ? "s" : ""}</span> : <span>Note</span>}
        </span>
        {latestPreview && (
          <span className="text-[10px] font-normal text-gray-600 dark:text-gray-400 line-clamp-2 w-full leading-snug">
            {latestPreview}
            {latestNote?.createdAt && (
              <span className="block text-[9px] text-gray-400 mt-0.5">{fmtTime(latestNote.createdAt)}</span>
            )}
          </span>
        )}
      </button>

      {typeof document !== "undefined" && popup && createPortal(popup, document.body)}
    </div>
  );
}
