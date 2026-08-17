"use client";

import { useMemo, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  PolarAngleAxis, PolarGrid, Radar, RadarChart, Tooltip, XAxis, YAxis,
} from "recharts";
import { Activity, Percent, Star, TrendingUp, Users } from "lucide-react";
import RechartsBox from "@/app/components/charts/RechartsBox";
import UploadActionBento from "@/app/admin/components/uploads/UploadActionBento";

export type KpiChartRow = {
  name: string;
  fullName: string;
  projects_delivered: number;
  productivity: number;
  retained_clients: number;
  punctuality: number;
  team_query_mistakes: number;
  marks_out_of_10: number;
  rating_stars: number;
};

const TIP = { borderRadius: 12, fontSize: 12, border: "1px solid #eee" } as const;
const DONUT = ["#B8112D", "#0B84F3", "#D97706", "#059669", "#7C3AED", "#38BDF8"];

function ChartCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 p-3 sm:p-4 flex flex-col">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{eyebrow}</p>
      <h3 className="text-sm sm:text-base font-bold text-[#0F172A] mb-1">{title}</h3>
      <div className="flex-1 min-h-[160px]">{children}</div>
    </div>
  );
}

export default function KpiChartsBento({
  rows,
  periodLabel,
}: {
  rows: KpiChartRow[];
  periodLabel: string;
}) {
  const totals = useMemo(() => {
    const n = Math.max(1, rows.length);
    const sum = (k: keyof KpiChartRow) =>
      rows.reduce((s, r) => s + (typeof r[k] === "number" ? Number(r[k]) : 0), 0);
    return {
      delivered: sum("projects_delivered"),
      retained: sum("retained_clients"),
      mistakes: sum("team_query_mistakes"),
      avgProd: Math.round(sum("productivity") / n),
      avgMarks: Math.round((sum("marks_out_of_10") / n) * 10) / 10,
      avgStars: Math.round((sum("rating_stars") / n) * 10) / 10,
      avgPunct: Math.round(sum("punctuality") / n),
    };
  }, [rows]);

  const donut = useMemo(() => {
    const data = [
      { name: "Delivered", value: totals.delivered, color: DONUT[0] },
      { name: "Retained", value: totals.retained, color: DONUT[1] },
      { name: "Mistakes", value: totals.mistakes, color: DONUT[2] },
    ].filter((d) => d.value > 0);
    return data.length ? data : [{ name: "No data", value: 1, color: "#E5E7EB" }];
  }, [totals]);

  const radar = useMemo(
    () => [
      { metric: "Marks", value: Math.min(10, totals.avgMarks) },
      { metric: "Stars×2", value: Math.min(10, totals.avgStars * 2) },
      { metric: "Prod /10", value: Math.min(10, totals.avgProd / 10) },
      { metric: "Punct /10", value: Math.min(10, totals.avgPunct / 10) },
      { metric: "Delivered", value: Math.min(10, totals.delivered) },
    ],
    [totals],
  );

  const maxMarks = Math.max(1, ...rows.map((r) => r.marks_out_of_10));

  const items = useMemo(
    () => [
      {
        id: "delivered",
        label: "Delivered",
        shortLabel: "Done",
        accent: "#B8112D",
        content: (
          <ChartCard eyebrow="Volume" title="Projects delivered">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No data</p>
            ) : (
              <RechartsBox height={180}>
                <BarChart data={rows} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={TIP} labelFormatter={(_, p) => String(p?.[0]?.payload?.fullName ?? "")} />
                  <Bar dataKey="projects_delivered" fill="#B8112D" radius={[8, 8, 0, 0]} maxBarSize={28} />
                </BarChart>
              </RechartsBox>
            )}
          </ChartCard>
        ),
      },
      {
        id: "productivity",
        label: "Productivity",
        shortLabel: "Prod %",
        accent: "#0B84F3",
        content: (
          <ChartCard eyebrow="Efficiency" title="Productivity %">
            {rows.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">No data</p>
            ) : (
              <RechartsBox height={180}>
                <AreaChart data={rows}>
                  <defs>
                    <linearGradient id="kpiProdFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0B84F3" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#0B84F3" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip contentStyle={TIP} formatter={(v) => [`${v}%`, "Productivity"]} />
                  <Area type="monotone" dataKey="productivity" stroke="#0B84F3" strokeWidth={2} fill="url(#kpiProdFill)" />
                </AreaChart>
              </RechartsBox>
            )}
          </ChartCard>
        ),
      },
      {
        id: "radar",
        label: "Balance",
        shortLabel: "Radar",
        accent: "#7C3AED",
        content: (
          <ChartCard eyebrow="Shape" title="Evaluation radar">
            <RechartsBox height={190}>
              <RadarChart data={radar} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#E2E8F0" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "#64748B" }} />
                <Radar dataKey="value" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.28} />
                <Tooltip contentStyle={TIP} />
              </RadarChart>
            </RechartsBox>
          </ChartCard>
        ),
      },
      {
        id: "mix",
        label: "Mix",
        shortLabel: "Donut",
        accent: "#D97706",
        content: (
          <ChartCard eyebrow="Share" title="Delivered · retained · mistakes">
            <RechartsBox height={170}>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                  {donut.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TIP} />
              </PieChart>
            </RechartsBox>
            <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              {donut.filter((d) => d.name !== "No data").map((d) => (
                <span key={d.name} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-50 text-[10px] font-semibold text-gray-600">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color }} />
                  {d.name} {d.value}
                </span>
              ))}
            </div>
          </ChartCard>
        ),
      },
      {
        id: "pulse",
        label: "Pulse",
        shortLabel: "Pulse",
        accent: "#059669",
        content: (
          <div className="flex-1 min-h-0 flex flex-col gap-3 p-3 sm:p-4">
            <div className="rounded-[1.25rem] bg-[#38BDF8] text-white p-4 shadow-md shadow-sky-200/50">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Snapshot · {periodLabel}</p>
                <Activity size={16} />
              </div>
              <p className="text-3xl font-bold mt-1 tabular-nums">{totals.avgMarks || "—"}</p>
              <p className="text-xs text-white/85">Avg marks / 10</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <span className="rounded-2xl bg-white/20 px-2 py-2 text-center">
                  <p className="text-base font-bold tabular-nums inline-flex items-center justify-center gap-0.5">
                    <TrendingUp size={12} /> {totals.avgProd}%
                  </p>
                  <p className="text-[9px] uppercase tracking-wide text-white/80">Prod</p>
                </span>
                <span className="rounded-2xl bg-white/20 px-2 py-2 text-center">
                  <p className="text-base font-bold tabular-nums inline-flex items-center justify-center gap-0.5">
                    <Star size={12} /> {totals.avgStars}
                  </p>
                  <p className="text-[9px] uppercase tracking-wide text-white/80">Stars</p>
                </span>
                <span className="rounded-2xl bg-white/20 px-2 py-2 text-center">
                  <p className="text-base font-bold tabular-nums inline-flex items-center justify-center gap-0.5">
                    <Users size={12} /> {totals.retained}
                  </p>
                  <p className="text-[9px] uppercase tracking-wide text-white/80">Retain</p>
                </span>
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-gray-100 bg-white p-3 flex-1 min-h-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 inline-flex items-center gap-1">
                <Percent size={12} /> Marks split
              </p>
              {rows.length === 0 ? (
                <p className="text-xs text-gray-400">No estimators</p>
              ) : (
                <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                  {rows.slice(0, 8).map((r) => (
                    <div key={r.fullName}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-gray-700 truncate max-w-[70%]">{r.fullName}</span>
                        <span className="tabular-nums font-bold text-[#B8112D]">{r.marks_out_of_10 || "—"}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#B8112D] to-[#F43F5E]"
                          style={{ width: `${Math.max(6, (r.marks_out_of_10 / maxMarks) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ),
      },
    ],
    [rows, donut, radar, totals, periodLabel, maxMarks],
  );

  return (
    <UploadActionBento
      title="KPI graphs"
      subtitle="Shuffle like Uploads — tap a capsule or card to focus. Each tile is a different chart."
      replayLabel="Replay shuffle"
      items={items}
    />
  );
}
