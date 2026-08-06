"use client";

type BemWordmarkProps = {
  className?: string;
  muted?: boolean;
  onDark?: boolean;
};

/**
 * Brand text styled to echo the BEM logo colors.
 */
export default function BemWordmark({ className = "", muted = false, onDark = false }: BemWordmarkProps) {
  const bemClass = onDark
    ? (muted ? "text-[#d9e3ff]/80" : "text-[#d9e3ff]")
    : (muted ? "text-[#1F2A44]/80 dark:text-white/75" : "text-[#1F2A44] dark:text-white");
  const solutionsClass = onDark
    ? (muted ? "text-[#ff8ea2]/85" : "text-[#ff8ea2]")
    : (muted ? "text-[#B8112D]/85 dark:text-[#ff7d93]" : "text-[#B8112D]");

  return (
    <p
      className={`inline-flex items-baseline gap-1.5 uppercase tracking-[0.06em] font-semibold ${className}`}
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <span className={bemClass}>BEM</span>
      <span className={solutionsClass}>SOLUTIONS</span>
    </p>
  );
}
