"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { SubHeadEntry } from "../types";
import { currency, lineAmount, newRowId, todayIso } from "../types";
import HeadDetailModal, { type HeadDetailModel } from "./HeadDetailModal";

export type ExpandableHeadRow = {
  id: string;
  title: string;
  amount: number;
  filledAt?: string;
  note?: string;
  subHeads?: SubHeadEntry[];
};

type ExpandableHeadsTableProps = {
  title: string;
  accent?: string;
  rows: ExpandableHeadRow[];
  onChange: (rows: ExpandableHeadRow[]) => void;
  addLabel?: string;
  emptyLabel?: string;
};

export default function ExpandableHeadsTable({
  title,
  accent = "#0B84F3",
  rows,
  onChange,
  addLabel = "Add Head",
  emptyLabel = "No heads yet.",
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
              note: next.note,
              subHeads: next.subHeads,
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
    });
  };

  const total = rows.reduce((a, r) => a + lineAmount(r), 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b bg-[#F8FAFC] flex items-center justify-between gap-2">
        <h2 className="font-bold text-gray-800 text-sm">{title}</h2>
        <button
          type="button"
          onClick={addRow}
          className="h-8 px-3 rounded-lg text-[11px] font-bold text-white inline-flex items-center gap-1"
          style={{ backgroundColor: accent }}
        >
          <Plus size={13} /> {addLabel}
        </button>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="sticky top-0 z-10 bg-[#FAFBFC]">
            <tr className="border-b border-gray-200">
              <th className="w-8 px-2 py-2.5" />
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Head</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500 w-[110px]">Filled</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500 w-[120px]">Total</th>
              <th className="w-24 px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-10 text-center text-gray-400 text-sm">{emptyLabel}</td>
              </tr>
            ) : (
              rows.map(row => {
                const expanded = openIds.has(row.id);
                const subs = row.subHeads ?? [];
                const amt = lineAmount(row);
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b border-gray-100 hover:bg-[#FAFAFA]">
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => toggle(row.id)}
                          className="w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
                          title="Toggle individuals"
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-gray-800">
                        {row.title}
                        {subs.length > 0 && (
                          <span className="ml-2 text-[10px] font-bold text-gray-400">{subs.length} items</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-500">{row.filledAt || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums text-gray-800">{currency(amt)}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="w-8 h-8 rounded-lg text-[#0B84F3] hover:bg-[#EAF5FF] inline-flex items-center justify-center"
                            title="Edit in popup"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onChange(rows.filter(r => r.id !== row.id))}
                            className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 inline-flex items-center justify-center"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-[#F8FAFC]">
                        <td colSpan={5} className="px-4 py-2">
                          {subs.length === 0 ? (
                            <p className="text-[11px] text-gray-400 py-2">
                              No individual heads — open Edit to add sub-heads.
                            </p>
                          ) : (
                            <div className="rounded-xl border border-gray-100 overflow-hidden bg-white">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b bg-gray-50 text-gray-500">
                                    <th className="px-3 py-1.5 text-left font-semibold">Individual</th>
                                    <th className="px-3 py-1.5 text-center font-semibold w-[110px]">Filled date</th>
                                    <th className="px-3 py-1.5 text-right font-semibold w-[100px]">Amount</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {subs.map(s => (
                                    <tr key={s.id} className="border-b border-gray-50">
                                      <td className="px-3 py-1.5 text-gray-700">{s.label}</td>
                                      <td className="px-3 py-1.5 text-center text-gray-500">{s.filledAt || "—"}</td>
                                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{currency(s.amount)}</td>
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
            <tr className="bg-[#FFF1F3] border-t">
              <td colSpan={3} className="px-3 py-3 font-extrabold text-gray-800">Section Total</td>
              <td className="px-3 py-3 text-right font-extrabold text-[#B8112D] tabular-nums">{currency(total)}</td>
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
      />
    </div>
  );
}
