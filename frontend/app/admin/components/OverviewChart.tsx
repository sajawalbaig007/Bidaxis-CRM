"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import API from "@/lib/api";

type Props = { refreshTrigger?: number };
type Slice = { name: string; value: number; color: string };

const COLORS = ["#B8112D", "#F97316", "#14B8A6", "#6366F1", "#10B981"];

export default function OverviewChart({ refreshTrigger }: Props) {
  const [data,    setData]    = useState<Slice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res   = await API.get("/admin/clients");
        const leads: { status?: string }[] = res.data.leads ?? [];

        const counts: Record<string, number> = {
          Pending:      0,
          Important:    0,
          Interested:   0,
          "Project Won":0,
          Closed:       0,
        };

        leads.forEach(l => {
          const s = l.status ?? "";
          if (s === "pending")      counts["Pending"]++;
          else if (s === "important")   counts["Important"]++;
          else if (s === "interested")  counts["Interested"]++;
          else if (s === "project won") counts["Project Won"]++;
          else if (["closed","completed","not completed","Not Interested","not picked"].includes(s)) counts["Closed"]++;
        });

        const slices: Slice[] = Object.entries(counts)
          .filter(([, v]) => v > 0)
          .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));

        setData(slices);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [refreshTrigger]);

  return (
    <div className="flex flex-col h-full">
      <div>
        <h2 className="text-xl font-semibold text-gray-800">Today's Overview</h2>
        <p className="text-sm text-gray-400 mt-1">Lead status distribution</p>
      </div>

      {loading ? (
        <div className="w-[210px] h-[210px] rounded-full bg-gray-100 animate-pulse mx-auto mt-4"/>
      ) : (
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
      )}

      <div className="space-y-2 mt-auto">
        {loading
          ? [1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse"/>)
          : data.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-[#F8F9FC] rounded-xl px-4 py-3 border border-transparent hover:border-gray-200 transition-all">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}/>
                <p className="text-sm text-gray-600">{item.name}</p>
              </div>
              <h3 className="font-semibold text-gray-800 text-sm">{item.value}</h3>
            </div>
          ))
        }
      </div>
    </div>
  );
}