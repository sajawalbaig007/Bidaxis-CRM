"use client";

type BemWordmarkProps = {
  className?: string;
  muted?: boolean;
  onDark?: boolean;
};

/**
 * BidAxis wordmark, with a blue/navy treatment for BidAxis and a blue domain mark.
 */
export default function BemWordmark({ className = "", muted = false, onDark = false }: BemWordmarkProps) {
  const companyClass = onDark
    ? (muted ? "text-white/90" : "text-white")
    : (muted ? "text-[#1F2A44]/85 dark:text-white/80" : "text-[#1F2A44] dark:text-white");
  const domainClass = onDark
    ? (muted ? "text-[#60A5FA]/95" : "text-[#3B82F6]")
    : (muted ? "text-[#0F398A]/90 dark:text-[#60A5FA]" : "text-[#0F398A]");

  return (
    <p
      className={`inline-flex items-baseline justify-center gap-1.5 uppercase tracking-[0.08em] font-bold ${className}`}
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <span className={companyClass}>BidAxis</span>
      <span className={domainClass}>.co</span>
    </p>
  );
}
