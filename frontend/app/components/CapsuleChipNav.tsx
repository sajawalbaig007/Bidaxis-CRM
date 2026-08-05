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
  type ReactNode,
} from "react";
import type { LucideIcon } from "lucide-react";

export type CapsuleChipItem = {
  title: string;
  href: string;
  icon: LucideIcon;
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

type CapsuleRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const PILL_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const PILL_MS = 500;

function measureChip(el: HTMLAnchorElement): CapsuleRect {
  return {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
  };
}

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
  const [optimisticIndex, setOptimisticIndex] = useState<number | null>(null);
  const [capsule, setCapsule] = useState<CapsuleRect & { ready: boolean }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false,
  });

  const routeIndex = items.findIndex(item =>
    item.href === baseHref ? pathname === baseHref : pathname.startsWith(item.href),
  );
  const resolvedRouteIndex = routeIndex >= 0 ? routeIndex : 0;
  const index = optimisticIndex ?? resolvedRouteIndex;

  useEffect(() => {
    if (optimisticIndex === null) return;
    if (optimisticIndex === resolvedRouteIndex) {
      setOptimisticIndex(null);
    }
  }, [optimisticIndex, resolvedRouteIndex]);

  const applyCapsule = useCallback((i: number) => {
    const el = chipRefs.current[i];
    if (!el) return;
    setCapsule({ ...measureChip(el), ready: true });
  }, []);

  useLayoutEffect(() => {
    applyCapsule(index);
    const id = requestAnimationFrame(() => applyCapsule(index));
    return () => cancelAnimationFrame(id);
  }, [applyCapsule, index, pathname]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const remeasure = () => applyCapsule(index);
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(remeasure) : null;
    ro?.observe(track);
    chipRefs.current.forEach(el => {
      if (el) ro?.observe(el);
    });
    window.addEventListener("resize", remeasure);

    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", remeasure);
    };
  }, [applyCapsule, index, items.length]);

  useEffect(() => {
    const el = chipRefs.current[index];
    const scroller = scrollRef.current;
    if (!el || !scroller || variant !== "inline") return;

    const timer = window.setTimeout(() => {
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
    }, 80);

    return () => window.clearTimeout(timer);
  }, [index, variant]);

  const pillTransition = [
    `transform ${PILL_MS}ms ${PILL_EASE}`,
    `width ${PILL_MS}ms ${PILL_EASE}`,
    `height ${PILL_MS}ms ${PILL_EASE}`,
    `opacity 220ms ease`,
  ].join(", ");

  const pillStyle = {
    width: capsule.width,
    height: capsule.height,
    transform: `translate3d(${capsule.left}px, ${capsule.top}px, 0)`,
    opacity: capsule.ready ? 1 : 0,
    transition: pillTransition,
    background: `linear-gradient(135deg, ${accent}ee, ${accent}99)`,
    boxShadow: `0 4px 18px ${accent}55, inset 0 1px 0 rgba(255,255,255,0.25)`,
  } as CSSProperties;

  const renderLink = (
    item: CapsuleChipItem,
    i: number,
    linkClass: string,
    label: ReactNode,
  ) => {
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
        onClick={() => setOptimisticIndex(i)}
        className={`${linkClass} ${active ? "text-white" : "text-white/55 hover:text-white/90"}`}
      >
        <Icon size={13} className="shrink-0" />
        {label}
      </Link>
    );
  };

  if (variant === "grid") {
    return (
      <div ref={trackRef} className={`relative grid gap-1 sm:gap-1.5 ${gridClassName} ${className}`}>
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 rounded-full border border-white/25 backdrop-blur-md will-change-[transform,width,height]"
          style={pillStyle}
        />
        {items.map((item, i) =>
          renderLink(
            item,
            i,
            `relative z-[1] inline-flex w-full items-center justify-center gap-1 sm:gap-1.5 h-9 px-1.5 sm:px-2 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap min-w-0 transition-colors duration-300`,
            <>
              <span className="truncate sm:hidden">{item.shortTitle ?? item.title}</span>
              <span className="truncate hidden sm:inline">{item.title}</span>
            </>,
          ),
        )}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className={`w-full max-w-full overflow-x-auto accounts-nav-scroll ${className}`}
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <div
        ref={trackRef}
        className="relative inline-flex items-center gap-1 p-1 min-w-max rounded-full bg-[#0F172A]/92 backdrop-blur-md border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_-6px_rgba(15,23,42,0.35)]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 rounded-full border border-white/25 backdrop-blur-md will-change-[transform,width,height]"
          style={pillStyle}
        />
        {items.map((item, i) => {
          const short = item.shortTitle ?? item.title.split(" ")[0];
          return renderLink(
            item,
            i,
            `relative z-[1] inline-flex items-center justify-center gap-1 sm:gap-1.5 h-9 px-2 sm:px-2.5 xl:px-3 rounded-full text-[10px] sm:text-[11px] xl:text-xs font-bold whitespace-nowrap shrink-0 transition-colors duration-300 min-w-0`,
            <>
              <span className="truncate sm:hidden">{short}</span>
              <span className="truncate hidden sm:inline xl:hidden">{short}</span>
              <span className="truncate hidden xl:inline">{item.title}</span>
            </>,
          );
        })}
      </div>
    </div>
  );
}
