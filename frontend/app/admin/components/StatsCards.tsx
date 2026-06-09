"use client";

import { useEffect, useState } from "react";
import { PhoneCall, Users, UserCheck, BellRing } from "lucide-react";
import API from "@/lib/api";

type Props = { refreshTrigger?: number };

type Stats = {
  totalCalls:      number;
  activeLeads:     number;
  availableStaff:  number;
  notifications:   number;
};

export default function StatsCards({ refreshTrigger }: Props) {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await API.get("/admin/clients");
        const leads = res.data.leads ?? [];

        setStats({
          totalCalls:     leads.length,
          activeLeads:    leads.filter((l: { status?: string }) =>
                            ["pending","important","interested"].includes(l.status ?? "")).length,
          availableStaff: res.data.onlineCSRCount  ?? 0,
          notifications:  leads.filter((l: { status?: string }) =>
                            ["important","interested"].includes(l.status ?? "")).length,
        });
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [refreshTrigger]);   // ← re-fetch every time refreshTrigger changes

  const cards = [
    { title:"Total Calls",     value: stats?.totalCalls,     icon: PhoneCall,  color:"text-violet-600", bg:"bg-violet-100" },
    { title:"Active Leads",    value: stats?.activeLeads,    icon: Users,      color:"text-sky-600",    bg:"bg-sky-100"    },
    { title:"Available Staff", value: stats?.availableStaff, icon: UserCheck,  color:"text-orange-500", bg:"bg-orange-100" },
    { title:"Notifications",   value: stats?.notifications,  icon: BellRing,   color:"text-pink-500",   bg:"bg-pink-100"   },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-gray-400">{card.title}</p>
                {loading ? (
                  <div className="h-8 w-16 bg-gray-100 rounded-lg mt-2 animate-pulse"/>
                ) : (
                  <h2 className="text-2xl font-semibold text-gray-800 mt-2">
                    {card.value?.toLocaleString() ?? "—"}
                  </h2>
                )}
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg}`}>
                <Icon size={20} className={card.color}/>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}