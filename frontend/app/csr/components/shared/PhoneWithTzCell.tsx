"use client";

import { useEffect, useRef, useState } from "react";
import { getTimezoneAbbrFromPhone, tzBadgeClass } from "../../constants/timezoneAbbr";

interface PhoneWithTzCellProps {
  phone: string;
  /** All numbers for this lead — enables +N click popup */
  allPhones?: string[];
  /** Additional phone count (used if allPhones not passed) */
  extraCount?: number;
  /** Pill style (potential/clients) vs plain (main table) */
  variant?: "plain" | "pill";
  className?: string;
}

/** Phone number + area-code timezone badge (company TZ stays on client name). */
export default function PhoneWithTzCell({
  phone,
  allPhones,
  extraCount = 0,
  variant = "plain",
  className = "",
}: PhoneWithTzCellProps) {
  const phones = (allPhones && allPhones.length > 0 ? allPhones : [phone]).filter(Boolean);
  const primary = phones[0] ?? phone;
  const extras = phones.length > 1 ? phones.length - 1 : extraCount;
  const canOpen = phones.length > 1;

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tz = getTimezoneAbbrFromPhone(primary);

  const chip = (
    <>
      <span className={variant === "pill" || extras > 0 ? "truncate max-w-[100px]" : undefined}>{primary}</span>
      {tz && (
        <span
          title="Phone area code timezone"
          className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}
        >
          {tz}
        </span>
      )}
      {extras > 0 && (
        <span className="bg-[#B8112D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
          +{extras}
        </span>
      )}
    </>
  );

  const shellClass =
    variant === "pill" || extras > 0
      ? `inline-flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap min-w-0 max-w-full ${className}`
      : `flex items-center gap-1.5 min-w-0 whitespace-nowrap ${className}`;

  if (!canOpen) {
    return <div className={shellClass}>{chip}</div>;
  }

  return (
    <div className="relative inline-flex min-w-0 max-w-full" ref={rootRef}>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setOpen(v => !v);
        }}
        className={`${shellClass} cursor-pointer hover:opacity-90 transition-opacity`}
        title="Show all phone numbers"
        aria-expanded={open}
      >
        {chip}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 min-w-[190px] max-w-[260px]"
          onClick={e => e.stopPropagation()}
        >
          {phones.map((ph, idx) => {
            const pt = getTimezoneAbbrFromPhone(ph);
            return (
              <div
                key={`${ph}-${idx}`}
                className="flex items-center gap-2 px-3 py-2 text-xs text-[#B8112D] font-medium hover:bg-[#FFF6F7]"
              >
                <span className="text-gray-300 text-[10px] shrink-0">{idx + 1}.</span>
                <span className="truncate">{ph}</span>
                {pt && (
                  <span className={`ml-auto inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${tzBadgeClass(pt)}`}>
                    {pt}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
