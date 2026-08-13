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
};

const DECK_OFFSETS = [
  { x: 0, y: 0, r: 0, z: 50 },
  { x: -32, y: -20, r: -10, z: 40 },
  { x: 34, y: -18, r: 11, z: 40 },
  { x: -30, y: 26, r: -8, z: 30 },
  { x: 32, y: 28, r: 9, z: 30 },
];

const spanClass = (focused: boolean) =>
  focused ? "md:col-span-8 md:row-span-2 min-h-[320px]" : "md:col-span-4 min-h-[240px]";

/**
 * Deck shuffles in the center, then expands into a bento board.
 * Selecting a card briefly collapses to deck then re-expands with focus.
 */
export default function UploadActionBento({ items, className = "" }: Props) {
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

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-[#0F172A] tracking-tight">Upload board</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Watch the deck expand into a bento layout — tap a card to shuffle &amp; focus.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={replayIntro}
            className="h-8 px-3.5 rounded-full text-[11px] font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shadow-sm"
          >
            Replay expand
          </button>
          {focusId ? (
            <CapsuleTabs
              size="sm"
              activeKey={focusId}
              onChange={(key) => select(key)}
              accent={activeItem?.accent ?? "#B8112D"}
              tabs={items.map((i) => ({
                key: i.id,
                label: i.label,
                shortLabel: i.shortLabel ?? i.label,
              }))}
            />
          ) : null}
        </div>
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
          className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 sm:gap-4 ${
            expanded ? "relative py-1" : "absolute inset-0"
          }`}
        >
          {order.map((id, index) => {
            const item = byId.get(id);
            if (!item) return null;
            const focused = expanded && id === focusId;
            const deck = DECK_OFFSETS[Math.min(index, DECK_OFFSETS.length - 1)];

            return (
              <div
                key={id}
                className={`
                  group/card rounded-[1.75rem] border bg-white overflow-hidden origin-center
                  transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform
                  ${expanded ? spanClass(focused) : "absolute left-1/2 top-1/2 w-[min(92%,390px)]"}
                  ${focused ? "shadow-2xl scale-[1.01]" : "shadow-md hover:shadow-xl"}
                `}
                style={{
                  zIndex: expanded ? (focused ? 20 : 10) : deck.z,
                  borderColor: focused || !expanded ? `${item.accent}66` : "#ececf2",
                  boxShadow: focused
                    ? `0 30px 55px -30px ${item.accent}aa, 0 0 0 2px ${item.accent}33`
                    : !expanded
                      ? `0 20px 40px -24px rgba(15,23,42,0.35)`
                      : undefined,
                  transform: expanded
                    ? "none"
                    : `translate(calc(-50% + ${deck.x}px), calc(-50% + ${deck.y}px)) rotate(${deck.r}deg) scale(${index === 0 ? 1 : 0.88})`,
                }}
              >
                <button
                  type="button"
                  aria-label={`Focus ${item.label}`}
                  onClick={() => {
                    if (id !== focusId || !expanded) select(id);
                  }}
                  className="absolute inset-x-0 top-0 h-10 z-20 cursor-pointer"
                  style={{ background: `linear-gradient(90deg, ${item.accent}, ${item.accent}55)` }}
                >
                  <span className="sr-only">Focus {item.label}</span>
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/95 tracking-wide">
                    {item.shortLabel ?? item.label}
                    {focused ? " · focused" : ""}
                  </span>
                </button>

                <div className="pt-10">{item.content}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
