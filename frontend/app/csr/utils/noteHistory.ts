import type { NoteEntry } from "../hooks/useLeadsData";

type RawNote = { id?: string; text?: string; createdAt?: string };

function noteTextKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Merge LeadNote rows + legacy comments/followUpNotes + latestNote preview.
 *  Prefer table notes; only add legacy text that is not already present
 *  (avoids CSR duplicate notes after seed / dual-write). */
export function buildNoteHistory(lead: {
  notes?: RawNote[];
  latestNote?: { id: string; text: string; createdAt: string } | null;
  comments?: string | null;
  followUpNotes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  noteCount?: number;
}): { noteHistory: NoteEntry[]; noteCount: number } {
  const fromTable: NoteEntry[] = (lead.notes ?? [])
    .filter(n => n.text?.trim())
    .map(n => ({
      id:        n.id ?? `note-${n.text!.slice(0, 12)}`,
      text:      n.text!.trim(),
      createdAt: n.createdAt ?? new Date().toISOString(),
    }));

  if (lead.latestNote?.text?.trim()) {
    const ln = lead.latestNote;
    if (!fromTable.some(n => n.id === ln.id || noteTextKey(n.text) === noteTextKey(ln.text))) {
      fromTable.push({
        id:        ln.id,
        text:      ln.text.trim(),
        createdAt: ln.createdAt,
      });
    }
  }

  const seen = new Set<string>();
  const merged: NoteEntry[] = [];

  const pushUnique = (entry: NoteEntry) => {
    const key = noteTextKey(entry.text);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(entry);
  };

  for (const n of fromTable) pushUnique(n);

  /* Legacy fields only if that text is not already in LeadNote */
  if (lead.comments?.trim()) {
    pushUnique({
      id:        "legacy-comments",
      text:      lead.comments.trim(),
      createdAt: lead.createdAt ?? new Date().toISOString(),
    });
  }
  if (lead.followUpNotes?.trim()) {
    const followUp = lead.followUpNotes.trim();
    /* Multi-line follow-up logs: add each line only if not already shown */
    const lines = followUp.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length > 1) {
      lines.forEach((line, i) => {
        pushUnique({
          id:        `legacy-followup-${i}`,
          text:      line,
          createdAt: lead.updatedAt ?? lead.createdAt ?? new Date().toISOString(),
        });
      });
    } else {
      pushUnique({
        id:        "legacy-followup",
        text:      followUp,
        createdAt: lead.updatedAt ?? lead.createdAt ?? new Date().toISOString(),
      });
    }
  }

  const noteHistory = merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const noteCount = Math.max(noteHistory.length, lead.noteCount ?? 0);
  return { noteHistory, noteCount };
}
