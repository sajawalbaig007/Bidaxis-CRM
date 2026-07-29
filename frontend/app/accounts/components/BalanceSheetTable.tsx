"use client";

import { Fragment, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { BalanceLineItem, BalanceSection } from "../types";
import { currency } from "../types";
import { TABLE_VARIANT, type AccountsTableVariant } from "./accountsTheme";
import { RowEditToggle } from "./ViewEditCell";

function sumItems(items: BalanceLineItem[]) {
  return items.reduce((a, i) => a + (Number(i.amount) || 0), 0);
}

type BalanceSheetTableProps = {
  variant: AccountsTableVariant;
  groupTitle: string;
  sections: BalanceSection[];
  grandLabel?: string;
  onUpdateSectionTitle: (sectionId: string, title: string) => void;
  onUpdateItem: (sectionId: string, itemId: string, key: keyof BalanceLineItem, value: string | number) => void;
  onDeleteItem: (sectionId: string, itemId: string) => void;
  onAddItem: (sectionId: string) => void;
  onAddSection: () => void;
};

function BalanceLineRow({
  item,
  sectionId,
  variant,
  editing,
  onUpdateItem,
  onDeleteItem,
}: {
  item: BalanceLineItem;
  sectionId: string;
  variant: AccountsTableVariant;
  editing: boolean;
  onUpdateItem: (sectionId: string, itemId: string, key: keyof BalanceLineItem, value: string | number) => void;
  onDeleteItem: (sectionId: string, itemId: string) => void;
}) {
  const theme = TABLE_VARIANT[variant];
  const inputCls = theme.input;

  if (editing) {
    return (
      <tr className={`border-b border-gray-100/80 ${theme.rowHover}`}>
        <td className="px-4 py-2">
          <input
            value={item.label}
            onChange={e => onUpdateItem(sectionId, item.id, "label", e.target.value)}
            className={`h-9 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:ring-2 ${inputCls}`}
          />
        </td>
        <td className="px-3 py-2 w-[88px]">
          <input
            value={item.note ?? ""}
            onChange={e => onUpdateItem(sectionId, item.id, "note", e.target.value)}
            className={`h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-center outline-none focus:ring-2 ${inputCls}`}
          />
        </td>
        <td className="px-3 py-2 w-[140px]">
          <input
            type="number"
            value={item.amount}
            onChange={e => onUpdateItem(sectionId, item.id, "amount", Number(e.target.value || 0))}
            className={`h-9 w-full rounded-lg border border-gray-200 px-2 text-sm text-right font-semibold outline-none focus:ring-2 ${inputCls}`}
          />
        </td>
        <td className="px-2 py-2 w-10">
          <button type="button" onClick={() => onDeleteItem(sectionId, item.id)} className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center mx-auto">
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className={`border-b border-gray-100/80 ${theme.rowHover}`}>
      <td className="px-4 py-2.5 text-sm text-[#334155]">{item.label}</td>
      <td className="px-3 py-2.5 text-center text-sm text-gray-500">{item.note || "—"}</td>
      <td className="px-3 py-2.5 text-right text-sm font-semibold text-[#0F172A] tabular-nums">{currency(item.amount)}</td>
      <td className="w-10" />
    </tr>
  );
}

export default function BalanceSheetTable({
  variant,
  groupTitle,
  sections,
  grandLabel,
  onUpdateSectionTitle,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onAddSection,
}: BalanceSheetTableProps) {
  const theme = TABLE_VARIANT[variant];
  const [editingSections, setEditingSections] = useState<Set<string>>(new Set());
  const grandTotal = sections.reduce((a, s) => a + sumItems(s.items), 0);

  const toggleSectionEdit = (id: string) => {
    setEditingSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={`bg-white rounded-2xl border-2 overflow-hidden ${theme.card}`}>
      <div className={`px-4 sm:px-5 py-3.5 border-b ${theme.header}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className={`text-sm sm:text-base font-extrabold tracking-tight ${theme.headerText}`}>
            {groupTitle}
          </h2>
          <button
            type="button"
            onClick={onAddSection}
            className="h-8 px-3 rounded-lg text-[11px] font-bold text-white inline-flex items-center gap-1 shadow-sm"
            style={{ backgroundColor: theme.accent }}
          >
            <Plus size={13} />
            Add Section
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[520px]">
        <table className="w-full text-sm min-w-[520px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-gray-200/80 bg-[#FAFBFC]">
              <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">Particulars</th>
              <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500 w-[88px]">Note</th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500 w-[140px]">Amount</th>
              <th className="w-20 px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-gray-500">Edit</th>
            </tr>
          </thead>
          <tbody>
            {sections.map(section => {
              const editing = editingSections.has(section.id);
              return (
                <Fragment key={section.id}>
                  <tr className="bg-[#FAFAFA]/90 border-y border-gray-200/60">
                    <td colSpan={2} className="px-4 py-2">
                      {editing ? (
                        <input
                          value={section.title}
                          onChange={e => onUpdateSectionTitle(section.id, e.target.value)}
                          className={`h-9 w-full max-w-md rounded-lg border border-gray-200 px-3 text-sm font-bold outline-none focus:ring-2 ${theme.input}`}
                        />
                      ) : (
                        <span className="font-bold text-[#0F172A] text-sm">{section.title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-[#475569] tabular-nums">
                      {currency(sumItems(section.items))}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <RowEditToggle editing={editing} onToggle={() => toggleSectionEdit(section.id)} />
                        {editing && (
                          <button
                            type="button"
                            onClick={() => onAddItem(section.id)}
                            className="w-8 h-8 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center"
                            title="Add line"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {section.items.map(item => (
                    <BalanceLineRow
                      key={item.id}
                      item={item}
                      sectionId={section.id}
                      variant={variant}
                      editing={editing}
                      onUpdateItem={onUpdateItem}
                      onDeleteItem={onDeleteItem}
                    />
                  ))}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className={theme.footer}>
              <td colSpan={2} className="px-4 py-3 font-extrabold text-[#0F172A]">
                {grandLabel ?? "Total"}
              </td>
              <td className="px-3 py-3 text-right font-extrabold text-[#0F172A] tabular-nums text-base">
                {currency(grandTotal)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export { sumItems };
