"use client";

import { Plus, FileText, Users, Settings, Send } from "lucide-react";
import toast from "react-hot-toast";

const actions = [
  
  {
    icon: FileText,
    label: "Generate Report",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    onClick: () => toast.success("Generating report...")
  },
  {
    icon: Send,
    label: "Send Notification",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    onClick: () => toast.success("Notification composer opened")
  },
  
  
];

export default function QuickActions() {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-3 pt-3"> Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.onClick}
            className="bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-all text-center group border border-gray-100"
          >
            <div className={`${action.bgColor} w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}>
              <action.icon size={18} className={action.color} />
            </div>
            <span className="text-xs font-medium text-gray-700">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}