"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import { US_STATES, CA_PROVINCES } from "../../constants/locations";
import { useFixedPopover } from "../../hooks/useFixedPopover";

interface StateFilterDropdownProps {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
  fullWidth?: boolean;
}

type Country = "all" | "usa" | "canada";

export default function StateFilterDropdown({ value, onChange, compact = false, fullWidth = false }: StateFilterDropdownProps) {
  const [search,  setSearch]  = useState("");
  const [country, setCountry] = useState<Country>("all");
  const { open, setOpen, toggle, anchorRef, panelRef, style } = useFixedPopover(280, 300, "start");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  const filteredUSStates = useMemo(() => {
    if (country === "canada") return [];
    const q = search.toLowerCase();
    return !q ? US_STATES : US_STATES.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [search, country]);

  const filteredCAProvinces = useMemo(() => {
    if (country === "usa") return [];
    const q = search.toLowerCase();
    return !q ? CA_PROVINCES : CA_PROVINCES.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [search, country]);

  const select = (name: string) => { onChange(name); setOpen(false); setSearch(""); };
  const clear  = () => { onChange(""); setSearch(""); };

  const countryTabs: { key: Country; label: string; flag: string }[] = [
    { key: "all",    label: "All",    flag: "🌎" },
    { key: "usa",    label: "USA",    flag: "🇺🇸" },
    { key: "canada", label: "Canada", flag: "🇨🇦" },
  ];

  const panel = open && typeof document !== "undefined" ? createPortal(
    <div
      ref={panelRef}
      style={style}
      className="bg-white dark:bg-crm-surface rounded-xl border border-gray-100 dark:border-crm-border shadow-2xl overflow-hidden"
    >
      <div className="flex gap-1 p-1.5 border-b border-gray-100 dark:border-crm-border bg-[#FAFAFB] dark:bg-crm-surface-raised">
        {countryTabs.map(tab => (
          <button key={tab.key} type="button"
            onClick={() => { setCountry(tab.key); setSearch(""); }}
            className={`flex-1 h-7 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
              country === tab.key
                ? "bg-[#B8112D] text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <span>{tab.flag}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      <div className="p-1.5 border-b border-gray-100">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={
              country === "usa"    ? "Search US states…" :
              country === "canada" ? "Search provinces…" :
              "Search states / provinces…"
            }
            className="w-full h-8 rounded-lg border border-gray-200 bg-[#FAFAFA] pl-7 pr-2 text-[12px] outline-none focus:border-[#B8112D]"
          />
        </div>
      </div>
      <div className="overflow-y-auto max-h-[200px]">
        {filteredUSStates.length > 0 && (
          <>
            {country === "all" && (
              <div className="sticky top-0 px-3 py-1 bg-[#F8F9FC] border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">United States</p>
              </div>
            )}
            {filteredUSStates.map(s => (
              <button key={s.code} type="button"
                onClick={() => select(s.name)}
                className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between transition-colors hover:bg-[#FFF1F3] ${
                  value === s.name ? "bg-[#FFF1F3] text-[#B8112D] font-semibold" : "text-[#0F172A]"
                }`}
              >
                <span>{s.name}</span>
                <span className="text-[10px] text-gray-400 font-mono ml-2">{s.code}</span>
              </button>
            ))}
          </>
        )}
        {filteredCAProvinces.length > 0 && (
          <>
            {country === "all" && (
              <div className="sticky top-0 px-3 py-1 bg-[#F8F9FC] border-y border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Canada</p>
              </div>
            )}
            {filteredCAProvinces.map(p => (
              <button key={p.code} type="button"
                onClick={() => select(p.name)}
                className={`w-full text-left px-3 py-1.5 text-[12px] flex items-center justify-between transition-colors hover:bg-[#FFF1F3] ${
                  value === p.name ? "bg-[#FFF1F3] text-[#B8112D] font-semibold" : "text-[#0F172A]"
                }`}
              >
                <span>{p.name}</span>
                <span className="text-[10px] text-gray-400 font-mono ml-2">{p.code}</span>
              </button>
            ))}
          </>
        )}
        {filteredUSStates.length === 0 && filteredCAProvinces.length === 0 && (
          <div className="py-6 text-center text-gray-400 text-xs">No results found</div>
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
        className={`px-3 sm:px-4 rounded-xl sm:rounded-2xl border flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors ${fullWidth ? "h-10 sm:h-[42px] w-full min-w-0" : compact ? "h-10 sm:h-[42px] min-w-[140px] sm:min-w-[168px]" : "h-10 sm:h-[42px] min-w-[160px] sm:min-w-[200px]"} ${
          value
            ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]"
            : "border-gray-200 dark:border-crm-border bg-[#FAFAFA] dark:bg-crm-input text-gray-600 dark:text-crm-text-secondary hover:border-gray-300 dark:hover:border-crm-border"
        }`}
      >
        <MapPin size={12} className={`shrink-0 sm:w-[14px] sm:h-[14px] ${value ? "text-[#B8112D]" : "text-gray-400"}`} />
        <span className="flex-1 text-left truncate text-[12px] sm:text-[13px]">{value || (compact ? "State / Province" : "Filter by State / Province")}</span>
        {value ? (
          <span role="button" onClick={e => { e.stopPropagation(); clear(); }} className="ml-1 text-[#B8112D] hover:text-[#8b0d22] shrink-0">
            <X size={12} className="sm:w-[13px] sm:h-[13px]" />
          </span>
        ) : (
          <ChevronDown size={12} className="text-gray-400 shrink-0 sm:w-[13px] sm:h-[13px]" />
        )}
      </button>
      {panel}
    </div>
  );
}
