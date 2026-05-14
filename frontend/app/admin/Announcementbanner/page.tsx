"use client";

import { useState } from "react";
import { Megaphone, X } from "lucide-react";
import toast from "react-hot-toast";

export default function AnnouncementBanner() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  const handleLearnMore = () => {
    toast.success("Check announcements for more details!");
  };

  return (
    <div className="bg-gradient-to-r from-[#B8112D] to-[#8B0E23] rounded-2xl p-4 mb-5 text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12"></div>
      
      <div className="flex items-center justify-between flex-wrap gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <Megaphone size={20} />
          <div>
            <p className="font-semibold text-sm">🚀 System Update Available</p>
            <p className="text-xs opacity-90">New features and improvements are ready. Update your profile now.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleLearnMore}
            className="bg-white/20 px-4 py-2 rounded-xl text-xs font-medium hover:bg-white/30 transition-all"
          >
            Learn More
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            className="p-2 hover:bg-white/20 rounded-xl transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}