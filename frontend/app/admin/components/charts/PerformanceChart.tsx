"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area,
  CartesianGrid, Tooltip, XAxis, YAxis,
} from "recharts";

/* ─── TYPES ─── */
export type ClientLead = {
  id?: string;
  name?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  csr?: { name?: string };
};

type Props = { leads: ClientLead[]; range?: string };

type DataPoint = { label: string; calls: number };
  
/* ─── FUNCTIONS ─── */
function groupLeads(leads: ClientLead[], range: string): DataPoint[] {
  const now   = new Date();
  const buckets: Record<string, number> = {};

  const fmt = (d: Date) => {
    if (range === "today") return d.getHours() + ":00";
    if (range === "year")  return d.toLocaleString("default", { month: "short" });
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  if (range === "today") {
    for (let h = 0; h < 24; h += 3) buckets[h + ":00"] = 0;
  } else if (range === "week") {
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(now); dt.setDate(dt.getDate() - d);
      buckets[fmt(dt)] = 0;
    }
  } else if (range === "month") {
    for (let d = 29; d >= 0; d -= 5) {
      const dt = new Date(now); dt.setDate(dt.getDate() - d);
      buckets[fmt(dt)] = 0;
    }
  } else {
    for (let m = 11; m >= 0; m--) {
      const dt = new Date(now); dt.setMonth(dt.getMonth() - m);
      buckets[fmt(dt)] = 0;
    }
  }

  leads.forEach(lead => {
    if (!lead.createdAt) return;
    const key = fmt(new Date(lead.createdAt));
    if (key in buckets) buckets[key]++;
  });

  return Object.entries(buckets).map(([label, calls]) => ({ label, calls }));
}

export default function PerformanceChart({ leads, range = "week" }: Props) {
  const data = useMemo(() => groupLeads(leads, range), [leads, range]);

  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="mainGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#B8112D" stopOpacity={0.28}/>
              <stop offset="100%" stopColor="#B8112D" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#F1F1F1" strokeDasharray="4 4"/>
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill:"#9CA3AF", fontSize:13 }}/>
          <YAxis tickLine={false} axisLine={false} tick={{ fill:"#9CA3AF", fontSize:13 }}/>
          <Tooltip contentStyle={{ borderRadius:"16px", border:"1px solid #eee", boxShadow:"0 10px 30px rgba(0,0,0,0.08)" }}/>
          <Area
            type="monotone" dataKey="calls"
            stroke="#B8112D" strokeWidth={4}
            fill="url(#mainGradient)"
            dot={{ r:0 }}
            activeDot={{ r:6, fill:"#B8112D", stroke:"#fff", strokeWidth:3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
