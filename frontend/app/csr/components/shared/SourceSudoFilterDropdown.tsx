"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, FileInput, Search, X } from "lucide-react";
import { useFixedPopover } from "../../hooks/useFixedPopover";

interface SourceSudoFilterDropdownProps {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  compact?: boolean;
  fullWidth?: boolean;
}

export default function SourceSudoFilterDropdown({
  value,
  options,
  onChange,
  compact = false,
  fullWidth = false,
}: SourceSudoFilterDropdownProps) {
  const { open, setOpen, toggle, anchorRef, panelRef, style } = useFixedPopover(280, 320, "start");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
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

  const panel = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={panelRef}
      style={style}
      className="bg-white dark:bg-crm-surface rounded-xl border border-gray-100 dark:border-crm-border-subtle shadow-2xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-gray-100 dark:border-crm-border-subtle bg-[#FAFAFB] dark:bg-crm-muted">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Upload source sudo</p>
      </div>
      <div className="p-2 border-b border-gray-100 dark:border-crm-border-subtle">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search source…"
            className="w-full h-8 pl-8 pr-2 rounded-lg border border-gray-200 dark:border-crm-border bg-white dark:bg-crm-input text-xs outline-none focus:border-[#0F398A]"
          />
        </div>
      </div>
      <div className="max-h-[200px] overflow-y-auto py-1">
        {options.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No source sudo on your leads</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-gray-400 text-center">No match</p>
        ) : (
          filtered.map(name => (
            <button
              key={name}
              type="button"
              onClick={() => select(name)}
              className={`w-full text-left px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-[#EFF6FF] truncate ${
                value === name ? "bg-[#EFF6FF] text-[#0F398A]" : "text-[#0F172A] dark:text-crm-text"
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
        className={`h-10 sm:h-[42px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 transition-colors ${fullWidth ? "w-full min-w-0" : compact ? "min-w-[110px] sm:min-w-[132px]" : "min-w-[130px] sm:min-w-[160px]"} ${
          value
            ? "border-[#0F398A] bg-[#EFF6FF] text-[#0F398A]"
            : "border-gray-200 dark:border-crm-border bg-[#FAFAFA] dark:bg-crm-input text-gray-600 dark:text-crm-text-secondary hover:border-gray-300 dark:hover:border-crm-border"
        }`}
      >
        <FileInput size={12} className="shrink-0 sm:w-[14px] sm:h-[14px]" />
        <span className={`truncate ${fullWidth ? "flex-1 text-left" : compact ? "max-w-[72px] sm:max-w-[96px]" : "max-w-[100px] sm:max-w-[120px]"}`}>
          {value || (compact ? "Source" : "Source (sudo)")}
        </span>
        {value ? (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); clear(); }}
            className="ml-auto text-[#0F398A] hover:text-[#8b0d22] shrink-0"
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
