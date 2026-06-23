"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { StatusSlice } from "../../constants/statusChart";

interface Props {
  data: StatusSlice[];
  title?: string;
}

export default function ChartPieSide({ data, title }: Props) {
  return (
    <div className="flex flex-col items-center">
      {title && (
        <p className="text-xs sm:text-[13px] font-semibold text-gray-600 mb-2 text-center">{title}</p>
      )}
      <div className="w-44 h-44 sm:w-52 sm:h-52 lg:w-56 lg:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              formatter={(value, name) => [`${value} Leads`, name]}
              contentStyle={{ borderRadius: "14px", border: "1px solid #eee", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
            />
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius="100%"
              paddingAngle={3}
              dataKey="value"
            >
              {data.map(slice => (
                <Cell key={slice.name} fill={slice.color} stroke="#fff" strokeWidth={2} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
