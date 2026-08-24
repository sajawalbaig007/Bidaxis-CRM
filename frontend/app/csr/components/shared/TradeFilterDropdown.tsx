"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Hammer, Search, X } from "lucide-react";

interface TradeFilterDropdownProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  compact?: boolean;
}

export default function TradeFilterDropdown({
  value,
  options,
  onChange,
  compact = false,
}: TradeFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, search]);

  const select = (name: string) => {
    onChange(name);
    setOpen(false);
    setSearch("");
  };

  const clear = () => {
    onChange("");
    setSearch("");
  };

  return (
    <div className="relative z-30" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`h-10 sm:h-[42px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors ${compact ? "min-w-[110px] sm:min-w-[140px]" : "min-w-[130px] sm:min-w-[168px]"} ${
          value
            ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
            : "border-gray-200 dark:border-crm-border bg-[#FAFAFA] dark:bg-crm-input text-gray-600 dark:text-crm-text-secondary hover:border-gray-300"
        }`}
        title="Filter by trade"
      >
        <Hammer size={12} className={`shrink-0 sm:w-[14px] sm:h-[14px] ${value ? "text-[#B8112D]" : "text-gray-400"}`} />
        <span className={`truncate ${compact ? "max-w-[72px] sm:max-w-[110px]" : "max-w-[100px] sm:max-w-[130px]"}`}>
          {value || (compact ? "Trades" : "All Trades")}
        </span>
        {value ? (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); clear(); }}
            className="ml-auto text-[#B8112D] hover:text-[#8b0d22] shrink-0"
          >
            <X size={12} className="sm:w-[13px] sm:h-[13px]" />
          </span>
        ) : (
          <ChevronDown size={12} className="text-gray-400 shrink-0 ml-auto sm:w-[13px] sm:h-[13px]" />
        )}
      </button>

      {open && (
        <div className="absolute top-11 sm:top-12 right-0 z-[200] w-[240px] sm:w-[280px] bg-white dark:bg-crm-surface rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 dark:border-crm-border overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-crm-border-subtle">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search trades…"
                className="w-full h-8 pl-8 pr-2 rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-crm-input text-xs outline-none focus:border-[#B8112D]"
              />
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => select("")}
              className={`w-full text-left px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] font-semibold transition-colors hover:bg-[#FFF1F3] ${
                !value ? "bg-[#FFF1F3] text-[#B8112D]" : "text-[#0F172A] dark:text-crm-text"
              }`}
            >
              All Trades
            </button>
            {options.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No trades on your leads</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No match</p>
            ) : (
              filtered.map(name => (
                <button
                  key={name}
                  type="button"
                  onClick={() => select(name)}
                  className={`w-full text-left px-3 sm:px-4 py-2.5 text-[12px] sm:text-[13px] font-semibold transition-colors hover:bg-[#FFF1F3] truncate ${
                    value === name ? "bg-[#FFF1F3] text-[#B8112D]" : "text-[#0F172A] dark:text-crm-text"
                  }`}
                >
                  {name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
