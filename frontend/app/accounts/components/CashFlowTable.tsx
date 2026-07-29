"use client";

import { Fragment, useState } from "react";
import {
  Plus, Trash2, Landmark, CalendarDays, ChevronDown, ChevronRight, StickyNote,
} from "lucide-react";
import type { CashFlowMonth, CashFlowRow, DatedNote } from "../types";
import { currency, latestNote, newRowId, normalizeNotes, todayIso } from "../types";
import { TABLE_VARIANT, bankColor } from "./accountsTheme";
import { RowEditToggle } from "./ViewEditCell";

function bankActivity(row: CashFlowRow): boolean {
  return Object.values(row.bankAmounts ?? {}).some(
    b => (Number(b.debit) || 0) !== 0 || (Number(b.credit) || 0) !== 0,
  );
}

export function computedNet(row: CashFlowRow): number {
  let debit = 0;
  let credit = 0;
  for (const b of Object.values(row.bankAmounts ?? {})) {
    debit += Number(b.debit) || 0;
    credit += Number(b.credit) || 0;
  }
  if (debit === 0 && credit === 0) return Number(row.netAmount) || 0;
  return debit - credit;
}

type CashFlowTableProps = {
  months: CashFlowMonth[];
  bankHeads: string[];
  onUpdateMonthTitle: (monthId: string, title: string) => void;
  onRemoveMonth: (monthId: string) => void;
  onUpdateRow: (monthId: string, rowId: string, patch: Partial<CashFlowRow>) => void;
  onUpdateBank: (monthId: string, rowId: string, bank: string, side: "debit" | "credit", val: number) => void;
  onRemoveRow: (monthId: string, rowId: string) => void;
  onAddRow: (monthId: string) => void;
};

