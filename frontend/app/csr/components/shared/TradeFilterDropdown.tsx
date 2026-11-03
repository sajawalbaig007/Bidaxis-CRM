"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Hammer, Search, X } from "lucide-react";
import { tradeMatchesQuery } from "../../constants/masterFormatTrades";
import { useFixedPopover } from "../../hooks/useFixedPopover";

interface TradeFilterDropdownProps {
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
  compact?: boolean;
  fullWidth?: boolean;
}

export default function TradeFilterDropdown({
  value,
  options,
  onChange,
  compact = false,
  fullWidth = false,
}: TradeFilterDropdownProps) {
  const { open, setOpen, toggle, anchorRef, panelRef, style } = useFixedPopover(300, 320, "end");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return options;
    return options.filter(name => tradeMatchesQuery(name, q));
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

  const panel = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={panelRef}
      style={style}
      className="bg-white dark:bg-crm-surface rounded-xl sm:rounded-2xl border border-gray-100 dark:border-crm-border shadow-2xl overflow-hidden"
    >
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
      <div className="max-h-[280px] overflow-y-auto py-1">
        <button
          type="button"
          onClick={() => select("")}
          className={`w-full text-left px-3 py-2 text-[12px] sm:text-[13px] font-semibold transition-colors hover:bg-[#FFF1F3] ${
            !value ? "bg-[#FFF1F3] text-[#B8112D]" : "text-[#0F172A] dark:text-crm-text"
          }`}
        >
          All Trades
        </button>
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No match</p>
        ) : (
          filtered.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => select(name)}
              className={`w-full text-left px-3 py-2 text-[12px] sm:text-[13px] font-medium leading-snug transition-colors hover:bg-[#FFF1F3] ${
                value === name ? "bg-[#FFF1F3] text-[#B8112D]" : "text-[#0F172A] dark:text-crm-text"
              }`}
            >
              {name}
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={fullWidth ? "w-full min-w-0" : ""}>
      <button
        ref={anchorRef}
        type="button"
        onClick={toggle}
        className={`h-10 sm:h-[42px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors ${fullWidth ? "w-full min-w-0" : compact ? "min-w-[110px] sm:min-w-[140px]" : "min-w-[130px] sm:min-w-[168px]"} ${
          value
            ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
            : "border-gray-200 dark:border-crm-border bg-[#FAFAFA] dark:bg-crm-input text-gray-600 dark:text-crm-text-secondary hover:border-gray-300"
        }`}
        title="Filter by trade"
      >
        <Hammer size={12} className={`shrink-0 sm:w-[14px] sm:h-[14px] ${value ? "text-[#B8112D]" : "text-gray-400"}`} />
        <span className={`truncate ${fullWidth ? "flex-1 text-left" : compact ? "max-w-[72px] sm:max-w-[110px]" : "max-w-[100px] sm:max-w-[130px]"}`}>
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
      {panel}
    </div>
  );
}
