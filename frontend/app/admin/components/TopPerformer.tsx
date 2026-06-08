"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, Star } from "lucide-react";
import API from "@/lib/api";

type Props = { refreshTrigger?: number };

type Performer = {
  name:     string;
  resolved: number;
  total:    number;
  rate:     number;   // completion %
};

export default function TopPerformers({ refreshTrigger }: Props) {
  const [performers, setPerformers] = useState<Performer[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res   = await API.get("/admin/clients");
        const leads: { status?: string; csr?: { name?: string } }[] = res.data.leads ?? [];

        /* Group leads by CSR name */
        const map: Record<string, { resolved: number; total: number }> = {};

        leads.forEach(l => {
          const name = l.csr?.name ?? "Unassigned";
          if (!map[name]) map[name] = { resolved: 0, total: 0 };
          map[name].total++;
          if (["Close Client", "interested", "important"].includes(l.status ?? ""))
            map[name].resolved++;
        });

        const sorted = Object.entries(map)
          .map(([name, { resolved, total }]) => ({
            name,
            resolved,
            total,
            rate: total > 0 ? Math.round((resolved / total) * 100) : 0,
          }))
          .sort((a, b) => b.resolved - a.resolved)
          .slice(0, 5);

        setPerformers(sorted);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [refreshTrigger]);

  const rankStyle = (i: number) => {
    if (i === 0) return "bg-gradient-to-r from-amber-400 to-amber-500";
    if (i === 1) return "bg-gradient-to-r from-gray-400 to-gray-500";
    if (i === 2) return "bg-gradient-to-r from-amber-600 to-amber-700";
    return "bg-gradient-to-r from-blue-400 to-blue-500";
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">Top Performers</h3>
        <Trophy size={18} className="text-amber-500"/>
      </div>

      <div className="space-y-3">
        {loading
          ? [1,2,3].map(i => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0 animate-pulse"/>
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-gray-100 rounded w-32 animate-pulse"/>
                <div className="h-3 bg-gray-100 rounded w-20 animate-pulse"/>
              </div>
            </div>
          ))
          : performers.length === 0
          ? <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
          : performers.map((p, i) => (
            <div key={p.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${rankStyle(i)}`}>
                  {i + 1}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-800">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.resolved} resolved · {p.total} total</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                <p className="text-sm font-semibold text-green-600">{p.rate}%</p>
                {p.rate >= 50
                  ? <TrendingUp size={14} className="text-green-500"/>
                  : <Star      size={14} className="text-gray-400"/>
                }
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}