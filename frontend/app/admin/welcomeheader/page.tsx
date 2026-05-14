"use client";

import { useState, useEffect } from "react";
import { Bell, Download, User, Settings, LogOut } from "lucide-react";
import toast from "react-hot-toast";

export default function WelcomeHeader() {
  const [userName, setUserName] = useState("Admin");
  const [userRole, setUserRole] = useState("Administrator");
  const [currentTime, setCurrentTime] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);

  // Fix: Moved localStorage reads to initial state
  useEffect(() => {
    // Initialize from localStorage
    const name = localStorage.getItem("userName") || "Ali Khan";
    const role = localStorage.getItem("userRole") || "Administrator";
    
    // Use a setTimeout to avoid cascading renders
    setTimeout(() => {
      setUserName(name);
      setUserRole(role);
    }, 0);
    
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateString = now.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
      setCurrentTime(`${dateString}, ${timeString}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleExport = () => {
    toast.success("Report exported successfully!");
  };

  const handleNotifications = () => {
    setShowNotifications(!showNotifications);
    toast("You have 3 new notifications", {
      icon: '🔔',
    });
  };

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      {/* Left Section - Welcome Message */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-[#B8112D] to-[#8B0E23] flex items-center justify-center">
            <span className="text-white text-lg font-semibold">
              {userName.charAt(0)}
            </span>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Welcome back, {userName}! 
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#F8ECEF] text-[#B8112D]">
                <User size={10} />
                {userRole}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
                <span className="w-1.5 h-1.5 bg-green-600 rounded-full"></span>
                Active
              </span>
            </div>
          </div>
        </div>
        <p className="text-gray-500 text-sm ml-1">
          {currentTime} • Here&apos;s what&apos;s happening with your dashboard today.
        </p>
      </div>
      
      {/* Right Section - Action Buttons */}
      <div className="flex items-center gap-3">
        {/* Export Button */}
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
        >
          <Download size={16} className="text-[#B8112D]" />
          Export Report
        </button>
        
        {/* Notifications Button */}
        <div className="relative">
          <button 
            onClick={handleNotifications}
            className="relative p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <Bell size={18} className="text-gray-600" />
            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          
          {/* Notification Badge Count */}
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            3
          </span>
        </div>
        
        
        {/* Divider */}
        <div className="w-px h-8 bg-gray-200"></div>
        
        
      </div>
    </div>
  );
}