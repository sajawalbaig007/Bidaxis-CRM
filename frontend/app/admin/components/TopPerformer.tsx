"use client";

import { Trophy, Star, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";

type Performer = {
  name: string;
  tickets: number;
  rating: number;
  trend: "up" | "down" | "stable";
  avatar?: string;
};

const performers: Performer[] = [
  { name: "Ahmed Raza", tickets: 47, rating: 4.9, trend: "up" },
  { name: "Fatima Khan", tickets: 42, rating: 4.8, trend: "up" },
  { name: "Omar Hassan", tickets: 38, rating: 4.7, trend: "stable" },
  
];

const getTrendIcon = (trend: string) => {
  if (trend === "up") return <TrendingUp size={14} className="text-green-500" />;
  if (trend === "down") return <TrendingUp size={14} className="text-red-500 rotate-180" />;
  return <Star size={14} className="text-gray-400" />;
};

export default function TopPerformers() {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-gray-800"> Top Performers</h3>
        <Trophy size={18} className="text-amber-500" />
      </div>
      
      <div className="space-y-4">
        {performers.map((performer, i) => (
          <div 
            key={i} 
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-all cursor-pointer"
            onClick={() => toast.success(`Viewing ${performer.name}'s profile`)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold
                ${i === 0 ? "bg-gradient-to-r from-amber-400 to-amber-500" : 
                  i === 1 ? "bg-gradient-to-r from-gray-400 to-gray-500" : 
                  i === 2 ? "bg-gradient-to-r from-amber-600 to-amber-700" : 
                  "bg-gradient-to-r from-blue-400 to-blue-500"}`}>
                {i + 1}
              </div>
              <div>
                <p className="font-medium text-sm text-gray-800">{performer.name}</p>
                <p className="text-xs text-gray-400">{performer.tickets} tickets resolved</p>
              </div>
            </div>
            <div className="text-right flex items-center gap-2">
              <p className="text-sm font-semibold text-green-600">{performer.rating} ★</p>
              {getTrendIcon(performer.trend)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}