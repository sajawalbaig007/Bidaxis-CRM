import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  Icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  loading?: boolean;
}

export default function StatCard({ label, value, sub, Icon, iconBg, iconColor, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-[24px] p-3 sm:p-4 lg:p-5 border border-white shadow-sm flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-gray-500 text-[10px] sm:text-[12px] lg:text-[13px] font-medium truncate">{label}</p>
        {loading ? (
          <div className="h-7 sm:h-8 w-10 sm:w-12 bg-gray-100 rounded-lg mt-1.5 sm:mt-2 animate-pulse" />
        ) : (
          <h2 className="text-xl sm:text-[24px] font-bold text-[#0F172A] mt-1 sm:mt-2">{value.toLocaleString()}</h2>
        )}
        {sub && <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 sm:mt-1 truncate">{sub}</p>}
      </div>
      <div className={`w-10 h-10 sm:w-11 sm:h-11 lg:w-12 lg:h-12 rounded-xl sm:rounded-2xl ${iconBg} ${iconColor} flex items-center justify-center shrink-0`}>
        <Icon size={20} className="sm:w-[22px] sm:h-[22px]" />
      </div>
    </div>
  );
}
