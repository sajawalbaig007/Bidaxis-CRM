"use client";

import { ArrowDownAZ, ArrowUpAZ } from "lucide-react";
import type { ClientListSortBy, SortDir } from "../../utils/clientListSort";

interface ClientSortControlsProps {
  sortBy: ClientListSortBy;
  sortDir: SortDir;
  onSortBy: (v: ClientListSortBy) => void;
  onSortDir: (v: SortDir) => void;
  className?: string;
}

export default function ClientSortControls({
  sortBy,
  sortDir,
  onSortBy,
  onSortDir,
  className = "",
}: ClientSortControlsProps) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <select
        value={sortBy}
        onChange={e => onSortBy(e.target.value as ClientListSortBy)}
        className="h-10 sm:h-[44px] rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] px-3 text-xs sm:text-sm outline-none focus:border-[#B8112D] text-[#0F172A] font-medium"
        title="Sort by"
      >
        <option value="clientCode">Client Code</option>
        <option value="name">Name</option>
      </select>
      <button
        type="button"
        onClick={() => onSortDir(sortDir === "asc" ? "desc" : "asc")}
        className="h-10 sm:h-[44px] px-3 rounded-xl sm:rounded-2xl border border-gray-200 bg-[#FAFAFA] text-xs sm:text-sm font-semibold text-[#B8112D] hover:bg-[#FFF6F7] transition-colors inline-flex items-center gap-1.5"
        title={sortDir === "asc" ? "Ascending — click for descending" : "Descending — click for ascending"}
      >
        {sortDir === "asc" ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />}
        <span className="hidden sm:inline">{sortDir === "asc" ? "Asc" : "Desc"}</span>
      </button>
    </div>
  );
}
