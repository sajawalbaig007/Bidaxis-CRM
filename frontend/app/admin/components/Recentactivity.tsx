"use client";

import { useEffect, useState } from "react";
import {
  Activity, UserPlus, CheckCircle, Edit,
  AlertCircle, ChevronRight, Phone,
} from "lucide-react";
import API from "@/lib/api";

type Props = { refreshTrigger?: number };

type ActivityItem = {
  id:     string;
  user:   string;
  action: string;
  time:   string;
  type:   "create" | "resolve" | "update" | "alert" | "call";
};

const getIcon = (type: string) => {
  switch (type) {
    case "create":  return <UserPlus    size={14} className="text-green-600"/>;
    case "resolve": return <CheckCircle size={14} className="text-blue-600"/>;
    case "update":  return <Edit        size={14} className="text-amber-600"/>;
    case "alert":   return <AlertCircle size={14} className="text-red-600"/>;
    case "call":    return <Phone       size={14} className="text-violet-600"/>;
    default:        return <Activity    size={14} className="text-gray-600"/>;
  }
};

const getBg = (type: string) => {
  switch (type) {
    case "create":  return "bg-green-50";
    case "resolve": return "bg-blue-50";
    case "update":  return "bg-amber-50";
    case "alert":   return "bg-red-50";
    case "call":    return "bg-violet-50";
    default:        return "bg-gray-50";
  }
};

const statusToType = (s: string): ActivityItem["type"] => {
  if (s === "important")   return "alert";
  if (s === "interested")  return "call";
  if (s === "project won") return "resolve";
  if (s === "pending")     return "create";
  return "update";
};

const timeAgo = (iso: string): string => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400)return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} days ago`;
};

export default function RecentActivity({ refreshTrigger }: Props) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const res   = await API.get("/admin/clients");
        const leads: {
          id?: string; name?: string; status?: string; updatedAt?: string;
          csr?: { name?: string };
        }[] = res.data.leads ?? [];

        /* Take the 6 most recently updated leads */
        const recent = [...leads]
          .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
          .slice(0, 6);

        setActivities(recent.map(l => {
          const csr    = l.csr?.name ?? "A CSR";
          const status = l.status ?? "updated";
          return {
            id:     l.id ?? Math.random().toString(),
            user:   csr,
            action: `updated lead "${l.name ?? "Unknown"}" to ${status}`,
            time:   timeAgo(l.updatedAt ?? new Date().toISOString()),
            type:   statusToType(status),
          };
        }));
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };
    void fetch();
  }, [refreshTrigger]);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">🔄 Recent Activity</h3>
        <button className="text-xs text-[#B8112D] hover:underline flex items-center gap-1">
          View All <ChevronRight size={12}/>
        </button>
      </div>

      <div className="space-y-3">
        {loading
          ? [1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0 animate-pulse"/>
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-gray-100 rounded w-3/4 animate-pulse"/>
                <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse"/>
              </div>
            </div>
          ))
          : activities.map(activity => (
            <div key={activity.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all cursor-pointer">
              <div className={`${getBg(activity.type)} w-10 h-10 rounded-full flex items-center justify-center shrink-0`}>
                {getIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-semibold text-gray-800">{activity.user}</span>
                  <span className="text-gray-600"> {activity.action}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}