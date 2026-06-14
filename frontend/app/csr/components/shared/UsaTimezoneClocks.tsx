"use client";

import { useEffect, useState } from "react";
import { Globe, X } from "lucide-react";

const US_ZONES = [
  { tz: "America/New_York",    label: "Eastern",  abbr: "ET", city: "New York"    },
  { tz: "America/Chicago",     label: "Central",  abbr: "CT", city: "Chicago"     },
  { tz: "America/Denver",      label: "Mountain", abbr: "MT", city: "Denver"      },
  { tz: "America/Los_Angeles", label: "Pacific",  abbr: "PT", city: "Los Angeles" },
];

const MAP_ZONES = [
  {
    abbr: "PT", label: "Pacific Time", hours: "UTC −8/−7",
    colorBg: "bg-purple-50", colorBorder: "border-purple-200",
    colorText: "text-purple-800", colorHeader: "bg-purple-100",
    states: ["WA","OR","CA","NV"],
    canada: ["BC","YT"],
  },
  {
    abbr: "MT", label: "Mountain Time", hours: "UTC −7/−6",
    colorBg: "bg-orange-50", colorBorder: "border-orange-200",
    colorText: "text-orange-800", colorHeader: "bg-orange-100",
    states: ["MT","ID","WY","CO","UT","NM","AZ*"],
    canada: ["AB","NT"],
    note: "* AZ = MST (no DST)",
  },
  {
    abbr: "CT", label: "Central Time", hours: "UTC −6/−5",
    colorBg: "bg-green-50", colorBorder: "border-green-200",
    colorText: "text-green-800", colorHeader: "bg-green-100",
    states: ["ND","SD","NE","KS","MN","IA","MO","WI","IL","AR","LA","OK","TX","MS","AL","TN"],
    canada: ["SK","MB"],
  },
  {
    abbr: "ET", label: "Eastern Time", hours: "UTC −5/−4",
    colorBg: "bg-blue-50", colorBorder: "border-blue-200",
    colorText: "text-blue-800", colorHeader: "bg-blue-100",
    states: ["ME","NH","VT","MA","RI","CT","NY","NJ","PA","DE","MD","DC","VA","WV","NC","SC","GA","FL","OH","MI","IN","KY"],
    canada: ["ON","QC","NB","NS","PE"],
  },
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
      <circle cx={cx} cy={cy} r={r} fill="white" stroke="#E5E7EB" strokeWidth="2" />
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
      <line x1={cx} y1={cy} x2={h.x} y2={h.y} stroke="#111827" strokeWidth="2.8" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={m.x} y2={m.y} stroke="#374151" strokeWidth="2"   strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={s.x} y2={s.y} stroke="#B8112D" strokeWidth="1.2" strokeLinecap="round" />
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
    void (async () => { await Promise.resolve(); setStr(fmt()); })();
    const id = setInterval(() => setStr(fmt()), 1000);
    return () => clearInterval(id);
  }, [tz]);
  return <>{str}</>;
}

function TimezoneMapModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[860px] max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Globe size={17} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">US & Canada Timezone Map</h2>
              <p className="text-[11px] text-gray-400">Reference for identifying which state is in which timezone</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 sm:p-6 space-y-4">

          {/* Visual map — timezone bands */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">← West to East →</p>
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              {MAP_ZONES.map((z, i) => (
                <div
                  key={z.abbr}
                  className={`flex-1 ${z.colorHeader} flex flex-col items-center justify-center py-3 sm:py-4 ${i < MAP_ZONES.length - 1 ? "border-r border-gray-200" : ""}`}
                >
                  <span className={`text-lg sm:text-2xl font-black ${z.colorText}`}>{z.abbr}</span>
                  <span className={`text-[9px] sm:text-[10px] font-medium ${z.colorText} opacity-70 mt-0.5 hidden sm:block`}>{z.hours}</span>
                </div>
              ))}
            </div>
            <div className="flex mt-0.5">
              {MAP_ZONES.map((z, i) => (
                <div key={z.abbr} className={`flex-1 text-center ${i < MAP_ZONES.length - 1 ? "border-r border-transparent" : ""}`}>
                  <span className={`text-[9px] ${z.colorText} opacity-60 sm:hidden`}>{z.hours}</span>
                </div>
              ))}
            </div>
          </div>

          {/* State columns */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {MAP_ZONES.map(z => (
              <div key={z.abbr} className={`rounded-xl border ${z.colorBorder} ${z.colorBg} p-3 sm:p-3.5`}>
                <div className="flex items-baseline gap-1.5 mb-2.5">
                  <span className={`font-black text-sm ${z.colorText}`}>{z.abbr}</span>
                  <span className={`text-[10px] ${z.colorText} opacity-60 hidden sm:inline`}>{z.label}</span>
                </div>

                {/* US States */}
                <p className={`text-[9px] font-semibold uppercase tracking-wide ${z.colorText} opacity-50 mb-1`}>US States</p>
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {z.states.map(s => (
                    <span key={s} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/70 ${z.colorText}`}>{s}</span>
                  ))}
                </div>

                {/* Canada */}
                <p className={`text-[9px] font-semibold uppercase tracking-wide ${z.colorText} opacity-50 mb-1`}>Canada</p>
                <div className="flex flex-wrap gap-1">
                  {z.canada.map(s => (
                    <span key={s} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/40 ${z.colorText} opacity-80`}>{s}</span>
                  ))}
                </div>

                {z.note && (
                  <p className={`text-[9px] ${z.colorText} opacity-60 mt-2 italic`}>{z.note}</p>
                )}
              </div>
            ))}
          </div>

          {/* Alaska + Hawaii */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 sm:p-3.5">
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="font-black text-sm text-teal-800">AKT</span>
                <span className="text-[10px] text-teal-700 opacity-70">Alaska Time</span>
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-teal-700 opacity-50 mb-1">UTC −9/−8</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/70 text-teal-800">AK — Alaska</span>
            </div>
            <div className="rounded-xl border border-pink-200 bg-pink-50 p-3 sm:p-3.5">
              <div className="flex items-baseline gap-1.5 mb-1.5">
                <span className="font-black text-sm text-pink-800">HST</span>
                <span className="text-[10px] text-pink-700 opacity-70">Hawaii Time</span>
              </div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-pink-700 opacity-50 mb-1">UTC −10 (no DST)</p>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-white/70 text-pink-800">HI — Hawaii</span>
            </div>
          </div>

          {/* MST note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-[11px] text-amber-800">
              <span className="font-bold">⚠ Arizona (AZ)</span> uses Mountain Standard Time (MST) year-round and does <span className="font-semibold">not</span> observe Daylight Saving Time.
            </p>
          </div>

          {/* Canada full note */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Canada — Full Reference</p>
            <div className="space-y-1">
              {[
                { label: "Pacific (PT)",    val: "British Columbia (BC), Yukon (YT)" },
                { label: "Mountain (MT)",   val: "Alberta (AB), Northwest Territories (NT)" },
                { label: "Central (CT)",    val: "Saskatchewan (SK), Manitoba (MB)" },
                { label: "Eastern (ET)",    val: "Ontario (ON), Quebec (QC)" },
                { label: "Atlantic (AT)",   val: "New Brunswick (NB), Nova Scotia (NS), Prince Edward Island (PE) — UTC −4/−3" },
                { label: "Newfoundland",    val: "Newfoundland & Labrador (NL) — UTC −3:30/−2:30" },
              ].map(row => (
                <div key={row.label} className="flex gap-2 text-[11px]">
                  <span className="font-semibold text-gray-600 shrink-0 w-[110px]">{row.label}</span>
                  <span className="text-gray-500">{row.val}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default function UsaTimezoneClocks() {
  const [showMap, setShowMap] = useState(false);

  return (
    <>
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

            {/* Map button */}
            <div className="ml-auto shrink-0 pl-2 sm:pl-4">
              <button
                onClick={() => setShowMap(true)}
                className="flex items-center gap-1.5 h-8 sm:h-9 px-3 sm:px-4 rounded-xl bg-blue-50 text-blue-600 text-[11px] sm:text-xs font-semibold border border-blue-100 hover:bg-blue-100 transition-colors whitespace-nowrap"
                title="View US & Canada timezone map"
              >
                <Globe size={13} />
                <span className="hidden sm:inline">Timezone Map</span>
                <span className="sm:hidden">Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showMap && <TimezoneMapModal onClose={() => setShowMap(false)} />}
    </>
  );
}
