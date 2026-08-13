"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import CapsuleTabs from "@/app/components/CapsuleTabs";

export type ShuffleFanItem = {
  id: string;
  label: string;
  shortLabel?: string;
  /** Accent for the active capsule + card border glow */
  accent: string;
  content: ReactNode;
};

type SlotStyle = {
  x: string;
  y: string;
  scale: number;
  rotate: number;
  z: number;
  opacity: number;
};

/** Front + four corner peeks — matches the fan sketch */
const DESKTOP_SLOTS: SlotStyle[] = [
  { x: "0%", y: "0%", scale: 1, rotate: 0, z: 50, opacity: 1 },
  { x: "-38%", y: "-22%", scale: 0.78, rotate: -11, z: 30, opacity: 0.92 },
  { x: "38%", y: "-22%", scale: 0.78, rotate: 11, z: 30, opacity: 0.92 },
  { x: "-36%", y: "24%", scale: 0.74, rotate: -8, z: 20, opacity: 0.88 },
  { x: "36%", y: "24%", scale: 0.74, rotate: 8, z: 20, opacity: 0.88 },
];

type Props = {
  items: ShuffleFanItem[];
  className?: string;
};

export default function ShuffleFanStack({ items, className = "" }: Props) {
  const ids = useMemo(() => items.map((i) => i.id), [items]);
  const [order, setOrder] = useState<string[]>(ids);

  useEffect(() => {
    setOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
  }, [ids]);

  const byId = useMemo(() => {
    const map = new Map(items.map((i) => [i.id, i]));
    return map;
  }, [items]);

  const activeId = order[0] ?? items[0]?.id ?? "";
  const activeItem = activeId ? byId.get(activeId) : undefined;

  const bringToFront = useCallback((id: string) => {
    setOrder((prev) => (prev[0] === id ? prev : [id, ...prev.filter((x) => x !== id)]));
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[#0F172A] tracking-tight">Upload actions</h2>
          <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
            Tap a side card — it shuffles to the front. Or use the capsules below.
          </p>
        </div>
        {activeId ? (
          <CapsuleTabs
            size="sm"
            activeKey={activeId}
            onChange={(key) => bringToFront(key)}
            accent={activeItem?.accent ?? "#B8112D"}
            tabs={items.map((i) => ({
              key: i.id,
              label: i.label,
              shortLabel: i.shortLabel ?? i.label,
            }))}
          />
        ) : null}
      </div>

      {/* Mobile: single focused card */}
      <div className="md:hidden">
        {activeItem && (
          <div
            key={activeItem.id}
            className="rounded-3xl border bg-white shadow-lg overflow-hidden transition-all duration-500"
            style={{
              borderColor: `${activeItem.accent}55`,
              boxShadow: `0 18px 40px -20px ${activeItem.accent}66`,
            }}
          >
            {activeItem.content}
          </div>
        )}
      </div>

      {/* Desktop / tablet: fan stack */}
      <div
        className="hidden md:block relative mx-auto w-full max-w-3xl h-[420px] lg:h-[460px] select-none"
        aria-label="Upload card stack"
      >
        <div
          aria-hidden
          className="absolute inset-[8%] rounded-[2.5rem] bg-gradient-to-br from-slate-100/80 via-white to-slate-50 border border-gray-100/80"
        />

        {order.map((id, slotIndex) => {
          const item = byId.get(id);
          if (!item) return null;
          const slot = DESKTOP_SLOTS[Math.min(slotIndex, DESKTOP_SLOTS.length - 1)];
          const isFront = slotIndex === 0;
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              aria-pressed={isFront}
              aria-label={`${item.label}${isFront ? " (active)" : " — bring to front"}`}
              onClick={() => {
                if (!isFront) bringToFront(id);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !isFront) {
                  e.preventDefault();
                  bringToFront(id);
                }
              }}
              className={`absolute left-1/2 top-1/2 w-[min(100%,420px)] rounded-3xl border bg-white overflow-hidden origin-center
                transition-[transform,box-shadow,opacity,border-color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]
                ${isFront ? "cursor-default shadow-2xl" : "cursor-pointer hover:brightness-[1.02] shadow-lg"}
              `}
              style={{
                zIndex: slot.z,
                opacity: slot.opacity,
                borderColor: isFront ? `${item.accent}66` : "#e5e7eb",
                boxShadow: isFront
                  ? `0 28px 60px -24px ${item.accent}88, 0 12px 24px -16px rgba(15,23,42,0.18)`
                  : "0 14px 28px -18px rgba(15,23,42,0.22)",
                transform: `translate(calc(-50% + ${slot.x}), calc(-50% + ${slot.y})) scale(${slot.scale}) rotate(${slot.rotate}deg)`,
              }}
            >
              {!isFront && (
                <div
                  className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm pointer-events-none"
                  style={{ backgroundColor: item.accent }}
                >
                  {item.shortLabel ?? item.label}
                </div>
              )}
              <div className={isFront ? "" : "pointer-events-none saturate-[0.85]"}>
                {item.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
