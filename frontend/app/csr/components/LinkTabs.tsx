"use client";

import { LinkStatus } from "./types";

interface Props {
  active: string;
  setActive: (value: string) => void;
}

const tabs: {
  label: string;
  value: string;
}[] = [
  { label: "All Links", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Completed", value: "completed" },
  { label: "Important", value: "important" },
  { label: "Follow Up", value: "followup" },
  { label: "No Response", value: "noresponse" },
];

export default function LinkTabs({
  active,
  setActive,
}: Props) {
  return (
    <div className="flex gap-4 mb-8 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => setActive(tab.value)}
          className={`px-6 py-3 rounded-2xl font-semibold transition-all ${
            active === tab.value
              ? "bg-[#C8102E] text-white"
              : "bg-white border text-gray-600 hover:bg-gray-100"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}