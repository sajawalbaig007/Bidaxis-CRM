"use client";

import { Fragment, useState } from "react";
import { Plus, Trash2, Landmark, CalendarDays, StickyNote } from "lucide-react";
import type { CashFlowMonth, CashFlowRow, DatedNote } from "../types";
import { currency, newRowId, normalizeNotes, todayIso } from "../types";
import { TABLE_VARIANT, bankColor } from "./accountsTheme";
import AccountsNotesCell from "./AccountsNotesCell";
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

function NotesEditor({
  notes,
  onChange,
}: {
  notes: DatedNote[];
  onChange: (next: DatedNote[]) => void;
}) {
  const sorted = [...notes].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="rounded-xl border border-amber-100 overflow-hidden bg-white min-w-[180px]">
      <div className="px-2 py-1 bg-amber-50/80 text-[10px] font-bold uppercase text-amber-800 border-b border-amber-100 flex items-center justify-between gap-1">
        <span className="inline-flex items-center gap-1"><StickyNote size={11} /> Notes</span>
        <button
          type="button"
          onClick={() => onChange([{ id: newRowId("n"), text: "", date: todayIso() }, ...notes])}
          className="text-[10px] font-bold text-amber-700 normal-case tracking-normal inline-flex items-center gap-0.5"
        >
          <Plus size={11} /> Add
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-[11px] text-gray-400 px-2 py-2">No notes yet.</p>
      ) : (
        <div className="p-1.5 space-y-1.5 max-h-40 overflow-y-auto">
          {sorted.map(n => (
            <div key={n.id} className="rounded-lg border border-amber-100 bg-amber-50/40 p-1.5 space-y-1">
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={n.date}
                  onChange={e => onChange(notes.map(x => (x.id === n.id ? { ...x, date: e.target.value } : x)))}
                  className="h-7 flex-1 rounded border border-amber-200 bg-white px-1 text-[10px]"
                />
                <button
                  type="button"
                  onClick={() => onChange(notes.filter(x => x.id !== n.id))}
                  className="text-red-500 w-6 h-6 inline-flex items-center justify-center"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <textarea
                value={n.text}
                onChange={e => onChange(notes.map(x => (x.id === n.id ? { ...x, text: e.target.value } : x)))}
                rows={2}
                placeholder="Write note…"
                className="w-full rounded border border-amber-200 bg-white px-1.5 py-1 text-[11px] outline-none resize-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CashFlowRowBlock({
  row,
  monthId,
  bankHeads,
  editing,
  onToggleEdit,
  onUpdateRow,
  onUpdateBank,
  onRemoveRow,
}: {
  row: CashFlowRow;
  monthId: string;
  bankHeads: string[];
  editing: boolean;
  onToggleEdit: () => void;
  onUpdateRow: CashFlowTableProps["onUpdateRow"];
  onUpdateBank: CashFlowTableProps["onUpdateBank"];
  onRemoveRow: CashFlowTableProps["onRemoveRow"];
}) {
  const theme = TABLE_VARIANT.cashflow;
  const net = computedNet(row);
  const isAutoNet = bankActivity(row);
  const inputCls = `h-8 w-full min-w-0 rounded-lg border border-gray-200 px-2 text-xs outline-none focus:ring-2 ${theme.input}`;
  const notes = normalizeNotes(row.notes, undefined, row.date);

  return (
    <tr className={`border-b border-gray-100 ${theme.rowHover} transition-colors`}>
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
      <td className="px-2 py-2 align-top">
        {editing ? (
          <NotesEditor notes={notes} onChange={next => onUpdateRow(monthId, row.id, { notes: next })} />
        ) : (
          <AccountsNotesCell notes={row.notes} fallbackDate={row.date} />
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

  const toggleRow = (rowId: string) => {
    setEditingRows(prev => {
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

  const footerColSpan = 3 + bankHeads.length * 2;

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
              <table className="w-full text-sm" style={{ minWidth: `${780 + bankHeads.length * 128}px` }}>
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-200 bg-[#FAFBFC]">
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
                    <th className="px-2 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 min-w-[160px]">Notes</th>
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
                      onToggleEdit={() => toggleRow(row.id)}
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
