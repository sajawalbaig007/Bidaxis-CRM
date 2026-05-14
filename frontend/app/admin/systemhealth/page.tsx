"use client";

import { useState, useEffect } from "react";
import { Activity, Server, Cpu, Wifi, AlertTriangle } from "lucide-react";
import { LucideIcon } from "lucide-react";
import toast from "react-hot-toast";

type Metric = {
  name: string;
  value: string | number;
  status: "good" | "warning" | "critical";
  progress: number;
  icon: LucideIcon;  // Fixed: Changed from 'any' to LucideIcon
};

const initialMetrics: Metric[] = [
  { name: "API Response Time", value: "124ms", status: "good", progress: 75, icon: Activity },
  { name: "Storage Usage", value: "68%", status: "warning", progress: 68, icon: Server },
  { name: "Active Sessions", value: "247", status: "good", progress: 50, icon: Wifi },
  { name: "CPU Usage", value: "32%", status: "good", progress: 32, icon: Cpu },
];

const getStatusColor = (status: string) => {
  switch(status) {
    case "good": return "text-green-500 bg-green-50";
    case "warning": return "text-amber-500 bg-amber-50";
    case "critical": return "text-red-500 bg-red-50";
    default: return "text-gray-500 bg-gray-50";
  }
};

const getProgressColor = (status: string) => {
  switch(status) {
    case "good": return "bg-green-500";
    case "warning": return "bg-amber-500";
    case "critical": return "bg-red-500";
    default: return "bg-gray-500";
  }
};

export default function SystemHealth() {
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics);

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setMetrics(prev => prev.map(metric => {
        if (metric.name === "Active Sessions") {
          const newValue = Math.floor(Math.random() * 300) + 200;
          return { ...metric, value: newValue.toString(), progress: (newValue / 500) * 100 };
        }
        if (metric.name === "API Response Time") {
          const newValue = Math.floor(Math.random() * 200) + 50;
          return { ...metric, value: `${newValue}ms`, progress: newValue / 2 };
        }
        return metric;
      }));
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleViewDetails = () => {
    toast.success("Opening system health details...");
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800"> System Health</h3>
        <button 
          onClick={handleViewDetails}
          className="text-xs text-[#B8112D] hover:underline flex items-center gap-1"
        >
          Details →
        </button>
      </div>
      
      <div className="space-y-4">
        {metrics.map((metric, i) => (
          <div key={i} className="hover:bg-gray-50 p-2 rounded-xl transition-all">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className={`p-1 rounded-lg ${getStatusColor(metric.status)}`}>
                  <metric.icon size={12} />
                </div>
                <span className="text-xs text-gray-600">{metric.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${
                  metric.status === "good" ? "text-green-600" :
                  metric.status === "warning" ? "text-amber-600" : "text-red-600"
                }`}>
                  {metric.value}
                </span>
                {metric.status === "warning" && <AlertTriangle size={12} className="text-amber-500" />}
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div 
                className={`${getProgressColor(metric.status)} h-1.5 rounded-full transition-all duration-500`}
                style={{ width: `${metric.progress}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400 flex items-center gap-1">
            <Activity size={10} /> Last updated: Just now
          </span>
          <span className="flex items-center gap-1 text-green-600">
            <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
            All systems operational
          </span>
        </div>
      </div>
    </div>
  );
}