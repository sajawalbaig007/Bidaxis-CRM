"use client";

import Image from "next/image";

type BrandLogoProps = {
  /** Visual size preset */
  size?: "sm" | "md" | "lg";
  /** Soft glass pill (default) vs bare logo */
  variant?: "glass" | "plain";
  className?: string;
  priority?: boolean;
};

const SIZE = {
  sm: { box: "px-3.5 py-2", img: "h-7 sm:h-8", w: 120, h: 36 },
  md: { box: "px-4 sm:px-5 py-2.5 sm:py-3", img: "h-9 sm:h-10", w: 160, h: 48 },
  lg: { box: "px-5 sm:px-6 py-3 sm:py-3.5", img: "h-10 sm:h-12", w: 200, h: 56 },
} as const;

/**
 * Landing / login brand mark — avoids the heavy white “sticker” card.
 * Soft glass capsule keeps the PNG logo readable on dark gradients.
 */
export default function BrandLogo({
  size = "md",
  variant = "glass",
  className = "",
  priority = false,
}: BrandLogoProps) {
  const s = SIZE[size];

  if (variant === "plain") {
    return (
      <Image
        src="/images/LOGO.png"
        alt="BEM Solutions"
        width={s.w}
        height={s.h}
        priority={priority}
        className={`object-contain ${s.img} w-auto ${className}`}
        style={{ width: "auto", height: "auto" }}
      />
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center rounded-2xl bg-white/92 dark:bg-white/95 backdrop-blur-md border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.25)] ring-1 ring-black/5 ${s.box} ${className}`}
    >
      <Image
        src="/images/LOGO.png"
        alt="BEM Solutions"
        width={s.w}
        height={s.h}
        priority={priority}
        className={`object-contain ${s.img} w-auto max-w-[min(100%,220px)]`}
        style={{ width: "auto", height: "auto" }}
      />
    </div>
  );
}
