"use client";

import { useState } from "react";
import { Activity, UserPlus, CheckCircle, Edit, AlertCircle, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

type Activity = {
  id: number;
  user: string;
  action: string;
  time: string;
  type: "create" | "resolve" | "update" | "alert";
  avatar?: string;
};

const recentActivities: Activity[] = [
  { id: 1, user: "Ali Khan", action: "created a new ticket #T-1234", time: "2 min ago", type: "create" },
  { id: 2, user: "Sarah Ahmed", action: "resolved issue #C-5678", time: "15 min ago", type: "resolve" },
  { id: 3, user: "Hamza Farooq", action: "updated user profile", time: "1 hour ago", type: "update" },
  { id: 4, user: "Fatima Khan", action: "completed training module", time: "2 hours ago", type: "resolve" },
  { id: 5, user: "Omar Hassan", action: "system alert: high priority task", time: "3 hours ago", type: "alert" },
  { id: 1, user: "Ali Khan", action: "created a new ticket #T-1234", time: "2 min ago", type: "create" },
];

const getActivityIcon = (type: string) => {
  switch(type) {
    case "create": return <UserPlus size={14} className="text-green-600" />;
    case "resolve": return <CheckCircle size={14} className="text-blue-600" />;
    case "update": return <Edit size={14} className="text-amber-600" />;
    case "alert": return <AlertCircle size={14} className="text-red-600" />;
    default: return <Activity size={14} className="text-gray-600" />;
  }
};

const getActivityBg = (type: string) => {
  switch(type) {
    case "create": return "bg-green-50";
    case "resolve": return "bg-blue-50";
    case "update": return "bg-amber-50";
    case "alert": return "bg-red-50";
    default: return "bg-gray-50";
  }
};

export default function RecentActivity() {
  const [activities, setActivities] = useState<Activity[]>(recentActivities);

  const handleViewAll = () => {
    toast.success("Loading all activities...");
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800">🔄 Recent Activity</h3>
        <button 
          onClick={handleViewAll}
          className="text-xs text-[#B8112D] hover:underline flex items-center gap-1"
        >
          View All <ChevronRight size={12} />
        </button>
      </div>
      
      <div className="space-y-3">
        {activities.map((activity) => (
          <div 
            key={activity.id} 
            className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-all cursor-pointer"
            onClick={() => toast.success(`Viewing ${activity.user}'s activity`)}
          >
            <div className={`${getActivityBg(activity.type)} w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0`}>
              {getActivityIcon(activity.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm">
                <span className="font-semibold text-gray-800">{activity.user}</span>
                <span className="text-gray-600"> {activity.action}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}