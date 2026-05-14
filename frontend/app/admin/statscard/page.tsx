"use client";

import { useState, useEffect } from "react";
import { Users, UserCheck, UserX, TrendingUp, DollarSign } from "lucide-react";
import { LucideIcon } from "lucide-react";

type Stat = {
  title: string;
  value: number;
  change: number;
  icon: LucideIcon;  // Fixed: Proper type instead of 'any'
  color: string;
  bgColor: string;
};

export default function StatsCards() {
  const [stats, setStats] = useState<Stat[]>([
    { title: "Total Users", value: 1247, change: 12, icon: Users, color: "text-[#B8112D]", bgColor: "bg-[#F8ECEF]" },
    { title: "Active Users", value: 893, change: 8, icon: UserCheck, color: "text-green-600", bgColor: "bg-green-50" },
    { title: "Inactive Users", value: 354, change: -3, icon: UserX, color: "text-gray-600", bgColor: "bg-gray-50" },
    { title: "Revenue", value: 28450, change: 23, icon: DollarSign, color: "text-emerald-600", bgColor: "bg-emerald-50" },
  ]);

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setStats(prev => prev.map(stat => ({
        ...stat,
        value: stat.value + Math.floor(Math.random() * 5) - 2,
      })));
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
      {stats.map((stat, index) => (
        <div key={index} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all group cursor-pointer">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-400">{stat.title}</p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-2">
                {stat.title === "Revenue" ? `$${stat.value.toLocaleString()}` : stat.value.toLocaleString()}
              </h2>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp size={12} className={stat.change > 0 ? "text-green-500" : "text-red-500"} />
                <span className={`text-xs font-medium ${stat.change > 0 ? "text-green-500" : "text-red-500"}`}>
                  {stat.change > 0 ? `+${stat.change}%` : `${stat.change}%`}
                </span>
                <span className="text-xs text-gray-400">vs last month</span>
              </div>
            </div>
            <div className={`${stat.bgColor} w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <stat.icon size={24} className={stat.color} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}