"use client";

import { useEffect, useRef, useState } from "react";
import { parseEmails } from "../../utils/parseEmails";

interface EmailWithExtraCellProps {
  email: string;
  /** All emails — enables +N click popup */
  allEmails?: string[];
  variant?: "plain" | "pill";
  className?: string;
  emptyLabel?: string;
}

/** Email + optional +N popup (same pattern as phone). */
export default function EmailWithExtraCell({
  email,
  allEmails,
  variant = "plain",
  className = "",
  emptyLabel = "—",
}: EmailWithExtraCellProps) {
  const emails =
    allEmails && allEmails.length > 0
      ? allEmails
      : parseEmails(email);
  const primary = emails[0] ?? "";
  const extras = emails.length > 1 ? emails.length - 1 : 0;
  const canOpen = emails.length > 1;

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

  if (!primary) {
    return <span className={`text-gray-300 text-xs ${className}`}>{emptyLabel}</span>;
  }

  const chip = (
    <>
      <span className={variant === "pill" || extras > 0 ? "truncate max-w-[140px]" : "truncate"}>{primary}</span>
      {extras > 0 && (
        <span className="bg-[#B8112D] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
          +{extras}
        </span>
      )}
    </>
  );

  const shellClass =
    variant === "pill" || extras > 0
      ? `inline-flex items-center gap-1 bg-[#F0F7FF] text-[#0B84F3] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap min-w-0 max-w-full ${className}`
      : `inline-flex items-center gap-1.5 min-w-0 max-w-full text-xs sm:text-sm text-[#0F172A] ${className}`;

  if (!canOpen) {
    return <div className={shellClass} title={primary}>{chip}</div>;
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
        title="Show all emails"
        aria-expanded={open}
      >
        {chip}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-50 bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 min-w-[220px] max-w-[300px]"
          onClick={e => e.stopPropagation()}
        >
          {emails.map((em, idx) => (
            <div
              key={`${em}-${idx}`}
              className="flex items-center gap-2 px-3 py-2 text-xs text-[#0B84F3] font-medium hover:bg-[#F0F7FF]"
            >
              <span className="text-gray-300 text-[10px] shrink-0">{idx + 1}.</span>
              <span className="truncate">{em}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
