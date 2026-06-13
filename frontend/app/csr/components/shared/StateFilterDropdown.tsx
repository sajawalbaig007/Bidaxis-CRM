"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, MapPin, Search, X } from "lucide-react";
import { US_STATES, CA_PROVINCES, STATE_AREA_CODES } from "../../constants/locations";

interface StateFilterDropdownProps {
  value: string;
  onChange: (v: string) => void;
}

export default function StateFilterDropdown({ value, onChange }: StateFilterDropdownProps) {
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredUSStates = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? US_STATES : US_STATES.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [search]);

  const filteredCAProvinces = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? CA_PROVINCES : CA_PROVINCES.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  }, [search]);

  const select = (name: string) => { onChange(name); setOpen(false); setSearch(""); };
  const clear  = () => { onChange(""); setSearch(""); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className={`h-10 sm:h-[42px] px-3 sm:px-4 rounded-xl sm:rounded-2xl border flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-medium transition-colors min-w-[160px] sm:min-w-[190px] ${
          value ? "border-[#B8112D] bg-[#FFF1F3] text-[#B8112D]" : "border-gray-200 bg-[#FAFAFA] text-gray-600 hover:border-gray-300"
        }`}
      >
        <MapPin size={12} className={`shrink-0 sm:w-[14px] sm:h-[14px] ${value ? "text-[#B8112D]" : "text-gray-400"}`} />
        <span className="flex-1 text-left truncate text-[12px] sm:text-[13px]">{value || "Filter by State / Province"}</span>
        {value ? (
          <span role="button" onClick={e => { e.stopPropagation(); clear(); }} className="ml-1 text-[#B8112D] hover:text-[#8b0d22] shrink-0">
            <X size={12} className="sm:w-[13px] sm:h-[13px]" />
          </span>
        ) : (
          <ChevronDown size={12} className="text-gray-400 shrink-0 sm:w-[13px] sm:h-[13px]" />
        )}
      </button>

      {open && (
        <div className="absolute top-11 sm:top-12 right-0 z-50 w-[240px] sm:w-[270px] bg-white rounded-xl sm:rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="p-2.5 sm:p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 sm:w-[13px] sm:h-[13px]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search states / provinces..."
                autoFocus
                className="w-full h-8 sm:h-9 rounded-lg sm:rounded-xl border border-gray-200 bg-[#FAFAFA] pl-7 sm:pl-8 pr-3 text-[12px] sm:text-[13px] outline-none focus:border-[#B8112D]"
              />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
            {filteredUSStates.length > 0 && (
              <>
                <div className="sticky top-0 px-3 py-1.5 bg-[#F8F9FC] border-b border-gray-100">
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">United States</p>
                </div>
                {filteredUSStates.map(s => (
                  <button key={s.code}
                    onClick={() => select(s.name)}
                    className={`w-full text-left px-3 sm:px-4 py-2 text-[12px] sm:text-[13px] flex flex-col transition-colors hover:bg-[#FFF1F3] ${
                      value === s.name ? "bg-[#FFF1F3] text-[#B8112D] font-semibold" : "text-[#0F172A]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{s.name}</span>
                      <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono ml-2">{s.code}</span>
                    </div>
                    {(STATE_AREA_CODES[s.name] ?? []).length > 0 && (
                      <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 mt-0.5 leading-relaxed">
                        {STATE_AREA_CODES[s.name].join(" · ")}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
            {filteredCAProvinces.length > 0 && (
              <>
                <div className="sticky top-0 px-3 py-1.5 bg-[#F8F9FC] border-b border-t border-gray-100">
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">Canada</p>
                </div>
                {filteredCAProvinces.map(p => (
                  <button key={p.code}
                    onClick={() => select(p.name)}
                    className={`w-full text-left px-3 sm:px-4 py-2 text-[12px] sm:text-[13px] flex flex-col transition-colors hover:bg-[#FFF1F3] ${
                      value === p.name ? "bg-[#FFF1F3] text-[#B8112D] font-semibold" : "text-[#0F172A]"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{p.name}</span>
                      <span className="text-[10px] sm:text-[11px] text-gray-400 font-mono ml-2">{p.code}</span>
                    </div>
                    {(STATE_AREA_CODES[p.name] ?? []).length > 0 && (
                      <span className="text-[9px] sm:text-[10px] font-mono text-gray-400 mt-0.5 leading-relaxed">
                        {STATE_AREA_CODES[p.name].join(" · ")}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
            {filteredUSStates.length === 0 && filteredCAProvinces.length === 0 && (
              <div className="py-6 sm:py-8 text-center text-gray-400 text-xs sm:text-sm">No results found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
