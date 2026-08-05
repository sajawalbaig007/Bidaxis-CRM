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
  /** Compact label for medium screens */
  shortTitle?: string;
};

type CapsuleChipNavProps = {
  items: CapsuleChipItem[];
  baseHref: string;
  accent?: string;
  gridClassName?: string;
  className?: string;
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
  const scrollRef = useRef<HTMLDivElement>(null);
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
    const track = trackRef.current;
    const el = chipRefs.current[index];
    if (!track || !el) return;
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
  }, [measureCapsule, pathname]);

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

  useEffect(() => {
    const el = chipRefs.current[index];
    const scroller = scrollRef.current;
    if (!el || !scroller) return;
    const elLeft = el.offsetLeft;
    const elRight = elLeft + el.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;
    if (elLeft < viewLeft + 8 || elRight > viewRight - 8) {
      scroller.scrollTo({
        left: elLeft - scroller.clientWidth / 2 + el.offsetWidth / 2,
        behavior: "smooth",
      });
    }
  }, [index]);

  const pillClass =
    "pointer-events-none absolute rounded-[11px] transition-[transform,width,height,opacity] duration-500 ease-[cubic-bezier(0.34,1.2,0.64,1)] will-change-[transform,width,height]";

  const pillStyle = {
    width: capsule.width,
    height: capsule.height,
    transform: `translate3d(${capsule.left}px, ${capsule.top}px, 0)`,
    opacity: capsule.ready ? 1 : 0,
    background: `linear-gradient(180deg, ${accent} 0%, ${accent}e8 100%)`,
    boxShadow: `0 2px 10px ${accent}30, inset 0 1px 0 rgba(255,255,255,0.18)`,
  } as CSSProperties;

  if (variant === "grid") {
    return (
      <div ref={trackRef} className={`relative grid gap-1 sm:gap-1.5 ${gridClassName} ${className}`}>
        <span aria-hidden className={`${pillClass} rounded-full`} style={pillStyle} />
        {items.map((item, i) => {
          const Icon = item.icon;
          const active = i === index;
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
                active ? "text-white" : "text-crm-text-secondary hover:text-[#B8112D] hover:bg-white/50"
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

  return (
    <div
      ref={scrollRef}
      className={`w-full max-w-full overflow-x-auto rounded-[16px] bg-crm-nav-pill border border-crm-border-subtle/70 accounts-nav-scroll ${className}`}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div ref={trackRef} className="relative inline-flex items-center gap-0.5 p-1 min-w-max">
        <span aria-hidden className={pillClass} style={pillStyle} />
        {items.map((item, i) => {
          const Icon = item.icon;
          const active = i === index;
          const short = item.shortTitle ?? item.title.split(" ")[0];
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              ref={el => {
                chipRefs.current[i] = el;
              }}
              title={item.title}
              className={`relative z-[1] h-9 sm:h-[38px] px-2.5 sm:px-3 xl:px-3.5 rounded-[11px] inline-flex items-center gap-1.5 text-[11px] sm:text-[12px] font-semibold whitespace-nowrap shrink-0 transition-colors duration-200 ${
                active
                  ? "text-white"
                  : "text-crm-text-secondary hover:text-[#B8112D] hover:bg-crm-surface/70"
              }`}
            >
              <Icon size={14} className="shrink-0 opacity-90" />
              <span className="hidden sm:inline xl:hidden">{short}</span>
              <span className="hidden xl:inline">{item.title}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
