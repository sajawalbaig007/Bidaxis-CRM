"use client";

import { createPortal } from "react-dom";
import { Briefcase } from "lucide-react";
import { parseInterestedServices } from "../../utils/parseInterestedServices";
import { useFixedPopover } from "../../hooks/useFixedPopover";

interface InterestedServicesCellProps {
  interestedService: string;
  /** Max badges shown inline before +N popup */
  inlineMax?: number;
  className?: string;
  emptyLabel?: string;
}

/** One or more interested-service badges; +N popup when many. */
export default function InterestedServicesCell({
  interestedService,
  inlineMax = 6,
  className = "",
  emptyLabel = "—",
}: InterestedServicesCellProps) {
  const services = parseInterestedServices(interestedService);

  if (services.length === 0) {
    return <span className={`text-gray-300 text-xs ${className}`}>{emptyLabel}</span>;
  }

  if (services.length === 1) {
    return (
      <div
        className={`inline-flex items-center gap-1 bg-[#FFF4E5] text-[#D97706] px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs sm:text-sm font-semibold min-w-0 max-w-full ${className}`}
        title={services[0]}
      >
        <Briefcase size={11} className="shrink-0" />
        <span className="truncate">{services[0]}</span>
      </div>
    );
  }

  const visible = services.slice(0, inlineMax);
  const hidden = services.slice(inlineMax);
  const canOpen = hidden.length > 0;

  const { open, toggle, anchorRef, panelRef, style } = useFixedPopover(280, 180);

  const badge = (svc: string, compact = false) => (
    <span
      key={svc}
      className={`inline-flex items-center gap-0.5 bg-[#FFF4E5] text-[#D97706] rounded-lg font-semibold shrink-0 ${
        compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[10px] sm:text-xs"
      }`}
      title={svc}
    >
      <Briefcase size={compact ? 8 : 9} className="shrink-0" />
      <span className="truncate max-w-[88px] sm:max-w-[110px]">{svc}</span>
    </span>
  );

  const popup =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={style}
        className="bg-white border border-gray-100 rounded-xl shadow-xl py-1.5 min-w-[200px] max-w-[280px]"
        onClick={e => e.stopPropagation()}
      >
        {services.map((svc, idx) => (
          <div
            key={`${svc}-${idx}`}
            className="flex items-center gap-2 px-3 py-2 text-xs text-[#D97706] font-semibold hover:bg-[#FFF4E5]"
          >
            <Briefcase size={11} className="shrink-0" />
            <span className="truncate">{svc}</span>
          </div>
        ))}
      </div>,
      document.body,
    );

  const chips = (
    <div className={`flex flex-wrap items-center gap-1 min-w-0 max-w-full ${className}`}>
      {visible.map(svc => badge(svc))}
      {canOpen && (
        <span className="bg-[#D97706] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
          +{hidden.length}
        </span>
      )}
    </div>
  );

  if (!canOpen) {
    return chips;
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
        className="cursor-pointer hover:opacity-90 transition-opacity text-left"
        title="Show all interested services"
        aria-expanded={open}
      >
        {chips}
      </button>
      {typeof document !== "undefined" && popup}
    </>
  );
}
