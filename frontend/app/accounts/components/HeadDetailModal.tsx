"use client";

import { Trash2, X } from "lucide-react";
import type { SubHeadEntry } from "../types";
import { currency, newRowId, todayIso } from "../types";

export type HeadDetailModel = {
  id: string;
  title: string;
  amount: number;
  filledAt?: string;
  note?: string;
  subHeads: SubHeadEntry[];
};

type HeadDetailModalProps = {
  open: boolean;
  title: string;
  value: HeadDetailModel | null;
  onClose: () => void;
  onSave: (next: HeadDetailModel) => void;
  onDelete: () => void;
};

export default function HeadDetailModal({
  open,
  title,
  value,
  onClose,
  onSave,
  onDelete,
}: HeadDetailModalProps) {
  if (!open || !value) return null;

  const setField = <K extends keyof HeadDetailModel>(key: K, val: HeadDetailModel[K]) => {
    onSave({ ...value, [key]: val });
  };

  const updateSub = (id: string, patch: Partial<SubHeadEntry>) => {
    onSave({
      ...value,
      subHeads: value.subHeads.map(s => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const addSub = () => {
    onSave({
      ...value,
      subHeads: [
        ...value.subHeads,
        { id: newRowId("sub"), label: "New sub-head", amount: 0, filledAt: todayIso() },
      ],
    });
  };

  const removeSub = (id: string) => {
    onSave({ ...value, subHeads: value.subHeads.filter(s => s.id !== id) });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b bg-[#F8FAFC] flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <label className="text-xs font-semibold text-gray-600 block">
            Title
            <input
              value={value.title}
              onChange={e => setField("title", e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-gray-600 block">
              Total (override if no sub-heads)
              <input
                type="number"
                value={value.amount}
                onChange={e => setField("amount", Number(e.target.value || 0))}
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
              />
            </label>
            <label className="text-xs font-semibold text-gray-600 block">
              Filled date
              <input
                type="date"
                value={value.filledAt ?? todayIso()}
                onChange={e => setField("filledAt", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
              />
            </label>
          </div>

          {value.note !== undefined && (
            <label className="text-xs font-semibold text-gray-600 block">
              Note ref
              <input
                value={value.note ?? ""}
                onChange={e => setField("note", e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30"
              />
            </label>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700">Individual sub-heads</p>
              <button type="button" onClick={addSub} className="text-[11px] font-bold text-[#0B84F3]">
                + Add sub-head
              </button>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {value.subHeads.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-3 text-center border border-dashed rounded-xl">
                  No sub-heads — total uses the amount above.
                </p>
              ) : (
                value.subHeads.map(s => (
                  <div key={s.id} className="grid grid-cols-12 gap-1.5 items-center bg-[#F8FAFC] rounded-xl p-2 border border-gray-100">
                    <input
                      value={s.label}
                      onChange={e => updateSub(s.id, { label: e.target.value })}
                      className="col-span-5 h-8 rounded-lg border border-gray-200 px-2 text-xs"
                      placeholder="Label"
                    />
                    <input
                      type="number"
                      value={s.amount}
                      onChange={e => updateSub(s.id, { amount: Number(e.target.value || 0) })}
                      className="col-span-3 h-8 rounded-lg border border-gray-200 px-2 text-xs text-right"
                    />
                    <input
                      type="date"
                      value={s.filledAt}
                      onChange={e => updateSub(s.id, { filledAt: e.target.value })}
                      className="col-span-3 h-8 rounded-lg border border-gray-200 px-1 text-[10px]"
                    />
                    <button type="button" onClick={() => removeSub(s.id)} className="col-span-1 text-red-500 flex justify-center">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
            {value.subHeads.length > 0 && (
              <p className="text-[11px] text-gray-500 mt-2 font-semibold">
                Sub-heads sum: {currency(value.subHeads.reduce((a, s) => a + (Number(s.amount) || 0), 0))}
              </p>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between gap-2 bg-[#FAFAFA]">
          <button
            type="button"
            onClick={() => { onDelete(); onClose(); }}
            className="h-9 px-3 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-bold bg-[#B8112D] text-white hover:bg-[#9a0e26]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
