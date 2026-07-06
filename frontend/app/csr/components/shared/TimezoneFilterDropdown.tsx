"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Clock, X } from "lucide-react";
import { TIMEZONE_FILTER_OPTIONS, tzBadgeClass } from "../../constants/timezoneAbbr";

interface TimezoneFilterDropdownProps {
  value: string;
  onChange: (v: string) => void;
}

export default function TimezoneFilterDropdown({ value, onChange }: TimezoneFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = TIMEZONE_FILTER_OPTIONS.find(o => o.abbr === value);

  const select = (abbr: string) => {
    onChange(abbr);
    setOpen(false);
  };

  const clear = () => onChange("");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`h-10 sm:h-[42px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors min-w-[150px] sm:min-w-[190px] ${
          value
            ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
            : "border-gray-200 dark:border-crm-border bg-[#FAFAFA] dark:bg-crm-input text-gray-600 dark:text-crm-text-secondary hover:border-gray-300 dark:hover:border-crm-border"
        }`}
      >
        <Clock size={12} className={`shrink-0 sm:w-[14px] sm:h-[14px] ${value ? "text-[#B8112D]" : "text-gray-400"}`} />
        <span className="flex-1 text-left truncate text-[12px] sm:text-[13px]">
          {selected ? `${selected.abbr} · ${selected.label}` : "Phone TZ (ET/CT/MT/PT)"}
        </span>
        {value ? (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); clear(); }}
            className="ml-1 text-[#B8112D] hover:text-[#8b0d22] shrink-0"
          >
            <X size={12} className="sm:w-[13px] sm:h-[13px]" />
          </span>
        ) : (
          <ChevronDown size={12} className="text-gray-400 shrink-0 sm:w-[13px] sm:h-[13px]" />
        )}
      </button>

      {open && (
        <div className="absolute top-11 sm:top-12 right-0 z-[120] w-[240px] sm:w-[270px] bg-white dark:bg-crm-surface rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 dark:border-crm-border overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-crm-border bg-[#FAFAFB] dark:bg-crm-surface-raised">
            <p className="text-[10px] font-bold text-gray-400 dark:text-crm-text-muted uppercase tracking-wider">Phone area code → timezone</p>
          </div>
          <div className="py-1">
            {TIMEZONE_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.abbr}
                type="button"
                onClick={() => select(opt.abbr)}
                className={`w-full text-left px-3 sm:px-4 py-2.5 flex items-start gap-2.5 transition-colors hover:bg-[#FFF1F3] dark:hover:bg-crm-brand-soft ${
                  value === opt.abbr ? "bg-[#FFF1F3] dark:bg-crm-brand-soft" : ""
                }`}
              >
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold border shrink-0 mt-0.5 ${tzBadgeClass(opt.abbr)}`}>
                  {opt.abbr}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[12px] sm:text-[13px] font-semibold ${value === opt.abbr ? "text-[#B8112D]" : "text-[#0F172A] dark:text-crm-text"}`}>
                    {opt.label}
                  </span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">{opt.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
