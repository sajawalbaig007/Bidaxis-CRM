"use client";

import { Trash2, X, Plus, StickyNote } from "lucide-react";
import type { DatedNote, SubHeadEntry } from "../types";
import { currency, newRowId, sumSubHeads, todayIso } from "../types";

export type HeadDetailModel = {
  id: string;
  title: string;
  amount: number;
  filledAt?: string;
  note?: string;
  subHeads: SubHeadEntry[];
  notes: DatedNote[];
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
    const subHeads = value.subHeads.map(s => (s.id === id ? { ...s, ...patch } : s));
    onSave({
      ...value,
      subHeads,
      amount: sumSubHeads(subHeads),
    });
  };

  const addSub = () => {
    const subHeads = [
      ...value.subHeads,
      { id: newRowId("sub"), label: "New person / line", amount: 0, filledAt: todayIso() },
    ];
    onSave({
      ...value,
      subHeads,
      amount: sumSubHeads(subHeads),
    });
  };

  const removeSub = (id: string) => {
    const subHeads = value.subHeads.filter(s => s.id !== id);
    onSave({
      ...value,
      subHeads,
      amount: subHeads.length > 0 ? sumSubHeads(subHeads) : value.amount,
    });
  };

  const addNote = () => {
    onSave({
      ...value,
      notes: [
        { id: newRowId("note"), text: "", date: todayIso() },
        ...value.notes,
      ],
    });
  };

  const updateNote = (id: string, patch: Partial<DatedNote>) => {
    onSave({
      ...value,
      notes: value.notes.map(n => (n.id === id ? { ...n, ...patch } : n)),
    });
  };

  const removeNote = (id: string) => {
    onSave({ ...value, notes: value.notes.filter(n => n.id !== id) });
  };

  const sortedNotes = [...value.notes].sort((a, b) => b.date.localeCompare(a.date));

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

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
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
              {value.subHeads.length > 0 ? "Total (auto from people / lines)" : "Total (add people/lines or set here)"}
              <input
                type="number"
                value={value.subHeads.length > 0 ? sumSubHeads(value.subHeads) : value.amount}
                readOnly={value.subHeads.length > 0}
                onChange={e => {
                  if (value.subHeads.length > 0) return;
                  setField("amount", Number(e.target.value || 0));
                }}
                className={`mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30 ${
                  value.subHeads.length > 0 ? "bg-[#F8FAFC] text-gray-600 cursor-default" : ""
                }`}
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

          {/* Notes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700 inline-flex items-center gap-1.5">
                <StickyNote size={13} className="text-amber-500" /> Notes (by date)
              </p>
              <button type="button" onClick={addNote} className="text-[11px] font-bold text-amber-700 inline-flex items-center gap-1">
                <Plus size={12} /> Add note
              </button>
            </div>
            <div className="space-y-2 max-h-44 overflow-y-auto">
              {sortedNotes.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-3 text-center border border-dashed border-amber-200 rounded-xl bg-amber-50/40">
                  No notes yet — add one with a date.
                </p>
              ) : (
                sortedNotes.map(n => (
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
                ))
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700">People / line items</p>
              <button type="button" onClick={addSub} className="text-[11px] font-bold text-[#0B84F3]">
                + Add person / line
              </button>
            </div>
            <div className="space-y-2 max-h-52 overflow-y-auto">
              {value.subHeads.length === 0 ? (
                <p className="text-[11px] text-gray-400 py-3 text-center border border-dashed rounded-xl">
                  No people/lines yet — total uses the amount above.
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
