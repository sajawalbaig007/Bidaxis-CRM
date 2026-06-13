"use client";
import { useMemo } from "react";

export interface StackedSegment { label: string; value: number; color: string; }
export interface StackedBarRow  { label: string; segments: StackedSegment[]; }

interface Props {
  title: string;
  subtitle?: string;
  rows: StackedBarRow[];
  loading?: boolean;
  unit?: string;
}

export default function StackedHorizontalBarChart({ title, subtitle, rows, loading, unit = "" }: Props) {
  const legendItems = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach(r => r.segments.forEach(s => { if (!map.has(s.label)) map.set(s.label, s.color); }));
    return [...map.entries()].map(([label, color]) => ({ label, color }));
  }, [rows]);

  const maxTotal = useMemo(
    () => Math.max(...rows.map(r => r.segments.reduce((a, s) => a + s.value, 0)), 1),
    [rows],
  );

  return (
    <div className="bg-white rounded-2xl sm:rounded-[28px] p-4 sm:p-5 lg:p-6 shadow-sm border border-white">
      <h3 className="text-base sm:text-[18px] font-bold text-[#0F172A]">{title}</h3>
      {subtitle && <p className="text-xs sm:text-[13px] text-gray-500 mt-0.5 leading-snug">{subtitle}</p>}

      {/* Legend */}
      {legendItems.length > 0 && (
        <div className="flex flex-wrap gap-3 sm:gap-5 mt-3 sm:mt-4 pb-3 sm:pb-4 border-b border-[#F1F2F6]">
          {legendItems.map(it => (
            <div key={it.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: it.color }} />
              <span className="text-[11px] sm:text-[12px] text-gray-600 font-medium">{it.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Bars */}
      <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-4">
        {loading ? (
          [70, 48, 62, 35, 55].map((w, i) => (
            <div key={i} className="flex items-center gap-3 sm:gap-4">
              <div className="w-24 sm:w-28 h-3 sm:h-3.5 bg-gray-100 rounded animate-pulse shrink-0" />
              <div className="h-7 sm:h-8 bg-gray-100 rounded-xl animate-pulse flex-1" style={{ maxWidth: `${w}%` }} />
              <div className="w-6 h-3 bg-gray-100 rounded animate-pulse shrink-0" />
            </div>
          ))
        ) : (
          rows.map(row => {
            const total     = row.segments.reduce((a, s) => a + s.value, 0);
            const barWidthPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0;
            return (
              <div key={row.label} className="flex items-center gap-3 sm:gap-4">
                {/* Label */}
                <div className="w-24 sm:w-28 lg:w-36 shrink-0 text-right">
                  <span className="text-[11px] sm:text-[12px] font-medium text-[#374151] leading-tight">{row.label}</span>
                </div>

                {/* Stacked bar */}
                <div className="flex-1 flex">
                  {total > 0 ? (
                    <div
                      className="h-7 sm:h-9 flex rounded-lg sm:rounded-xl overflow-hidden"
                      style={{ width: `${Math.max(barWidthPct, 2)}%` }}
                    >
                      {row.segments.filter(s => s.value > 0).map(seg => {
                        const pct = total > 0 ? (seg.value / total) * 100 : 0;
                        return (
                          <div
                            key={seg.label}
                            className="flex items-center justify-center text-white text-[9px] sm:text-[10px] font-semibold leading-none select-none"
                            style={{ width: `${pct}%`, backgroundColor: seg.color, minWidth: 4 }}
                            title={`${seg.label}: ${seg.value}${unit}`}
                          >
                            {pct >= 11 ? `${seg.value}${unit}` : ""}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-7 sm:h-9 w-1.5 rounded bg-gray-100" />
                  )}
                </div>

                {/* Total */}
                <span className="shrink-0 text-[11px] sm:text-[13px] font-bold text-[#0F172A] w-8 sm:w-10 text-right tabular-nums">
                  {total}{unit}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
