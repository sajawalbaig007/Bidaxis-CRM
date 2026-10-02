"use client";

import { createPortal } from "react-dom";
import { Phone } from "lucide-react";
import { getTimezoneAbbrFromPhone, tzBadgeClass } from "../../constants/timezoneAbbr";
import { useFixedPopover } from "../../hooks/useFixedPopover";

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

  const { open, toggle, anchorRef, panelRef, style } = useFixedPopover(260, 160);

  const tz = getTimezoneAbbrFromPhone(primary);

  const chip = (
    <>
      <Phone size={18} className="text-[#B8112D] shrink-0" aria-hidden />
      <span className={extras > 0 ? "truncate min-w-0 max-w-[72px] sm:max-w-[96px]" : "truncate min-w-0"}>
        {primary}
      </span>
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
    variant === "pill"
      ? `inline-flex items-center gap-1 flex-nowrap bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium min-w-0 max-w-full overflow-visible ${className}`
      : `inline-flex items-center gap-1.5 flex-nowrap min-w-0 max-w-full overflow-visible ${className}`;

  const popup =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={style}
        className="bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 min-w-[190px] max-w-[260px]"
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
      </div>,
      document.body,
    );

  if (!canOpen) {
    return <div className={shellClass}>{chip}</div>;
  }

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={e => {
          e.stopPropagation();
          toggle();
        }}
        className={`${shellClass} cursor-pointer hover:opacity-90 transition-opacity`}
        title="Show all phone numbers"
        aria-expanded={open}
      >
        {chip}
      </button>
      {typeof document !== "undefined" && popup}
    </>
  );
}
