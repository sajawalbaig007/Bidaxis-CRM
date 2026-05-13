// components/admin/StatsCards.tsx

"use client";

import {
  PhoneCall,
  Users,
  UserCheck,
  BellRing,
} from "lucide-react";

export default function StatsCards() {
  const cards = [
    {
      title: "Total Calls",
      value: "3,256",
      icon: PhoneCall,
      color: "text-violet-600",
      bg: "bg-violet-100",
    },
    {
      title: "Active Leads",
      value: "394",
      icon: Users,
      color: "text-sky-600",
      bg: "bg-sky-100",
    },
    {
      title: "Available Staff",
      value: "84",
      icon: UserCheck,
      color: "text-orange-500",
      bg: "bg-orange-100",
    },
    {
      title: "Notifications",
      value: "38",
      icon: BellRing,
      color: "text-pink-500",
      bg: "bg-pink-100",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-5">

      {cards.map((card, i) => {
        const Icon = card.icon;

        return (
          <div
            key={i}
            className="bg-white border border-gray-100 rounded-2xl px-5 py-4"
          >

            <div className="flex items-center justify-between">

              <div>

                <p className="text-[13px] text-gray-400">
                  {card.title}
                </p>

                <h2 className="text-2xl font-semibold text-gray-800 mt-2">
                  {card.value}
                </h2>

              </div>

              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.bg}`}
              >
                <Icon
                  size={20}
                  className={card.color}
                />
              </div>

            </div>

          </div>
        );
      })}
    </div>
  );
}