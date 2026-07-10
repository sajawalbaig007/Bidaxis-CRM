"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { ClientLead } from "./PerformanceChart";

type Props = {
  leads?: ClientLead[];
  distribution?: Record<string, number>;
};

type Slice = { name: string; value: number; color: string };

const COLORS = ["#B8112D", "#F97316", "#14B8A6", "#6366F1", "#10B981", "#8B5CF6", "#EC4899", "#64748B"];

export default function OverviewChart({ leads = [], distribution }: Props) {
  const data = useMemo<Slice[]>(() => {
    if (distribution) {
      return Object.entries(distribution)
        .filter(([, v]) => v > 0)
        .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
    }
    const counts: Record<string, number> = {
      Pending: 0, Important: 0, Interested: 0, "Close Client": 0, Closed: 0,
    };
    leads.forEach(l => {
      const s = l.status ?? "";
      if (s === "pending")          counts["Pending"]++;
      else if (s === "important")   counts["Important"]++;
      else if (s === "interested")  counts["Interested"]++;
      else if (s === "Close Client") counts["Close Client"]++;
      else if (["closed","completed","not completed","Not Interested","not picked"].includes(s))
        counts["Closed"]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  }, [leads, distribution]);

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col h-full min-h-[200px]">
      <div className="mb-3">
        <h2 className="text-sm font-bold text-gray-800">Lead Overview</h2>
        <p className="text-xs text-gray-400">Pipeline breakdown · {total.toLocaleString()} total</p>
      </div>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 flex-1 min-h-0">
        <div className="relative shrink-0 w-[140px] h-[140px] sm:w-[150px] sm:h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(value, name) => [`${Number(value).toLocaleString()} leads`, name]}
                contentStyle={{ borderRadius: "12px", border: "1px solid #eee", boxShadow: "0 8px 24px rgba(0,0,0,0.08)" }}
              />
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={68}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((item, i) => (
                  <Cell key={i} fill={item.color} stroke="transparent" />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-extrabold text-gray-800 leading-none">
              {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
            </span>
            <span className="text-[10px] text-gray-400 font-medium mt-0.5">leads</span>
          </div>
        </div>

        <div className="flex-1 w-full min-w-0 grid grid-cols-2 gap-x-3 gap-y-1.5 content-start">
          {data.map((item, i) => {
            const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
            return (
              <div key={i} className="flex items-center gap-2 min-w-0 py-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-gray-600 truncate leading-tight">{item.name}</p>
                  <p className="text-xs font-bold text-gray-800 tabular-nums">
                    {item.value.toLocaleString()}
                    <span className="text-[10px] font-normal text-gray-400 ml-1">{pct}%</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
