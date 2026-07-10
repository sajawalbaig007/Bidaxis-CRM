"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { ClientLead } from "./PerformanceChart";

type Props = {
  leads?: ClientLead[];
  distribution?: Record<string, number>;
};
/* ─── TYPES ─── */
type Slice = { name: string; value: number; color: string };

const COLORS = ["#B8112D", "#F97316", "#14B8A6", "#6366F1", "#10B981"];

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

  return (
    <div className="flex flex-col h-full">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Lead Overview</h2>
        <p className="text-sm text-gray-400 mt-1">Pipeline status breakdown</p>
      </div>

      <div className="flex justify-center mt-2">
        <div className="w-[210px] h-[210px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                formatter={(value, name) => [`${value} Leads`, name]}
                contentStyle={{ borderRadius:"14px", border:"1px solid #eee", boxShadow:"0 10px 30px rgba(0,0,0,0.08)" }}
              />
              <Pie data={data} cx="50%" cy="50%" innerRadius={58} outerRadius={82} paddingAngle={4} dataKey="value">
                {data.map((item, i) => (
                  <Cell key={i} fill={item.color} stroke="transparent"/>
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2 mt-auto">
        {data.map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-[#F8F9FC] rounded-xl px-4 py-3 border border-transparent hover:border-gray-200 transition-all">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}/>
              <p className="text-sm text-gray-600">{item.name}</p>
            </div>
            <h3 className="font-semibold text-gray-800 text-sm">{item.value}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}
