"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { DatedNote, SubHeadEntry } from "../types";
import { currency, lineAmount, normalizeNotes, newRowId, todayIso } from "../types";
import AccountsNotesCell from "./AccountsNotesCell";
import HeadDetailModal, { type HeadDetailModel } from "./HeadDetailModal";

export type ExpandableHeadRow = {
  id: string;
  title: string;
  amount: number;
  filledAt?: string;
  note?: string;
  subHeads?: SubHeadEntry[];
  notes?: DatedNote[];
};

type ExpandableHeadsTableProps = {
  title: string;
  accent?: string;
  rows: ExpandableHeadRow[];
  onChange: (rows: ExpandableHeadRow[]) => void;
  addLabel?: string;
  emptyLabel?: string;
  allowProofUpload?: boolean;
  onUploadProof?: (file: File) => Promise<{ fileUrl: string; fileName: string }>;
};

export default function ExpandableHeadsTable({
  title,
  accent = "#0B84F3",
  rows,
  onChange,
  addLabel = "Add Head",
  emptyLabel = "No heads yet.",
  allowProofUpload = false,
  onUploadProof,
}: ExpandableHeadsTableProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<HeadDetailModel | null>(null);

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addRow = () => {
    onChange([
      ...rows,
      {
        id: newRowId("h"),
        title: "New Head",
        amount: 0,
        filledAt: todayIso(),
        subHeads: [],
        notes: [],
      },
    ]);
  };

  const saveEditing = (next: HeadDetailModel) => {
    setEditing(next);
    onChange(
      rows.map(r =>
        r.id === next.id
          ? {
              ...r,
              title: next.title,
              amount: next.subHeads.length > 0
                ? next.subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0)
                : next.amount,
              filledAt: next.filledAt,
              note: next.notes[0]?.text ?? next.note,
              subHeads: next.subHeads,
              notes: next.notes,
            }
          : r,
      ),
    );
  };

  const deleteEditing = () => {
    if (!editing) return;
    onChange(rows.filter(r => r.id !== editing.id));
    setEditing(null);
  };

  const openEdit = (row: ExpandableHeadRow) => {
    setEditing({
      id: row.id,
      title: row.title,
      amount: row.amount,
      filledAt: row.filledAt ?? todayIso(),
      note: row.note,
      subHeads: row.subHeads ?? [],
      notes: normalizeNotes(row.notes, row.note, row.filledAt),
    });
  };

  const total = rows.reduce((a, r) => a + lineAmount(r), 0);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100/90 overflow-hidden shadow-[0_4px_24px_-8px_rgba(15,23,42,0.08)]">
      <div
        className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between gap-2"
        style={{ background: `linear-gradient(90deg, ${accent}12 0%, #ffffff 55%)` }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: accent }} />
          <h2 className="font-extrabold text-gray-800 text-sm tracking-tight truncate">{title}</h2>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="h-8 px-3 rounded-xl text-[11px] font-bold text-white inline-flex items-center gap-1 shadow-sm hover:opacity-95 transition-opacity shrink-0"
          style={{ backgroundColor: accent }}
        >
          <Plus size={13} /> {addLabel}
        </button>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="sticky top-0 z-10 bg-[#FAFBFC]/95 backdrop-blur-sm">
            <tr className="border-b border-gray-200/80">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Head</th>
              <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 min-w-[160px]">Notes</th>
              <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400 w-[100px]">Filled</th>
              <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 w-[110px]">Total</th>
              <th className="w-24 px-2 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-12 text-center text-gray-400 text-sm">{emptyLabel}</td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const expanded = openIds.has(row.id);
                const subs = row.subHeads ?? [];
                const amt = lineAmount(row);
                return (
                  <Fragment key={row.id}>
                    <tr className={`border-b border-gray-50 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-[#FCFCFD]"} hover:bg-[#F8FAFC]`}>
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(row.id)}
                          className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 inline-flex items-center justify-center transition-colors"
                          title="Toggle individuals"
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">
                        {row.title}
                        {subs.length > 0 && (
                          <span
                            className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white/95"
                            style={{ backgroundColor: accent }}
                          >
                            {subs.length}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        <AccountsNotesCell
                          notes={row.notes}
                          legacyNote={row.note}
                          fallbackDate={row.filledAt}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500 tabular-nums">{row.filledAt || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-gray-900">{currency(amt)}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="w-8 h-8 rounded-lg text-[#0B84F3] hover:bg-[#EAF5FF] inline-flex items-center justify-center transition-colors"
                            title="Edit in popup"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onChange(rows.filter(r => r.id !== row.id))}
                            className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 inline-flex items-center justify-center transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-[#F8FAFC]">
                        <td colSpan={6} className="px-4 py-2.5">
                          {subs.length === 0 ? (
                            <p className="text-[11px] text-gray-400 py-1">No individual heads — open Edit to add sub-heads.</p>
                          ) : (
                            <div className="rounded-xl border border-gray-100 overflow-hidden bg-white shadow-sm">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b bg-gray-50/80 text-gray-400">
                                    <th className="px-3 py-2 text-left font-bold uppercase tracking-wide text-[10px]">Individual</th>
                                    <th className="px-3 py-2 text-center font-bold uppercase tracking-wide text-[10px] w-[110px]">Filled date</th>
                                    {allowProofUpload && (
                                      <th className="px-3 py-2 text-center font-bold uppercase tracking-wide text-[10px] w-[90px]">Proof</th>
                                    )}
                                    <th className="px-3 py-2 text-right font-bold uppercase tracking-wide text-[10px] w-[100px]">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {subs.map(s => (
                                    <tr key={s.id} className="border-b border-gray-50 last:border-0">
                                      <td className="px-3 py-2 text-gray-700 font-medium">{s.label}</td>
                                      <td className="px-3 py-2 text-center text-gray-500 tabular-nums">{s.filledAt || "—"}</td>
                                      {allowProofUpload && (
                                        <td className="px-3 py-2 text-center">
                                          {s.proofUrl ? (
                                            <a
                                              href={s.proofUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-[10px] font-bold text-emerald-600 hover:underline"
                                            >
                                              View
                                            </a>
                                          ) : (
                                            <span className="text-[10px] text-gray-300">—</span>
                                          )}
                                        </td>
                                      )}
                                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-800">{currency(s.amount)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2" style={{ borderColor: `${accent}33`, background: `${accent}0D` }}>
              <td colSpan={4} className="px-3 py-3.5 font-extrabold text-gray-800">Section Total</td>
              <td className="px-3 py-3.5 text-right font-extrabold tabular-nums text-base" style={{ color: accent }}>
                {currency(total)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <HeadDetailModal
        open={!!editing}
        title={`Edit — ${title}`}
        value={editing}
        onClose={() => setEditing(null)}
        onSave={saveEditing}
        onDelete={deleteEditing}
        allowProofUpload={allowProofUpload}
        onUploadProof={onUploadProof}
      />
    </div>
  );
}
