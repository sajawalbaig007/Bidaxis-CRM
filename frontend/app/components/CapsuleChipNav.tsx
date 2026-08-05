"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { LucideIcon } from "lucide-react";

export type CapsuleChipItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Shown on very narrow columns when `title` would truncate too aggressively (grid layout only) */
  shortTitle?: string;
};

type CapsuleChipNavProps = {
  items: CapsuleChipItem[];
  baseHref: string;
  accent?: string;
  /** Tailwind grid column classes — grid layout only */
  gridClassName?: string;
  className?: string;
  /** `inline` = single-row toolbar nav (accounts #272 style); `grid` = second-row chip grid */
  variant?: "inline" | "grid";
};

export default function CapsuleChipNav({
  items,
  baseHref,
  accent = "#B8112D",
  gridClassName = "grid-cols-3 sm:grid-cols-6",
  className = "",
  variant = "inline",
}: CapsuleChipNavProps) {
  const pathname = usePathname();
  const trackRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [capsule, setCapsule] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const activeIndex = items.findIndex(item =>
    item.href === baseHref ? pathname === baseHref : pathname.startsWith(item.href),
  );
  const index = activeIndex >= 0 ? activeIndex : 0;

  const measureCapsule = useCallback(() => {
    const el = chipRefs.current[index];
    if (!el) return;
    setCapsule({
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      ready: true,
    });
  }, [index]);

  useLayoutEffect(() => {
    measureCapsule();
  }, [measureCapsule]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onResize = () => measureCapsule();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    ro?.observe(track);
    window.addEventListener("resize", onResize);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [measureCapsule]);

  const pillRadius = variant === "inline" ? "rounded-[13px]" : "rounded-full";
  const pillClass =
    `pointer-events-none absolute ${pillRadius} transition-[transform,width,height,box-shadow,opacity] duration-700 ease-[cubic-bezier(0.34,1.25,0.64,1)] will-change-[transform,width,height]`;

  const pillStyle = {
    width: capsule.width,
    height: capsule.height,
    transform: `translate3d(${capsule.left}px, ${capsule.top}px, 0)`,
    opacity: capsule.ready ? 1 : 0,
    background: accent,
    boxShadow: `0 4px 14px ${accent}40`,
  } as CSSProperties;

  const trackClass =
    variant === "inline"
      ? `relative mx-auto w-fit max-w-full flex items-center gap-0.5 bg-crm-nav-pill rounded-[18px] p-1 overflow-x-auto border border-crm-border-subtle ${className}`
      : `relative grid gap-1 sm:gap-1.5 ${gridClassName} ${className}`;

  return (
    <div
      ref={trackRef}
      className={trackClass}
      style={variant === "inline" ? { scrollbarWidth: "none" } : undefined}
    >
      <span aria-hidden className={pillClass} style={pillStyle} />
      {items.map((item, i) => {
        const Icon = item.icon;
        const active = i === index;
        if (variant === "inline") {
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              ref={el => {
                chipRefs.current[i] = el;
              }}
              title={item.title}
              className={`relative z-[1] h-10 px-3 md:px-4 rounded-[13px] flex items-center gap-2 text-[12px] md:text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors duration-300 ${
                active
                  ? "text-white"
                  : "text-crm-text-secondary hover:bg-crm-surface/80 hover:text-[#B8112D]"
              }`}
            >
              <Icon size={15} className="shrink-0" />
              <span className="hidden md:inline">{item.title}</span>
            </Link>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            ref={el => {
              chipRefs.current[i] = el;
            }}
            title={item.title}
            className={`relative z-[1] inline-flex w-full items-center justify-center gap-1 sm:gap-1.5 h-9 sm:h-10 px-1 sm:px-2 rounded-full text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-colors duration-300 min-w-0 ${
              active
                ? "text-white"
                : "text-crm-text-secondary hover:text-[#B8112D] hover:bg-white/50"
            }`}
          >
            <Icon size={13} className="shrink-0" />
            <span className="truncate sm:hidden">{item.shortTitle ?? item.title}</span>
            <span className="truncate hidden sm:inline">{item.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
