"use client";

import { getTimezoneAbbrFromPhone, tzBadgeClass } from "../../constants/timezoneAbbr";

interface PhoneWithTzCellProps {
  phone: string;
  /** Additional phone numbers (shows +N chip) */
  extraCount?: number;
  /** Pill style (potential/clients) vs plain (main table) */
  variant?: "plain" | "pill";
  className?: string;
}

/** Phone number + area-code timezone badge (company TZ stays on client name). */
export default function PhoneWithTzCell({
  phone,
  extraCount = 0,
  variant = "plain",
  className = "",
}: PhoneWithTzCellProps) {
  const tz = getTimezoneAbbrFromPhone(phone);

  const content = (
    <>
      <span className={variant === "pill" || extraCount > 0 ? "truncate max-w-[100px]" : undefined}>{phone}</span>
      {tz && (
        <span
          title="Phone area code timezone"
          className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${tzBadgeClass(tz)}`}
        >
          {tz}
        </span>
      )}
      {extraCount > 0 && (
        <span className="bg-[#B8112D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
          +{extraCount}
        </span>
      )}
    </>
  );

  if (variant === "pill" || extraCount > 0) {
    return (
      <div
        className={`inline-flex items-center gap-1 bg-[#FFF6F7] text-[#B8112D] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap min-w-0 max-w-full ${className}`}
      >
        {content}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 min-w-0 whitespace-nowrap ${className}`}>
      {content}
    </div>
  );
}
