import { useEffect } from "react";
import API from "@/lib/api";
import { buildNoteHistory } from "../utils/noteHistory";
import type { NoteEntry } from "./useLeadsData";

type NotePack = {
  noteCount: number;
  notes: { id: string; text: string; createdAt: string; parentId?: string | null }[];
};

type NoteRow = {
  id: string;
  noteHistory?: NoteEntry[];
  noteCount?: number;
  comments?: string;
  followUpNotes?: string;
  createdAt?: string;
  statusUpdatedAt?: string;
};

/** Fill note previews for the rows on screen, after the list itself has loaded. */
export function useVisibleLeadNotes<T extends NoteRow>(
  rows: T[],
  setRows: (updater: (prev: T[]) => T[]) => void,
) {
  const key = rows.map(row => row.id).filter(Boolean).slice(0, 40).join(",");

  useEffect(() => {
    if (!key) return;
    let cancel = false;
    API.get("/csr/page-notes", { params: { ids: key }, timeout: 20_000 })
      .then(res => {
        if (cancel) return;
        const byId = res.data?.byId as Record<string, NotePack> | undefined;
        if (!byId) return;
        setRows(prev => {
          let changed = false;
          const next = prev.map(row => {
            const pack = byId[row.id];
            if (!pack) return row;
            const built = buildNoteHistory({
              notes: pack.notes,
              noteCount: pack.noteCount,
              comments: row.comments,
              followUpNotes: row.followUpNotes,
              createdAt: row.createdAt ?? row.statusUpdatedAt,
              updatedAt: row.statusUpdatedAt ?? row.createdAt,
            });
            const sameFirst = (row.noteHistory?.[0]?.id ?? "") === (built.noteHistory[0]?.id ?? "");
            const sameCount = (row.noteCount ?? row.noteHistory?.length ?? 0) === built.noteCount;
            if (sameFirst && sameCount && (row.noteHistory?.length ?? 0) === built.noteHistory.length) return row;
            changed = true;
            return { ...row, noteHistory: built.noteHistory, noteCount: built.noteCount };
          });
          return changed ? next : prev;
        });
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [key, setRows]);
}
