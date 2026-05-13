// ===============================
// components/admin/PerformanceChart.tsx
// ===============================

"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const data = [
  { month: "Jan", calls: 1200 },
  { month: "Feb", calls: 2100 },
  { month: "Mar", calls: 1800 },
  { month: "Apr", calls: 2600 },
  { month: "May", calls: 2200 },
];

export default function PerformanceChart() {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-6 h-full">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">

        <div>

          <h2 className="text-xl font-semibold text-gray-800">
            Call Performance
          </h2>

          <p className="text-sm text-gray-400 mt-1">
            Weekly analytics overview
          </p>

        </div>

        <button className="bg-[#F8ECEF] text-[#B8112D] px-4 py-2 rounded-xl text-sm font-medium">
          This Month
        </button>

      </div>

      {/* CHART */}
      <div className="h-[320px]">

        <ResponsiveContainer width="100%" height="100%">

          <AreaChart data={data}>

            <defs>

              <linearGradient
                id="mainGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >

                <stop
                  offset="0%"
                  stopColor="#B8112D"
                  stopOpacity={0.28}
                />

                <stop
                  offset="100%"
                  stopColor="#B8112D"
                  stopOpacity={0}
                />

              </linearGradient>

            </defs>

            <CartesianGrid
              vertical={false}
              stroke="#F1F1F1"
              strokeDasharray="4 4"
            />

            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "#9CA3AF",
                fontSize: 13,
              }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "#9CA3AF",
                fontSize: 13,
              }}
            />

            <Tooltip
              contentStyle={{
                borderRadius: "16px",
                border: "1px solid #eee",
                boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
              }}
            />

            <Area
              type="monotone"
              dataKey="calls"
              stroke="#B8112D"
              strokeWidth={4}
              fill="url(#mainGradient)"
              dot={{
                r: 0,
              }}
              activeDot={{
                r: 6,
                fill: "#B8112D",
                stroke: "#fff",
                strokeWidth: 3,
              }}
            />

          </AreaChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}