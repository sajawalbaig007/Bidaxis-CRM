"use client";

import { useState } from "react";
import type { DatedNote } from "../types";
import { normalizeNotes } from "../types";

type AccountsNotesCellProps = {
  notes?: DatedNote[];
  legacyNote?: string;
  fallbackDate?: string;
  className?: string;
};

/** Latest note on top; +N expands older notes history underneath (CSR/Admin style). */
export default function AccountsNotesCell({
  notes,
  legacyNote,
  fallbackDate,
  className = "",
}: AccountsNotesCellProps) {
  const [open, setOpen] = useState(false);
  const sorted = [...normalizeNotes(notes, legacyNote, fallbackDate)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  const latest = sorted[0];
  const older = sorted.slice(1);

  if (!latest) {
    return <span className={`text-crm-text-faint text-xs ${className}`}>—</span>;
  }

  const preview =
    latest.text.length > 56 ? `${latest.text.slice(0, 56)}…` : latest.text || "—";

  return (
    <div className={`min-w-0 max-w-[220px] ${className}`}>
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-amber-700 tabular-nums leading-tight">{latest.date}</p>
          <p className="text-xs text-crm-text-secondary leading-snug line-clamp-2" title={latest.text}>
            {preview}
          </p>
        </div>
        {older.length > 0 && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setOpen(v => !v);
            }}
            className="shrink-0 mt-0.5 bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
            title={open ? "Hide note history" : `Show ${older.length} older note${older.length === 1 ? "" : "s"}`}
            aria-expanded={open}
          >
            +{older.length}
          </button>
        )}
      </div>

      {open && older.length > 0 && (
        <div className="mt-1.5 rounded-lg border border-amber-100 bg-amber-50/60 overflow-hidden">
          <p className="px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-800 border-b border-amber-100">
            History
          </p>
          <ul className="max-h-36 overflow-y-auto divide-y divide-amber-100/80">
            {older.map(n => (
              <li key={n.id} className="px-2 py-1.5">
                <p className="text-[10px] font-bold text-amber-700 tabular-nums">{n.date}</p>
                <p className="text-[11px] text-crm-text-secondary leading-snug whitespace-pre-wrap">{n.text || "—"}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
