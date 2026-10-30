"use client";

type BemWordmarkProps = {
  className?: string;
  muted?: boolean;
  onDark?: boolean;
};

/** Brand text — BidAxis on login and company gates. */
export default function BemWordmark({ className = "", muted = false, onDark = false }: BemWordmarkProps) {
  const main = onDark
    ? (muted ? "text-white/90" : "text-white")
    : (muted ? "text-[#0B1F3A]/85 dark:text-white/80" : "text-[#0B1F3A] dark:text-white");
  const accent = onDark
    ? (muted ? "text-[#8EBEFF]/95" : "text-[#8EBEFF]")
    : (muted ? "text-[#1B6FE8]/90" : "text-[#1B6FE8]");

  return (
    <p className={`inline-flex items-baseline justify-center font-black tracking-tight ${className}`}>
      <span className={main}>Bid</span>
      <span className={accent}>Axis</span>
    </p>
  );
}