function CashFlowRowBlock({
  row,
  monthId,
  bankHeads,
  editing,
  expanded,
  onToggleEdit,
  onToggleExpand,
  onUpdateRow,
  onUpdateBank,
  onRemoveRow,
}: {
  row: CashFlowRow;
  monthId: string;
  bankHeads: string[];
  editing: boolean;
  expanded: boolean;
  onToggleEdit: () => void;
  onToggleExpand: () => void;
  onUpdateRow: CashFlowTableProps["onUpdateRow"];
  onUpdateBank: CashFlowTableProps["onUpdateBank"];
  onRemoveRow: CashFlowTableProps["onRemoveRow"];
}) {
  const theme = TABLE_VARIANT.cashflow;
  const net = computedNet(row);
  const isAutoNet = bankActivity(row);
  const inputCls = `h-8 w-full min-w-0 rounded-lg border border-gray-200 px-2 text-xs outline-none focus:ring-2 ${theme.input}`;
  const notes = normalizeNotes(row.notes, undefined, row.date);
  const latest = latestNote(row.notes, undefined, row.date);
  const colSpan = 3 + bankHeads.length * 2 + 2; // expand + date + desc + banks*2 + note + net + edit

  const setNotes = (next: DatedNote[]) => {
    onUpdateRow(monthId, row.id, { notes: next });
  };

  const addNote = () => {
    setNotes([{ id: newRowId("n"), text: "", date: todayIso() }, ...notes]);
  };

  const updateNote = (id: string, patch: Partial<DatedNote>) => {
    setNotes(notes.map(n => (n.id === id ? { ...n, ...patch } : n)));
  };

  const removeNote = (id: string) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <Fragment>
      <tr className={`border-b border-gray-100 ${theme.rowHover} transition-colors`}>
        <td className="px-1 py-2 text-center">
          <button
            type="button"
            onClick={onToggleExpand}
            className="w-7 h-7 rounded-lg text-gray-500 hover:bg-gray-100 inline-flex items-center justify-center"
            title="Toggle notes"
          >
            {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </td>
        <td className="px-2 py-2">
          {editing ? (
            <input type="date" value={row.date?.slice(0, 10) ?? ""} onChange={e => onUpdateRow(monthId, row.id, { date: e.target.value })} className={inputCls} />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap px-1">
              <CalendarDays size={11} className="text-gray-400" />
              {row.date?.slice(0, 10) || "—"}
            </span>
          )}
        </td>
        <td className="px-2 py-2">
          {editing ? (
            <input value={row.description} onChange={e => onUpdateRow(monthId, row.id, { description: e.target.value })} className={`${inputCls} min-w-[140px]`} />
          ) : (
            <span className="text-sm text-[#0F172A] font-medium truncate block max-w-[200px]" title={row.description}>
              {row.description || "—"}
              {notes.length > 0 && (
                <span className="ml-2 text-[10px] font-bold text-amber-700">{notes.length}n</span>
              )}
            </span>
          )}
        </td>
        {bankHeads.map((bank, bi) => {
          const b = row.bankAmounts?.[bank] ?? { debit: 0, credit: 0 };
          const col = bankColor(bi);
          return (
            <Fragment key={bank}>
              <td className="px-1 py-2" style={{ borderLeft: `2px solid ${col}${editing ? "33" : "18"}` }}>
                {editing ? (
                  <input type="number" value={b.debit} onChange={e => onUpdateBank(monthId, row.id, bank, "debit", Number(e.target.value || 0))} className={`${inputCls} text-right tabular-nums`} />
                ) : (
                  <span className="block text-right text-xs tabular-nums text-[#334155] px-1">{b.debit ? currency(b.debit) : <span className="text-gray-300">—</span>}</span>
                )}
              </td>
              <td className="px-1 py-2" style={{ borderRight: `2px solid ${col}${editing ? "33" : "18"}` }}>
                {editing ? (
                  <input type="number" value={b.credit} onChange={e => onUpdateBank(monthId, row.id, bank, "credit", Number(e.target.value || 0))} className={`${inputCls} text-right tabular-nums`} />
                ) : (
                  <span className="block text-right text-xs tabular-nums text-[#334155] px-1">{b.credit ? currency(b.credit) : <span className="text-gray-300">—</span>}</span>
                )}
              </td>
            </Fragment>
          );
        })}
        <td className="px-2 py-2.5 text-xs text-gray-600 max-w-[160px]">
          {latest ? (
            <span className="block truncate" title={latest.text}>
              <span className="text-[10px] font-bold text-amber-700 mr-1">{latest.date}</span>
              {latest.text || "—"}
            </span>
          ) : (
            <span className="text-gray-300">—</span>
          )}
        </td>
        <td className="px-2 py-2 text-right">
          {editing ? (
            <input
              type="number"
              value={isAutoNet ? net : row.netAmount}
              disabled={isAutoNet}
              onChange={e => onUpdateRow(monthId, row.id, { netAmount: Number(e.target.value || 0) })}
              className={`${inputCls} font-bold tabular-nums ${isAutoNet ? "bg-[#F8FAFC] text-[#64748B]" : ""}`}
            />
          ) : (
            <>
              <span className="text-sm font-bold text-[#B8112D] tabular-nums">{currency(net)}</span>
              {isAutoNet && <span className="block text-[9px] text-gray-400 font-semibold">auto</span>}
            </>
          )}
        </td>
        <td className="px-2 py-2">
          <div className="flex flex-col items-center gap-1">
            <RowEditToggle editing={editing} onToggle={onToggleEdit} />
            {editing && (
              <button type="button" onClick={() => onRemoveRow(monthId, row.id)} className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center" title="Delete row">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[#F8FAFC]">
          <td colSpan={colSpan} className="px-4 py-2.5">
            <div className="rounded-xl border border-amber-100 overflow-hidden bg-white shadow-sm">
              <div className="px-3 py-1.5 bg-amber-50/80 text-[10px] font-bold uppercase tracking-wide text-amber-800 border-b border-amber-100 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5">
                  <StickyNote size={12} /> Notes by date
                </span>
                {editing && (
                  <button type="button" onClick={addNote} className="text-[11px] font-bold text-amber-700 inline-flex items-center gap-1 normal-case tracking-normal">
                    <Plus size={12} /> Add note
                  </button>
                )}
              </div>
              {notes.length === 0 ? (
                <p className="text-[11px] text-gray-400 px-3 py-2">
                  {editing ? "No notes yet — add one with a date." : "No notes — switch to Edit to add."}
                </p>
              ) : editing ? (
                <div className="p-2 space-y-2 max-h-52 overflow-y-auto">
                  {[...notes].sort((a, b) => b.date.localeCompare(a.date)).map(n => (
                    <div key={n.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={n.date}
                          onChange={e => updateNote(n.id, { date: e.target.value })}
                          className="h-8 rounded-lg border border-amber-200/80 bg-white px-2 text-[11px] flex-1"
                        />
                        <button type="button" onClick={() => removeNote(n.id)} className="text-red-500 w-7 h-7 flex items-center justify-center">
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <textarea
                        value={n.text}
                        onChange={e => updateNote(n.id, { text: e.target.value })}
                        placeholder="Write note…"
                        rows={2}
                        className="w-full rounded-lg border border-amber-200/80 bg-white px-2 py-1.5 text-xs outline-none resize-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {[...notes].sort((a, b) => b.date.localeCompare(a.date)).map(n => (
                      <tr key={n.id} className="border-b border-amber-50 last:border-0">
                        <td className="px-3 py-1.5 w-[110px] font-semibold text-amber-800 tabular-nums">{n.date}</td>
                        <td className="px-3 py-1.5 text-gray-700">{n.text || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export default function CashFlowTable({
  months,
  bankHeads,
  onUpdateMonthTitle,
  onRemoveMonth,
  onUpdateRow,
  onUpdateBank,
  onRemoveRow,
  onAddRow,
}: CashFlowTableProps) {
  const theme = TABLE_VARIANT.cashflow;
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const toggleRow = (rowId: string) => {
    setEditingRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else {
        next.add(rowId);
        setOpenRows(o => new Set(o).add(rowId));
      }
      return next;
    });
  };

  const toggleExpand = (rowId: string) => {
    setOpenRows(prev => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  if (months.length === 0) {
    return (
      <div className={`bg-white rounded-2xl border-2 p-12 text-center ${theme.card}`}>
        <Landmark size={32} className="mx-auto text-gray-300 mb-3" />
        <p className="text-gray-500 text-sm">No cashflow entries yet. Add a month section or new entry.</p>
      </div>
    );
  }

  const footerColSpan = 4 + bankHeads.length * 2; // expand+date+desc+note + banks before net

  return (
    <div className="space-y-5">
      {months.map(month => {
        const sectionTotal = month.rows.reduce((a, r) => a + computedNet(r), 0);
        return (
          <div key={month.id} className={`bg-white rounded-2xl border-2 overflow-hidden ${theme.card}`}>
            <div className={`px-4 py-3 border-b flex items-center gap-3 ${theme.header}`}>
              <input
                value={month.month}
                onChange={e => onUpdateMonthTitle(month.id, e.target.value)}
                className={`flex-1 min-w-0 bg-transparent font-extrabold text-sm sm:text-base outline-none ${theme.headerText}`}
              />
              <button type="button" onClick={() => onAddRow(month.id)} className="h-8 px-3 rounded-lg bg-[#EAF5FF] text-[#0B84F3] text-[11px] font-bold inline-flex items-center gap-1">
                <Plus size={13} /> Row
              </button>
              <button type="button" onClick={() => onRemoveMonth(month.id)} className="text-[11px] font-semibold text-red-500 hover:underline px-2">
                Remove
              </button>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
              <table className="w-full text-sm" style={{ minWidth: `${820 + bankHeads.length * 128}px` }}>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-200 bg-[#FAFBFC]">
                    <th className="w-8 px-1 py-2.5" />
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 w-[118px]">Date</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 min-w-[160px]">Description</th>
                    {bankHeads.map((bank, bi) => (
                      <th key={bank} colSpan={2} className="px-1 py-2 text-center" style={{ borderBottom: `3px solid ${bankColor(bi)}` }}>
                        <span className="text-[10px] font-bold uppercase tracking-wide block" style={{ color: bankColor(bi) }}>{bank}</span>
                        <div className="flex justify-between text-[9px] font-semibold text-gray-400 mt-1 px-1">
                          <span>Dr</span><span>Cr</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 min-w-[140px]">Latest note</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-[#B8112D] w-[96px]">Net</th>
                    <th className="w-14 px-1 py-2.5 text-center text-[10px] font-bold uppercase text-gray-400">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {month.rows.map(row => (
                    <CashFlowRowBlock
                      key={row.id}
                      row={row}
                      monthId={month.id}
                      bankHeads={bankHeads}
                      editing={editingRows.has(row.id)}
                      expanded={openRows.has(row.id)}
                      onToggleEdit={() => toggleRow(row.id)}
                      onToggleExpand={() => toggleExpand(row.id)}
                      onUpdateRow={onUpdateRow}
                      onUpdateBank={onUpdateBank}
                      onRemoveRow={onRemoveRow}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className={theme.footer}>
                    <td colSpan={footerColSpan} className="px-4 py-3 text-right text-sm font-bold text-[#0F172A]">
                      Section Total
                    </td>
                    <td className="px-3 py-3 text-right font-extrabold text-[#B8112D] tabular-nums">{currency(sectionTotal)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
