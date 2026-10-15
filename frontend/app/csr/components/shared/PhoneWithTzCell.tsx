"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Phone } from "lucide-react";
import { getTimezoneAbbrFromPhone, tzBadgeClass } from "../../constants/timezoneAbbr";
import { useFixedPopover } from "../../hooks/useFixedPopover";
import { useZoomDialer, type DialTarget } from "../dialer/ZoomDialerProvider";
import { markLeadDialed } from "../dialer/dialUnlock";

interface PhoneWithTzCellProps {
  phone: string;
  /** All numbers for this lead — enables +N click popup */
  allPhones?: string[];
  /** Additional phone count (used if allPhones not passed) */
  extraCount?: number;
  /** Pill style (potential/clients) vs plain (main table) */
  variant?: "plain" | "pill";
  className?: string;
  /** When set, clicking a number opens the Zoom dialer for that destination. */
  dial?: Pick<DialTarget, "leadId" | "clientName">;
}

function CopyPhoneButton({ value, leadId }: { value: string; leadId?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value || value === "N/A") return null;
  return (
    <button
      type="button"
      title={copied ? "Copied" : "Copy phone number"}
      aria-label="Copy phone number"
      onClick={e => {
        e.stopPropagation();
        void navigator.clipboard.writeText(value).then(() => {
          markLeadDialed(leadId);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1200);
        }).catch(() => {});
      }}
      className="inline-flex items-center justify-center w-5 h-5 rounded-md text-gray-400 hover:text-[#B8112D] hover:bg-[#FFF6F7] shrink-0"
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
}

/** Phone number + area-code timezone badge (company TZ stays on client name). */
export default function PhoneWithTzCell({
  phone,
  allPhones,
  extraCount = 0,
  variant = "plain",
  className = "",
  dial,
}: PhoneWithTzCellProps) {
  const dialer = useZoomDialer();
  const { open, setOpen, toggle, anchorRef, panelRef, style } = useFixedPopover(260, 180);
  const canDial = Boolean(dial && dialer);
  const phones = (allPhones && allPhones.length > 0 ? allPhones : [phone]).filter(Boolean);
  const primary = phones[0] ?? phone;
  const extras = phones.length > 1 ? phones.length - 1 : extraCount;
  const canOpen = phones.length > 1;

  const startCall = (destination: string) => {
    if (!dialer || !dial || !destination || destination === "N/A") return;
    setOpen(false);
    dialer.open({ destination, leadId: dial.leadId, clientName: dial.clientName });
  };

  const tz = getTimezoneAbbrFromPhone(primary);

  const numberClass = extras > 0 ? "truncate min-w-0 max-w-[72px] sm:max-w-[96px]" : "truncate min-w-0";
  const chip = (
    <>
      <Phone size={18} className="text-[#B8112D] shrink-0" aria-hidden />
      <span className={canDial ? `${numberClass} underline-offset-[3px] decoration-current group-hover:underline` : numberClass}>
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
        {canDial && (
          <p className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Tap a number to call</p>
        )}
        {phones.map((ph, idx) => {
          const pt = getTimezoneAbbrFromPhone(ph);
          const row = (
            <>
              <span className="text-gray-300 text-[10px] shrink-0">{idx + 1}.</span>
              <span className={canDial ? "truncate underline-offset-[3px] decoration-current group-hover:underline" : "truncate"}>{ph}</span>
              {pt && (
                <span className={`ml-auto inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold border shrink-0 ${tzBadgeClass(pt)}`}>
                  {pt}
                </span>
              )}
            </>
          );
          if (!canDial) {
            return (
              <div key={`${ph}-${idx}`} className="flex items-center gap-2 px-3 py-2 text-xs text-[#B8112D] font-medium">
                {row}
              </div>
            );
          }
          return (
            <button
              key={`${ph}-${idx}`}
              type="button"
              onClick={() => startCall(ph)}
              className="group flex w-full items-center gap-2 px-3 py-2 text-xs text-[#B8112D] font-medium hover:bg-[#FFF6F7] text-left cursor-pointer"
            >
              {row}
            </button>
          );
        })}
      </div>,
      document.body,
    );

  if (!canOpen) {
    if (!canDial || !primary || primary === "N/A") {
      return (
        <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
          <div className={shellClass}>{chip}</div>
          <CopyPhoneButton value={primary} leadId={dial?.leadId} />
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            startCall(primary);
          }}
          className={`${shellClass} group cursor-pointer hover:opacity-80 transition-opacity`}
          title="Call this number"
        >
          {chip}
        </button>
        <CopyPhoneButton value={primary} leadId={dial?.leadId} />
      </span>
    );
  }

  return (
    <>
      <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
        <button
          ref={anchorRef}
          type="button"
          onClick={e => {
            e.stopPropagation();
            toggle();
          }}
          className={`${shellClass} group cursor-pointer hover:opacity-80 transition-opacity`}
          title="Show all phone numbers"
          aria-expanded={open}
        >
          {chip}
        </button>
        <CopyPhoneButton value={primary} leadId={dial?.leadId} />
      </span>
      {typeof document !== "undefined" && popup}
    </>
  );
}
