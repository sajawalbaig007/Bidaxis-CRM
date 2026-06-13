"use client";

import { useEffect, useState } from "react";

const US_ZONES = [
  { tz: "America/New_York",    label: "Eastern",  abbr: "ET", city: "New York"    },
  { tz: "America/Chicago",     label: "Central",  abbr: "CT", city: "Chicago"     },
  { tz: "America/Denver",      label: "Mountain", abbr: "MT", city: "Denver"      },
  { tz: "America/Los_Angeles", label: "Pacific",  abbr: "PT", city: "Los Angeles" },
];

function getHandAngles(tz: string) {
  const now   = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", minute: "numeric", second: "numeric", hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? "0");
  const h = get("hour") % 12;
  const m = get("minute");
  const s = get("second");
  return {
    hour:   (h * 30)  + (m * 0.5),
    minute: m * 6,
    second: s * 6,
  };
}

function handPoint(cx: number, cy: number, angleDeg: number, length: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + length * Math.cos(rad), y: cy + length * Math.sin(rad) };
}

function AnalogClock({ tz }: { tz: string }) {
  const [angles, setAngles] = useState(() => getHandAngles(tz));

  useEffect(() => {
    const id = setInterval(() => setAngles(getHandAngles(tz)), 1000);
    return () => clearInterval(id);
  }, [tz]);

  const cx = 30; const cy = 30; const r = 26;
  const h = handPoint(cx, cy, angles.hour,   15);
  const m = handPoint(cx, cy, angles.minute, 20);
  const s = handPoint(cx, cy, angles.second, 21);

  return (
    <svg width="60" height="60" viewBox="0 0 60 60" className="shrink-0">
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="white" stroke="#E5E7EB" strokeWidth="2" />
      {/* Hour tick marks */}
      {[...Array(12)].map((_, i) => {
        const a   = (i * 30 - 90) * (Math.PI / 180);
        const isQ = i % 3 === 0;
        const x1  = cx + (r - (isQ ? 6 : 4)) * Math.cos(a);
        const y1  = cy + (r - (isQ ? 6 : 4)) * Math.sin(a);
        const x2  = cx + (r - 1) * Math.cos(a);
        const y2  = cy + (r - 1) * Math.sin(a);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={isQ ? "#9CA3AF" : "#D1D5DB"}
            strokeWidth={isQ ? 2 : 1}
            strokeLinecap="round"
          />
        );
      })}
      {/* Hour hand */}
      <line x1={cx} y1={cy} x2={h.x} y2={h.y}
        stroke="#111827" strokeWidth="2.8" strokeLinecap="round" />
      {/* Minute hand */}
      <line x1={cx} y1={cy} x2={m.x} y2={m.y}
        stroke="#374151" strokeWidth="2" strokeLinecap="round" />
      {/* Second hand */}
      <line x1={cx} y1={cy} x2={s.x} y2={s.y}
        stroke="#B8112D" strokeWidth="1.2" strokeLinecap="round" />
      {/* Center cap */}
      <circle cx={cx} cy={cy} r={2.5} fill="#B8112D" />
      <circle cx={cx} cy={cy} r={1}   fill="white" />
    </svg>
  );
}

function DigitalTime({ tz }: { tz: string }) {
  const [str, setStr] = useState("");
  useEffect(() => {
    const fmt = () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: true,
      }).format(new Date());
    setStr(fmt());
    const id = setInterval(() => setStr(fmt()), 1000);
    return () => clearInterval(id);
  }, [tz]);
  return <>{str}</>;
}

export default function UsaTimezoneClocks() {
  return (
    <div className="bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 md:px-5 lg:px-6 py-2 sm:py-3">
        <div className="flex items-center gap-3 sm:gap-5 lg:gap-8 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {US_ZONES.map((zone, idx) => (
            <div key={zone.tz} className="flex items-center gap-2 sm:gap-3 shrink-0">
              <AnalogClock tz={zone.tz} />
              <div>
                <p className="text-[11px] sm:text-xs font-bold text-[#0F172A] leading-none">{zone.city}</p>
                <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5">
                  {zone.label} · <span className="font-semibold text-gray-500">{zone.abbr}</span>
                </p>
                <p className="text-[10px] sm:text-[11px] font-mono font-bold text-[#B8112D] mt-0.5">
                  <DigitalTime tz={zone.tz} />
                </p>
              </div>
              {idx < US_ZONES.length - 1 && (
                <div className="w-px h-10 bg-gray-100 ml-1 sm:ml-2 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
