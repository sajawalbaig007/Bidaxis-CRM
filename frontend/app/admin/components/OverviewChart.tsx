// ===============================
// components/admin/OverviewChart.tsx
// ===============================

"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  {
    name: "Attempted",
    value: 180,
    color: "#B8112D",
  },
  {
    name: "Not Attempted",
    value: 70,
    color: "#F97316",
  },
  {
    name: "Important",
    value: 40,
    color: "#14B8A6",
  },
];

export default function OverviewChart() {
  return (
    <div className="bg-white border border-gray-100 rounded-3xl p-5 h-full flex flex-col">

      {/* HEADER */}
      <div>

        <h2 className="text-xl font-semibold text-gray-800">
          Today's Overview
        </h2>

        <p className="text-sm text-gray-400 mt-1">
          Call distribution summary
        </p>

      </div>

      {/* CHART */}
      <div className="flex justify-center mt-2">

        <div className="w-[210px] h-[210px]">

          <ResponsiveContainer width="100%" height="100%">

            <PieChart>

              <Tooltip
                formatter={(value, name) => [
                  `${value} Calls`,
                  name,
                ]}
                contentStyle={{
                  borderRadius: "14px",
                  border: "1px solid #eee",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                }}
              />

              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={4}
                dataKey="value"
              >

                {data.map((item, index) => (
                  <Cell
                    key={index}
                    fill={item.color}
                    stroke="transparent"
                  />
                ))}

              </Pie>

            </PieChart>

          </ResponsiveContainer>

        </div>

      </div>

      {/* STATS */}
      <div className="space-y-2 mt-auto">

        {data.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-[#F8F9FC] rounded-xl px-4 py-3 border border-transparent hover:border-gray-200 transition-all"
          >

            <div className="flex items-center gap-3">

              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: item.color,
                }}
              />

              <p className="text-sm text-gray-600">
                {item.name}
              </p>

            </div>

            <h3 className="font-semibold text-gray-800 text-sm">
              {item.value}
            </h3>

          </div>
        ))}

      </div>

    </div>
  );
}