"use client";

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const PHASE_PIE_COLORS: Record<string, string> = {
  not_started:       "#9CA3AF",
  takeoff_started:   "#3B82F6",
  takeoff_completed: "#6366F1",
  pricing_phase:     "#F59E0B",
  qa_phase:          "#8B5CF6",
  delivery_phase:    "#10B981",
};

export type PhasePieItem = { name: string; value: number; key: string };
export type OverviewStats = { total: number; withBudget: number; thisMonth: number };

export default function ProjectOverviewCharts({
  loading,
  stats,
  phasePieData,
}: {
  loading: boolean;
  stats: OverviewStats;
  phasePieData: PhasePieItem[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Overview</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="shrink-0 h-[180px] w-full sm:w-[180px] min-w-0">
            {loading ? (
              <div className="h-full bg-gray-50 rounded-2xl animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Total Projects", value: Math.max(stats.total, 0.001) },
                      { name: "This Month", value: Math.max(stats.thisMonth, 0.001) },
                      { name: "With Budget", value: Math.max(stats.withBudget, 0.001) },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill="#B8112D" />
                    <Cell fill="#3B82F6" />
                    <Cell fill="#10B981" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    formatter={(_, name) => [
                      name === "Total Projects" ? stats.total :
                      name === "This Month" ? stats.thisMonth :
                      stats.withBudget,
                      String(name),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex-1 w-full grid gap-2">
            {[
              { label: "Total Projects", value: stats.total, color: "bg-[#B8112D]", text: "text-[#B8112D]" },
              { label: "This Month", value: stats.thisMonth, color: "bg-blue-500", text: "text-blue-600" },
              { label: "With Budget", value: stats.withBudget, color: "bg-emerald-500", text: "text-emerald-600" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 bg-[#FAFAFA] rounded-xl px-3 py-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
                <p className="flex-1 text-xs sm:text-sm font-medium text-gray-600">{s.label}</p>
                {loading
                  ? <div className="h-5 w-8 bg-gray-100 rounded animate-pulse" />
                  : <span className={`text-lg font-bold ${s.text}`}>{s.value}</span>
                }
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">By Project Phase</h2>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="shrink-0 h-[180px] w-full sm:w-[180px] min-w-0">
            {loading ? (
              <div className="h-full bg-gray-50 rounded-2xl animate-pulse" />
            ) : phasePieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">
                No project phase data
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={phasePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {phasePieData.map((entry) => (
                      <Cell key={entry.key} fill={PHASE_PIE_COLORS[entry.key] ?? "#B8112D"} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0];
                      return (
                        <div className="bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-md text-xs">
                          <p className="font-semibold text-gray-800">{item.name}</p>
                          <p className="text-[#B8112D] font-bold mt-0.5">Count: {item.value}</p>
                        </div>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="flex-1 w-full grid gap-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 bg-[#FAFAFA] rounded-xl px-3 py-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-200 animate-pulse shrink-0" />
                  <div className="flex-1 h-4 bg-gray-100 rounded animate-pulse" />
                  <div className="h-5 w-8 bg-gray-100 rounded animate-pulse" />
                </div>
              ))
            ) : phasePieData.length === 0 ? (
              <p className="text-xs text-gray-400 text-center sm:text-left">No phases to display</p>
            ) : (
              phasePieData.map((s) => {
                const color = PHASE_PIE_COLORS[s.key] ?? "#B8112D";
                return (
                  <div key={s.key} className="flex items-center gap-3 bg-[#FAFAFA] rounded-xl px-3 py-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <p className="flex-1 text-xs sm:text-sm font-medium text-gray-600">{s.name}</p>
                    <span className="text-lg font-bold" style={{ color }}>{s.value}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}