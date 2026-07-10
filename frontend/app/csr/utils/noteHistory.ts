import type { NoteEntry } from "../hooks/useLeadsData";

type RawNote = { id?: string; text?: string; createdAt?: string };

/** Merge LeadNote rows + legacy comments/followUpNotes + latestNote preview. */
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
    if (!fromTable.some(n => n.id === ln.id || n.text === ln.text.trim())) {
      fromTable.push({
        id:        ln.id,
        text:      ln.text.trim(),
        createdAt: ln.createdAt,
      });
    }
  }

  const legacy: NoteEntry[] = [];
  if (lead.comments?.trim()) {
    legacy.push({
      id:        "legacy-comments",
      text:      lead.comments.trim(),
      createdAt: lead.createdAt ?? new Date().toISOString(),
    });
  }
  if (lead.followUpNotes?.trim()) {
    legacy.push({
      id:        "legacy-followup",
      text:      lead.followUpNotes.trim(),
      createdAt: lead.updatedAt ?? lead.createdAt ?? new Date().toISOString(),
    });
  }

  const seen = new Set<string>();
  const merged = [...fromTable, ...legacy].filter(n => {
    const key = `${n.text}|${n.createdAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const noteHistory = merged.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const noteCount = Math.max(noteHistory.length, lead.noteCount ?? 0);
  return { noteHistory, noteCount };
}
