"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { useSyncExternalStore } from "react";

type BinChartPoint = { name: string; value: number };

function useIsMobile() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(max-width: 640px)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 640px)").matches,
    () => false,
  );
}

export default function BinStatsChart({
  loading,
  data,
}: {
  loading: boolean;
  data: BinChartPoint[];
}) {
  const isMobile = useIsMobile();

  if (loading) {
    return <div className="h-full min-h-[100px] bg-gray-50 dark:bg-gray-800 rounded-2xl animate-pulse" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={100}>
      <BarChart data={data} barSize={isMobile ? 28 : 44} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: isMobile ? 9 : 11, fill: "#6B7280", fontWeight: 600 }}
          interval={0}
          angle={isMobile ? -25 : 0}
          textAnchor={isMobile ? "end" : "middle"}
          height={isMobile ? 48 : 30}
        />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#9CA3AF" }} width={isMobile ? 24 : 28} />
        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Count">
          {["#F59E0B", "#B8112D", "#6366F1", "#6B7280"].map((fill, i) => (
            <Cell key={i} fill={fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
