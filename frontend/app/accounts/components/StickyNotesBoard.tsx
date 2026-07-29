"use client";

import { useRef, useState } from "react";
import { Plus, StickyNote, X } from "lucide-react";
import type { StickyNote as StickyNoteType } from "../types";
import { newRowId } from "../types";

const NOTE_COLORS = ["#FEF3C7", "#FCE7F3", "#DBEAFE", "#D1FAE5", "#EDE9FE", "#FFEDD5"];

type StickyNotesBoardProps = {
  notes: StickyNoteType[];
  onChange: (notes: StickyNoteType[]) => void;
};

export default function StickyNotesBoard({ notes, onChange }: StickyNotesBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [minimized, setMinimized] = useState(false);

  const addNote = () => {
    const count = notes.length;
    onChange([
      ...notes,
      {
        id: newRowId("note"),
        text: "",
        color: NOTE_COLORS[count % NOTE_COLORS.length],
        x: 24 + (count % 4) * 28,
        y: 24 + (count % 3) * 28,
        width: 200,
        height: 160,
      },
    ]);
    setMinimized(false);
  };

  const updateNote = (id: string, patch: Partial<StickyNoteType>) => {
    onChange(notes.map(n => (n.id === id ? { ...n, ...patch } : n)));
  };

  const removeNote = (id: string) => onChange(notes.filter(n => n.id !== id));

  const onPointerDown = (e: React.PointerEvent, note: StickyNoteType) => {
    const target = e.target as HTMLElement;
    if (target.closest("textarea") || target.closest("button")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging({
      id: note.id,
      ox: e.clientX - (note.x ?? 24),
      oy: e.clientY - (note.y ?? 24),
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - dragging.ox, rect.width - 120));
    const y = Math.max(0, Math.min(e.clientY - dragging.oy, rect.height - 80));
    updateNote(dragging.id, { x, y });
  };

  const onPointerUp = () => setDragging(null);

  return (
    <div className="relative mt-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <StickyNote size={15} className="text-amber-500" />
          <h2 className="font-bold text-gray-800 text-sm">Sticky Notes</h2>
          <span className="text-[10px] text-gray-400 font-medium">IDE-style · drag to move</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMinimized(v => !v)}
            className="h-8 px-3 rounded-lg bg-gray-100 text-gray-600 text-[11px] font-bold hover:bg-gray-200"
          >
            {minimized ? "Show board" : "Hide board"}
          </button>
          <button
            type="button"
            onClick={addNote}
            className="h-8 px-3 rounded-lg bg-amber-100 text-amber-800 text-[11px] font-bold inline-flex items-center gap-1 hover:bg-amber-200"
          >
            <Plus size={13} /> Add Note
          </button>
        </div>
      </div>

      {!minimized && (
        <div
          ref={boardRef}
          className="relative h-[280px] sm:h-[320px] rounded-2xl border border-dashed border-amber-200 bg-[repeating-linear-gradient(0deg,transparent,transparent_23px,#f3f4f6_24px),repeating-linear-gradient(90deg,transparent,transparent_23px,#f3f4f6_24px)] bg-[length:24px_24px] overflow-hidden"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {notes.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 pointer-events-none">
              Add a sticky note — drag anywhere on the board
            </p>
          )}
          {notes.map((note, idx) => (
            <div
              key={note.id}
              onPointerDown={e => onPointerDown(e, note)}
              className="absolute rounded-md shadow-lg border border-black/10 flex flex-col cursor-grab active:cursor-grabbing select-none"
              style={{
                left: note.x ?? 24 + (idx % 4) * 28,
                top: note.y ?? 24 + (idx % 3) * 28,
                width: note.width ?? 200,
                height: note.height ?? 160,
                backgroundColor: note.color || NOTE_COLORS[idx % NOTE_COLORS.length],
                zIndex: dragging?.id === note.id ? 40 : 10 + idx,
              }}
            >
              <div className="flex items-center justify-between px-2 py-1 border-b border-black/5">
                <span className="text-[10px] font-bold text-black/40 uppercase tracking-wide">Note</span>
                <button
                  type="button"
                  onClick={() => removeNote(note.id)}
                  className="w-5 h-5 rounded text-black/40 hover:bg-black/10 flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
              <textarea
                value={note.text}
                onChange={e => updateNote(note.id, { text: e.target.value })}
                placeholder="Type here…"
                className="flex-1 w-full bg-transparent resize-none text-sm text-gray-800 outline-none p-2 placeholder:text-black/30"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
