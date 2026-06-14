"use client";

import { useState } from "react";
import { Check, StickyNote, Plus, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { NoteEntry } from "../../hooks/useLeadsData";

interface CommentCellProps {
  id: string;
  noteHistory?: NoteEntry[];
  comment?: string;
  onAddNote?: (id: string, text: string) => Promise<void>;
  onSave?: (id: string, comment: string) => Promise<void>;
}

function fmtTime(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return ""; }
}

export default function CommentCell({ id, noteHistory, comment, onAddNote, onSave }: CommentCellProps) {
  const [adding,   setAdding]   = useState(false);
  const [draft,    setDraft]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [expanded, setExpanded] = useState(false);

  const notes  = noteHistory ?? [];
  const latest = notes.length > 0 ? notes[notes.length - 1] : null;
  const legacyText = comment ?? "";

  const handleSave = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      if (onAddNote) {
        await onAddNote(id, text);
      } else if (onSave) {
        await onSave(id, text);
      }
      setDraft("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const displayText  = latest?.text ?? legacyText;
  const displayTime  = latest?.createdAt ? fmtTime(latest.createdAt) : "";
  const hasNotes     = notes.length > 0 || !!legacyText;
  const historyNotes = notes.length > 1 ? notes.slice(0, -1).reverse() : [];

  return (
    <div className="w-full max-w-[220px] space-y-1.5">

      {/* Latest note display */}
      {hasNotes && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 shadow-[1px_1px_3px_rgba(0,0,0,0.05)]">
          <p className="text-[11px] text-amber-900 leading-snug line-clamp-3 whitespace-pre-wrap">{displayText}</p>
          {displayTime && (
            <p className="text-[9px] text-amber-400 mt-1 flex items-center gap-0.5">
              <Clock size={8} />{displayTime}
            </p>
          )}
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-1">
        {/* Add note button */}
        <button
          onClick={() => { setAdding(a => !a); setDraft(""); }}
          className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors"
        >
          <Plus size={10} />Note
        </button>

        {/* Expand history */}
        {historyNotes.length > 0 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-0.5 text-[9px] text-amber-500 hover:text-amber-700 transition-colors"
          >
            {expanded ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            {historyNotes.length}
          </button>
        )}

        {/* Empty state icon */}
        {!hasNotes && !adding && (
          <StickyNote size={13} className="text-amber-300" />
        )}
      </div>

      {/* Add note textarea */}
      {adding && (
        <div className="flex flex-col gap-1.5">
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="Type your note..."
            className="w-full rounded-xl border border-amber-400 bg-amber-50 px-2.5 py-2 text-[12px] outline-none resize-none text-amber-900 placeholder:text-amber-300"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleSave}
              disabled={saving || !draft.trim()}
              className="flex-1 h-7 rounded-xl bg-amber-500 text-white text-[10px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50"
            >
              <Check size={10} />{saving ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setAdding(false); setDraft(""); }}
              className="flex-1 h-7 rounded-xl bg-gray-100 text-gray-500 text-[10px] font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Note history */}
      {expanded && historyNotes.map(n => (
        <div key={n.id} className="bg-gray-50 border border-gray-200 rounded-lg p-2">
          <p className="text-[10px] text-gray-700 leading-snug whitespace-pre-wrap line-clamp-2">{n.text}</p>
          {n.createdAt && (
            <p className="text-[9px] text-gray-400 mt-0.5 flex items-center gap-0.5">
              <Clock size={8} />{fmtTime(n.createdAt)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
