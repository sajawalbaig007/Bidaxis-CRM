"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area,
  CartesianGrid, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  addDaysToYmd,
  businessHourBucketKey,
  currentBusinessYmd,
  fmtMonthShortFromYmd,
  fmtShortDateFromYmd,
  fmtWeekDayFromYmd,
  getBusinessYmd,
  initBusinessHourBuckets,
  isSameBusinessDay,
} from "@/lib/businessCalendar";

export type ClientLead = {
  id?: string;
  name?: string;
  company?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  csr?: { name?: string };
};

type DataPoint = { label: string; calls: number };

type Props = {
  leads?: ClientLead[];
  series?: DataPoint[];
  range?: string;
};

function groupLeads(leads: ClientLead[], range: string): DataPoint[] {
  const now = new Date();
  const currentBiz = currentBusinessYmd(now);

  if (range === "today") {
    const buckets = initBusinessHourBuckets();
    leads.forEach(lead => {
      if (!lead.createdAt) return;
      const dt = new Date(lead.createdAt);
      if (!isSameBusinessDay(dt, now)) return;
      const key = businessHourBucketKey(dt);
      if (key in buckets) buckets[key]++;
    });
    return Object.entries(buckets).map(([label, calls]) => ({ label, calls }));
  }

  if (range === "week") {
    const buckets: Record<string, number> = {};
    const labels: Record<string, string> = {};
    for (let d = 6; d >= 0; d--) {
      const ymd = addDaysToYmd(currentBiz, -d);
      buckets[ymd] = 0;
      labels[ymd] = fmtWeekDayFromYmd(ymd);
    }
    leads.forEach(lead => {
      if (!lead.createdAt) return;
      const ymd = getBusinessYmd(new Date(lead.createdAt));
      if (ymd in buckets) buckets[ymd]++;
    });
    return Object.keys(buckets).map(k => ({ label: labels[k] ?? k, calls: buckets[k] ?? 0 }));
  }

  if (range === "month") {
    const buckets: Record<string, number> = {};
    const labels: Record<string, string> = {};
    for (let d = 28; d >= 0; d -= 7) {
      const ymd = addDaysToYmd(currentBiz, -d);
      buckets[ymd] = 0;
      labels[ymd] = fmtShortDateFromYmd(ymd);
    }
    const monthKeys = Object.keys(buckets);
    leads.forEach(lead => {
      if (!lead.createdAt) return;
      const bizYmd = getBusinessYmd(new Date(lead.createdAt));
      let chosen = monthKeys[0]!;
      for (const key of monthKeys) {
        if (key <= bizYmd) chosen = key;
      }
      if (chosen in buckets) buckets[chosen]++;
    });
    return Object.keys(buckets).map(k => ({ label: labels[k] ?? k, calls: buckets[k] ?? 0 }));
  }

  const buckets: Record<string, number> = {};
  const labels: Record<string, string> = {};
  const seen = new Set<string>();
  for (let d = 364; d >= 0; d -= 28) {
    const ymd = addDaysToYmd(currentBiz, -d);
    const month = fmtMonthShortFromYmd(ymd);
    if (seen.has(month)) continue;
    seen.add(month);
    buckets[ymd] = 0;
    labels[ymd] = month;
  }
  const yearKeys = Object.keys(buckets);
  leads.forEach(lead => {
    if (!lead.createdAt) return;
    const bizYmd = getBusinessYmd(new Date(lead.createdAt));
    const month = fmtMonthShortFromYmd(bizYmd);
    const key = yearKeys.find(k => fmtMonthShortFromYmd(k) === month);
    if (key && key in buckets) buckets[key]++;
  });
  return Object.keys(buckets).map(k => ({ label: labels[k] ?? k, calls: buckets[k] ?? 0 }));
}

export default function PerformanceChart({ leads = [], series, range = "week" }: Props) {
  const data = useMemo(() => {
    if (series && series.length > 0) return series;
    return groupLeads(leads, range);
  }, [series, leads, range]);

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
          <YAxis tickLine={false} axisLine={false} tick={{ fill:"#9CA3AF", fontSize:13 }} allowDecimals={false}/>
          <Tooltip
            formatter={(value) => [`${value} calls`, "Activity"]}
            contentStyle={{ borderRadius:"16px", border:"1px solid #eee", boxShadow:"0 10px 30px rgba(0,0,0,0.08)" }}
          />
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
