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
  /** Shown on very narrow columns when `title` would truncate too aggressively */
  shortTitle?: string;
};

type CapsuleChipNavProps = {
  items: CapsuleChipItem[];
  baseHref: string;
  accent?: string;
  /** Tailwind grid column classes, e.g. `grid-cols-3 sm:grid-cols-6` */
  gridClassName?: string;
  className?: string;
};

export default function CapsuleChipNav({
  items,
  baseHref,
  accent = "#B8112D",
  gridClassName = "grid-cols-3 sm:grid-cols-6",
  className = "",
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

  return (
    <div
      ref={trackRef}
      className={`relative grid gap-1 ${gridClassName} ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-full border border-crm-border-subtle backdrop-blur-md transition-[transform,width,height,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[transform,width,height]"
        style={{
          width: capsule.width,
          height: capsule.height,
          transform: `translate(${capsule.left}px, ${capsule.top}px)`,
          opacity: capsule.ready ? 1 : 0,
          background: `linear-gradient(135deg, ${accent}, ${accent}dd)`,
          boxShadow: `0 4px 14px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
        } as CSSProperties}
      />
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
            className={`relative z-[1] inline-flex w-full items-center justify-center gap-1 sm:gap-1.5 h-9 px-1 sm:px-2 rounded-full text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-colors duration-300 min-w-0 ${
              active
                ? "text-white"
                : "text-crm-text-secondary hover:text-[#B8112D]"
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
