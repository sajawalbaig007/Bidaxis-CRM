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
  apiRole?: "csr" | "admin" | "estimator";
  /** View-only — hide add / edit / delete (e.g. technical reading admin bid instructions). */
  readOnly?: boolean;
  /** Show only `comment` (e.g. projectNotes bid instruction) — never load/thread notes. */
  commentOnly?: boolean;
  /** Never lazy-fetch lead notes — use only `noteHistory` / `comment` from props. */
  skipNotesFetch?: boolean;
  /** Optional short label under the sticky (e.g. "Tech"). */
  badgeLabel?: string;
  onAddNote?: (id: string, text: string) => Promise<unknown>;
  onSave?: (id: string, text: string) => Promise<void>;
  onNoteUpdated?: (id: string, noteId: string, text: string, createdAt?: string) => void;
  onNoteDeleted?: (id: string, noteId: string) => void;
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

function isLegacyNoteId(noteId: string) {
  return noteId.startsWith("legacy-") || noteId.startsWith("tmp-");
}

export default function CommentCell({
  id,
  noteHistory,
  noteCount,
  comment,
  apiRole = "csr",
  readOnly = false,
  commentOnly = false,
  skipNotesFetch = false,
  badgeLabel,
  onAddNote,
  onSave,
  onNoteUpdated,
  onNoteDeleted,
}: CommentCellProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  const [localNotes, setLocalNotes] = useState<NoteEntry[] | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);

  const popupRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const fetchStartedRef = useRef(false);

  const displayNotes = commentOnly
    ? []
    : (localNotes !== null ? localNotes : (noteHistory ?? []))
        .filter((n) => n.text?.trim())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const legacyComment = comment?.trim()
    ? commentOnly || !displayNotes.some((n) => n.text === comment.trim())
      ? comment.trim()
      : null
    : null;

  const latestNote = displayNotes[0];
  const latestText = (latestNote?.text?.trim() || legacyComment || "").trim();
  const latestAt = latestNote?.createdAt || null;

  const preloadedCount = (noteHistory?.length ?? 0) > 0 ? noteHistory!.length : (noteCount ?? 0);
  const displayCount = commentOnly ? 0 : localNotes !== null ? localNotes.length : preloadedCount;
  const count = displayCount + (legacyComment ? 1 : 0);
  /** Older notes beyond the latest one shown on the chip */
  const olderCount = Math.max(0, count - (latestText ? 1 : 0));
  const canMutate = !readOnly;

  useEffect(() => {
    if (!noteHistory?.length) return;
    setLocalNotes((prev) => {
      if (prev === null) return null;
      const ids = new Set(prev.map((n) => n.id));
      const incoming = noteHistory.filter((n) => !ids.has(n.id));
      if (!incoming.length) return prev;
      return [...incoming, ...prev];
    });
  }, [noteHistory]);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const calcStyle = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const popupH = 420;
    const popupW = Math.min(340, Math.max(260, window.innerWidth - 16));
    const spaceBelow = window.innerHeight - rect.bottom;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - popupW - 8));

    if (spaceBelow < popupH && rect.top > popupH) {
      setPopupStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + 4,
        left,
        width: popupW,
        maxWidth: "calc(100vw - 16px)",
      });
    } else {
      setPopupStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left,
        width: popupW,
        maxWidth: "calc(100vw - 16px)",
      });
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
    if (commentOnly || skipNotesFetch) return;
    if (localNotes !== null || fetchStartedRef.current) return;

    const loadedCount = (noteHistory ?? []).filter((n) => n.text?.trim()).length;
    const shouldFetch = (noteCount ?? 0) > loadedCount || loadedCount === 0;
    if (!shouldFetch && !comment?.trim()) return;

    fetchStartedRef.current = true;
    setNotesLoading(true);
    try {
      const res = await API.get(`/${apiRole}/lead/${id}`);
      const raw = res.data.lead;
      const fetched: NoteEntry[] = (raw?.notes ?? []).map(
        (n: { id: string; text: string; createdAt: string }) => ({
          id: n.id,
          text: n.text,
          createdAt: n.createdAt,
        }),
      );
      const { noteHistory: built } = buildNoteHistory({
        notes: fetched,
        comments: raw?.comments,
        followUpNotes: raw?.followUpNotes,
        createdAt: raw?.createdAt,
        updatedAt: raw?.updatedAt,
      });
      setLocalNotes(built);
    } catch {
      setLocalNotes(noteHistory ?? []);
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

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    const tempNote: NoteEntry = { id: `tmp-${Date.now()}`, text, createdAt: new Date().toISOString() };
    setLocalNotes((prev) => [tempNote, ...(prev ?? [])]);
    setDraft("");
    setSaving(true);
    try {
      let result: unknown;
      if (onAddNote) result = await onAddNote(id, text);
      else if (onSave) await onSave(id, text);

      let newNote: NoteEntry | null = null;
      if (result && typeof result === "object" && "id" in (result as object)) {
        newNote = result as NoteEntry;
      }
      if (!newNote) {
        newNote = { id: Date.now().toString(), text, createdAt: new Date().toISOString() };
      }
      setLocalNotes((prev) =>
        prev !== null ? [newNote!, ...prev.filter((n) => n.id !== tempNote.id)] : [newNote!],
      );
    } catch {
      setLocalNotes((prev) => (prev !== null ? prev.filter((n) => n.id !== tempNote.id) : null));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (noteId: string) => {
    const text = editText.trim();
    if (!text || isLegacyNoteId(noteId)) return;
    setEditSaving(true);
    try {
      const res = await API.put(`/${apiRole}/lead/${id}/notes/${noteId}`, { text });
      const serverNote = res.data?.note as { id?: string; text?: string; createdAt?: string } | undefined;
      const bumpedAt = serverNote?.createdAt ?? new Date().toISOString();
      setLocalNotes((prev) => {
        const base = prev ?? noteHistory ?? [];
        const next = base.map((n) =>
          n.id === noteId ? { ...n, text: serverNote?.text ?? text, createdAt: bumpedAt } : n,
        );
        const has = next.some((n) => n.id === noteId);
        const withNote = has
          ? next
          : [{ id: noteId, text: serverNote?.text ?? text, createdAt: bumpedAt }, ...next];
        return [...withNote].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
      onNoteUpdated?.(id, noteId, text, bumpedAt);
      setEditId(null);
    } catch {
      /* toast from interceptor */
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (isLegacyNoteId(noteId)) return;
    setDeleting(noteId);
    try {
      await API.delete(`/${apiRole}/lead/${id}/notes/${noteId}`);
      setLocalNotes((prev) => (prev !== null ? prev.filter((n) => n.id !== noteId) : null));
      onNoteDeleted?.(id, noteId);
    } catch {
      /* toast from interceptor */
    } finally {
      setDeleting(null);
    }
  };

  const popup = open && (
    <div
      ref={popupRef}
      style={{ ...popupStyle, zIndex: 9999 }}
      className="rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.2)] border border-amber-200/80 overflow-hidden w-[min(340px,calc(100vw-16px))] bg-[#FFFBEB]"
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-amber-200/70 bg-gradient-to-r from-amber-100 to-amber-50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 shadow-sm">
            <StickyNote size={14} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-amber-900 truncate">
              {readOnly ? "Bid Instruction" : "Sticky Notes"}
              {badgeLabel ? ` · ${badgeLabel}` : ""}
            </p>
            <p className="text-[10px] text-amber-700/80">{count} note{count === 1 ? "" : "s"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-lg text-amber-700/70 hover:bg-amber-200/60 hover:text-amber-900 flex items-center justify-center"
          aria-label="Close notes"
        >
          <X size={14} />
        </button>
      </div>

      <div className="max-h-[280px] overflow-y-auto p-2.5 space-y-2 bg-[#FFFDF5]">
        {legacyComment && (
          <div className="rounded-xl border border-amber-200 bg-[#FEF3C7] px-3 py-2.5 shadow-sm rotate-[-0.3deg]">
            <p className="text-[12px] text-amber-950 leading-snug whitespace-pre-wrap break-words">{legacyComment}</p>
            <p className="text-[9px] text-amber-700/70 mt-1.5 font-medium">Legacy note</p>
          </div>
        )}

        {notesLoading && (
          <div className="py-8 text-center">
            <Loader2 size={20} className="text-amber-500 mx-auto mb-2 animate-spin" />
            <p className="text-[12px] text-amber-700/70">Loading notes…</p>
          </div>
        )}

        {!notesLoading && displayNotes.length === 0 && !legacyComment && (
          <div className="py-8 text-center">
            <StickyNote size={28} className="text-amber-200 mx-auto mb-2" />
            <p className="text-[12px] text-amber-700/60">No sticky notes yet</p>
          </div>
        )}

        {!notesLoading &&
          displayNotes.map((note, idx) => {
            const editable = canMutate && !isLegacyNoteId(note.id);
            return (
              <div
                key={note.id}
                className={`rounded-xl border border-amber-200/90 bg-[#FEF3C7] px-3 py-2.5 shadow-sm ${
                  idx % 2 === 0 ? "rotate-[-0.4deg]" : "rotate-[0.35deg]"
                }`}
              >
                {editId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                      className="w-full text-[12px] rounded-lg border border-amber-300 bg-[#FFFBEB] px-2.5 py-2 outline-none resize-none text-amber-950"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleUpdate(note.id)}
                        disabled={editSaving || !editText.trim()}
                        className="flex-1 h-7 rounded-lg bg-amber-600 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-50"
                      >
                        {editSaving ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="flex-1 h-7 rounded-lg bg-white/80 text-amber-800 text-[11px] font-semibold border border-amber-200"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[12px] text-amber-950 leading-snug whitespace-pre-wrap break-words">
                      {note.text}
                    </p>
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                      {note.createdAt && (
                        <span className="text-[9px] text-amber-700/70 inline-flex items-center gap-1 mr-auto">
                          <Clock size={9} />
                          {fmtTime(note.createdAt)}
                        </span>
                      )}
                      {editable && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditId(note.id);
                              setEditText(note.text);
                            }}
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-white/80 border border-amber-200 text-amber-800 hover:bg-white text-[10px] font-bold"
                          >
                            <Pencil size={9} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(note.id)}
                            disabled={deleting === note.id}
                            className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 text-[10px] font-bold disabled:opacity-50"
                          >
                            {deleting === note.id ? (
                              <Loader2 size={9} className="animate-spin" />
                            ) : (
                              <Trash2 size={9} />
                            )}
                            Del
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {canMutate && (
        <div className="border-t border-amber-200/80 p-3 bg-amber-50/90">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void handleAdd();
            }}
            rows={2}
            placeholder="Write a sticky note… (Ctrl+Enter)"
            className="w-full text-[12px] rounded-xl border border-amber-200 bg-[#FFFBEB] px-3 py-2 outline-none resize-none text-amber-950 placeholder:text-amber-400 focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            disabled={saving || !draft.trim()}
            className="mt-2 w-full h-8 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[12px] font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
            {saving ? "Saving…" : "Add sticky"}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative min-w-0 w-full max-w-full">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        title={count > 0 ? `${count} sticky note${count === 1 ? "" : "s"}` : "Add sticky note"}
        className={`relative flex flex-col items-start gap-0.5 w-full min-w-0 max-w-full text-left rounded-xl border px-2 py-1.5 transition-all shadow-sm ${
          count > 0
            ? "bg-[#FEF3C7] border-amber-300 text-amber-900 hover:bg-[#FDE68A]"
            : "bg-gray-50 border-dashed border-gray-300 text-gray-400 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50"
        }`}
      >
        <span className="flex items-center gap-1.5 w-full min-w-0">
          <StickyNote size={12} className="shrink-0 text-amber-700" />
          {count > 0 ? (
            <>
              <span className="text-[10px] font-bold text-amber-800 shrink-0">
                {badgeLabel || "Note"}
              </span>
              {latestAt && (
                <span className="text-[9px] font-medium text-amber-700/70 tabular-nums whitespace-nowrap truncate">
                  {fmtTime(latestAt)}
                </span>
              )}
              {!latestText && (
                <span className="text-[10px] font-semibold text-amber-800/80 truncate">
                  {count} note{count === 1 ? "" : "s"}
                </span>
              )}
              {olderCount > 0 && (
                <span className="ml-auto shrink-0 inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full bg-amber-700 text-white text-[10px] font-extrabold tabular-nums">
                  +{olderCount}
                </span>
              )}
            </>
          ) : (
            <span className="text-[10px] font-bold leading-none">
              {badgeLabel ? `${badgeLabel} note` : "Add note"}
            </span>
          )}
        </span>
        {latestText ? (
          <span
            className="text-[10px] sm:text-[11px] font-medium text-amber-950/90 line-clamp-2 w-full min-w-0 leading-snug break-words"
            title={latestText}
          >
            {latestText}
          </span>
        ) : null}
      </button>

      {typeof document !== "undefined" && popup && createPortal(popup, document.body)}
    </div>
  );
}
