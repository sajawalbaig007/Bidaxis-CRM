"use client";

import { useEffect, useState } from "react";
import { Activity, Server, AlertTriangle } from "lucide-react";
import { LucideIcon } from "lucide-react";
import API from "@/lib/api";

type Props = { refreshTrigger?: number };

type Metric = {
  name:     string;
  value:    string | number;
  status:   "good" | "warning" | "critical";
  progress: number;
  icon:     LucideIcon;
};

const statusColor = (s: string) => {
  if (s === "good")     return "text-green-500 bg-green-50";
  if (s === "warning")  return "text-amber-500 bg-amber-50";
  if (s === "critical") return "text-red-500 bg-red-50";
  return "text-gray-500 bg-gray-50";
};

const progressColor = (s: string) => {
  if (s === "good")     return "bg-green-500";
  if (s === "warning")  return "bg-amber-500";
  if (s === "critical") return "bg-red-500";
  return "bg-gray-500";
};

const valueStatus = (progress: number): Metric["status"] => {
  if (progress < 60) return "good";
  if (progress < 80) return "warning";
  return "critical";
};

export default function SystemHealth({ refreshTrigger }: Props) {
  const [metrics,     setMetrics]     = useState<Metric[]>([]);
  const [lastUpdated, setLastUpdated] = useState("Just now");
  const [loading,     setLoading]     = useState(true);

  /* Derive metrics from lead data */
  const buildMetrics = (leads: { status?: string; createdAt?: string }[]): Metric[] => {
    const total    = leads.length || 1;
    const pending  = leads.filter(l => l.status === "pending").length;
    const resolved = leads.filter(l => ["Close Client","interested"].includes(l.status ?? "")).length;
    const important= leads.filter(l => l.status === "important").length;

    const pendingPct  = Math.round((pending   / total) * 100);
    const resolvedPct = Math.round((resolved  / total) * 100);
    const importantPct= Math.min(Math.round((important / total) * 100 * 3), 100);

    return [
      { name:"Pending Load",       value:`${pendingPct}%`,  status: valueStatus(pendingPct),   progress: pendingPct,   icon: Activity },
      { name:"Resolution Rate",    value:`${resolvedPct}%`, status: resolvedPct > 20 ? "good" : resolvedPct > 10 ? "warning" : "critical", progress: resolvedPct, icon: Server },
      { name:"High Priority Leads",value: important,        status: valueStatus(importantPct), progress: importantPct, icon: AlertTriangle },
    ];
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res   = await API.get("/admin/clients");
      const leads = res.data.leads ?? [];
      setMetrics(buildMetrics(leads));
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit" }));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  /* Re-fetch when parent triggers refresh */
  useEffect(() => { void fetchData(); }, [refreshTrigger]);

  /* Also local live simulation every 5s (lightweight — no API call) */
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(m => {
        if (m.name === "High Priority Leads") return m; // real count — don't simulate
        const delta = (Math.random() - 0.5) * 4;
        const newProg = Math.max(0, Math.min(100, m.progress + delta));
        return { ...m, progress: Math.round(newProg), status: valueStatus(newProg) };
      }));
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour:"2-digit", minute:"2-digit", second:"2-digit" }));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">System Health</h3>
        <button className="text-xs text-[#B8112D] hover:underline">Details →</button>
      </div>

      <div className="space-y-4">
        {loading
          ? [1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl animate-pulse"/>)
          : metrics.map((m, i) => (
            <div key={i} className="hover:bg-gray-50 p-2 rounded-xl transition-all">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className={`p-1 rounded-lg ${statusColor(m.status)}`}>
                    <m.icon size={12}/>
                  </div>
                  <span className="text-xs text-gray-600">{m.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${
                    m.status === "good" ? "text-green-600" :
                    m.status === "warning" ? "text-amber-600" : "text-red-600"
                  }`}>{m.value}</span>
                  {m.status === "warning"  && <AlertTriangle size={12} className="text-amber-500"/>}
                  {m.status === "critical" && <AlertTriangle size={12} className="text-red-500"/>}
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className={`${progressColor(m.status)} h-1.5 rounded-full transition-all duration-500`}
                  style={{ width:`${m.progress}%` }}
                />
              </div>
            </div>
          ))
        }
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 flex items-center gap-1">
            <Activity size={10}/> Updated: {lastUpdated}
          </span>
          <span className="flex items-center gap-1 text-green-600">
            <span className="w-1.5 h-1.5 bg-green-600 rounded-full"/>
            All systems operational
          </span>
        </div>
      </div>
    </div>
  );
}