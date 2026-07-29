"use client";

import { X } from "lucide-react";
import type { CurrencyTabKey, DashboardCurrencyTab } from "../types";
import { CURRENCY_TAB_LABELS, currency } from "../types";

type CurrencyFormulaModalProps = {
  open: boolean;
  tab: CurrencyTabKey;
  value: DashboardCurrencyTab;
  onClose: () => void;
  onChange: (key: keyof DashboardCurrencyTab, val: number) => void;
};

function calc(t: DashboardCurrencyTab) {
  const usdAfterTax = t.usdAmount * t.usdTaxFactor;
  const cadAfterTax = t.cadAmount * t.cadTaxFactor;
  const usdInPkr = usdAfterTax * t.usdToPkrRate;
  const cadInPkr = cadAfterTax * t.cadToPkrRate;
  return { usdAfterTax, cadAfterTax, usdInPkr, cadInPkr, total: usdInPkr + cadInPkr + t.pkrAmount };
}

const FIELDS: { label: string; key: keyof DashboardCurrencyTab; step: string; readOnly?: boolean }[] = [
  { label: "USD Payment (actual cash)", key: "usdAmount", step: "1" },
  { label: "USD Tax Factor", key: "usdTaxFactor", step: "0.001", readOnly: true },
  { label: "USD to PKR Rate", key: "usdToPkrRate", step: "1" },
  { label: "CAD Payment (actual cash)", key: "cadAmount", step: "1" },
  { label: "CAD Tax Factor", key: "cadTaxFactor", step: "0.001", readOnly: true },
  { label: "CAD to PKR Rate", key: "cadToPkrRate", step: "1" },
  { label: "Direct PKR Payment", key: "pkrAmount", step: "1" },
];

export default function CurrencyFormulaModal({
  open,
  tab,
  value,
  onClose,
  onChange,
}: CurrencyFormulaModalProps) {
  if (!open) return null;
  const c = calc(value);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b bg-[#F8FAFC] flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-sm">Edit currency formula — {CURRENCY_TAB_LABELS[tab]}</h3>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FIELDS.map(({ label, key, step, readOnly }) => (
              <label key={key} className={`text-xs font-semibold text-gray-600 ${key === "pkrAmount" ? "sm:col-span-2" : ""}`}>
                {label}{readOnly ? " (fixed)" : ""}
                <input
                  type="number"
                  step={step}
                  value={value[key]}
                  readOnly={readOnly}
                  onChange={e => {
                    if (readOnly) return;
                    onChange(key, Number(e.target.value || 0));
                  }}
                  className={`mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:ring-2 focus:ring-[#B8112D]/30 ${
                    readOnly ? "bg-[#F8FAFC] text-gray-500 cursor-default" : ""
                  }`}
                />
              </label>
            ))}
          </div>

          <div className="rounded-2xl border border-dashed border-gray-200 bg-[#F8FAFC] p-3.5 text-[11px] text-gray-600 space-y-1.5 font-mono">
            <p>USD After Tax = {currency(value.usdAmount)} × {value.usdTaxFactor} = <span className="font-bold text-gray-800">{currency(c.usdAfterTax)}</span></p>
            <p>USD → PKR = {currency(c.usdAfterTax)} × {value.usdToPkrRate} = <span className="font-bold text-gray-800">{currency(c.usdInPkr)}</span></p>
            <p className="pt-1">CAD After Tax = {currency(value.cadAmount)} × {value.cadTaxFactor} = <span className="font-bold text-gray-800">{currency(c.cadAfterTax)}</span></p>
            <p>CAD → PKR = {currency(c.cadAfterTax)} × {value.cadToPkrRate} = <span className="font-bold text-gray-800">{currency(c.cadInPkr)}</span></p>
            <p className="pt-1 font-bold text-[#B8112D]">Total = {currency(c.total)}</p>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex justify-end bg-[#FAFAFA]">
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
