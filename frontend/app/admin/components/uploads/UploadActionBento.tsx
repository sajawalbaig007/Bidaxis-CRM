"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import CapsuleTabs from "@/app/components/CapsuleTabs";

export type UploadBentoItem = {
  id: string;
  label: string;
  shortLabel?: string;
  accent: string;
  span?: "hero" | "wide" | "normal";
  content: ReactNode;
};

type Props = {
  items: UploadBentoItem[];
  className?: string;
  title?: string;
  subtitle?: string;
  replayLabel?: string;
  toolbar?: ReactNode;
};

const DECK_OFFSETS = [
  { x: 0, y: 0, r: 0, z: 50 },
  { x: -32, y: -20, r: -10, z: 40 },
  { x: 34, y: -18, r: 11, z: 40 },
  { x: -30, y: 26, r: -8, z: 30 },
  { x: 32, y: 28, r: 9, z: 30 },
];

/** Stable bento slots — focused card is the tall left tile; rest fill equal rows */
function slotClass(id: string, focusId: string, ids: string[]): string {
  const focused = id === focusId;
  const others = ids.filter((x) => x !== focusId);
  const oi = others.indexOf(id);

  if (focused) {
    return "md:col-span-8 md:row-span-2 md:col-start-1 md:row-start-1";
  }
  /* Right column: first two others stack to match hero height */
  if (oi === 0) return "md:col-span-4 md:col-start-9 md:row-start-1";
  if (oi === 1) return "md:col-span-4 md:col-start-9 md:row-start-2";
  /* Bottom row */
  if (oi === 2) return "md:col-span-6 md:col-start-1 md:row-start-3";
  if (oi === 3) return "md:col-span-6 md:col-start-7 md:row-start-3";
  return "md:col-span-4";
}

export default function UploadActionBento({
  items,
  className = "",
  title = "Upload board",
  subtitle = "Deck expands into a bento board — tap a capsule or card to focus.",
  replayLabel = "Replay expand",
  toolbar,
}: Props) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const [order, setOrder] = useState(ids);
  const [expanded, setExpanded] = useState(false);
  const [focusId, setFocusId] = useState(ids[0] ?? "");

  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
    if (!focusId || !ids.includes(focusId)) setFocusId(ids[0] ?? "");
  }, [ids, focusId]);

  useEffect(() => {
    const t1 = window.setTimeout(() => setExpanded(true), 520);
    return () => window.clearTimeout(t1);
  }, []);

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const activeItem = byId.get(focusId);

  const select = useCallback((id: string) => {
    setFocusId(id);
    setOrder((prev) => (prev[0] === id ? prev : [id, ...prev.filter((x) => x !== id)]));
    setExpanded(false);
    window.setTimeout(() => setExpanded(true), 300);
  }, []);

  const replayIntro = useCallback(() => {
    setExpanded(false);
    window.setTimeout(() => setExpanded(true), 450);
  }, []);

  /* Deck uses shuffle order; expanded grid uses stable focus layout */
  const renderIds = expanded ? ids : order;

  return (
    <div className={`space-y-4 antialiased ${className}`}>
      {/* Title + capsule LEFT */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-crm-text tracking-tight">{title}</h2>
            {subtitle ? <p className="text-sm text-gray-500 dark:text-crm-text-muted mt-1">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {toolbar}
            <button
              type="button"
              onClick={replayIntro}
              className="self-start h-10 px-4 rounded-full text-sm font-semibold border border-gray-200 dark:border-crm-border bg-white dark:bg-crm-surface text-gray-700 dark:text-crm-text-secondary hover:bg-gray-50 dark:hover:bg-crm-muted shadow-sm shrink-0"
            >
              {replayLabel}
            </button>
          </div>
        </div>

        {focusId ? (
          <div className="w-full max-w-full">
            <CapsuleTabs
              size="lg"
              activeKey={focusId}
              onChange={(key) => select(key)}
              accent={activeItem?.accent ?? "#B8112D"}
              className="!max-w-none"
              tabs={items.map((i) => ({
                key: i.id,
                label: i.label,
                shortLabel: i.shortLabel ?? i.label,
              }))}
            />
          </div>
        ) : null}
      </div>

      <div
        className={`relative w-full rounded-[2rem] transition-[min-height,background] duration-500 ${
          expanded ? "min-h-0 bg-transparent" : "min-h-[400px] sm:min-h-[440px]"
        }`}
        style={
          expanded
            ? undefined
            : {
                background:
                  "radial-gradient(ellipse at 50% 45%, rgba(184,17,45,0.1), transparent 55%), linear-gradient(145deg, #f1f5f9 0%, #eef2ff 50%, #fdf2f8 100%)",
              }
        }
      >
        <div
          className={
            expanded
              ? "relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 md:grid-rows-[minmax(200px,1fr)_minmax(200px,1fr)_minmax(220px,auto)] gap-3 sm:gap-4"
              : "absolute inset-0"
          }
        >
          {renderIds.map((id, index) => {
            const item = byId.get(id);
            if (!item) return null;
            const focused = expanded && id === focusId;
            const deck = DECK_OFFSETS[Math.min(index, DECK_OFFSETS.length - 1)];
            const orderIndex = order.indexOf(id);

            return (
              <div
                key={id}
                className={`
                  group/card rounded-[1.75rem] border bg-white dark:bg-crm-surface overflow-hidden
                  transition-[transform,box-shadow,border-color,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]
                  flex flex-col
                  ${expanded ? `${slotClass(id, focusId, ids)} h-full min-h-[220px]` : "absolute left-1/2 top-1/2 w-[min(92%,390px)]"}
                  ${focused ? "shadow-2xl" : "shadow-md hover:shadow-xl"}
                `}
                style={{
                  zIndex: expanded ? (focused ? 20 : 10) : deck.z,
                  borderColor: focused || !expanded ? `${item.accent}66` : "var(--crm-border)",
                  boxShadow: focused
                    ? `0 24px 48px -28px ${item.accent}aa, 0 0 0 2px ${item.accent}33`
                    : !expanded
                      ? `0 20px 40px -24px rgba(15,23,42,0.35)`
                      : undefined,
                  transform: expanded
                    ? "none"
                    : `translate(calc(-50% + ${deck.x}px), calc(-50% + ${deck.y}px)) rotate(${deck.r}deg) scale(${orderIndex === 0 ? 1 : 0.88})`,
                }}
              >
                <button
                  type="button"
                  aria-label={`Focus ${item.label}`}
                  onClick={() => {
                    if (id !== focusId || !expanded) select(id);
                  }}
                  className="shrink-0 w-full h-11 relative z-20 cursor-pointer text-left px-4"
                  style={{ background: `linear-gradient(90deg, ${item.accent}, ${item.accent}66)` }}
                >
                  <span className="text-sm font-bold text-white tracking-wide">
                    {item.label}
                    {focused ? " · focused" : ""}
                  </span>
                </button>

                <div className="flex-1 min-h-0 flex flex-col [&_>div]:flex-1 [&_>div]:min-h-0 [&_>div]:flex [&_>div]:flex-col">
                  {item.content}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
