interface TriesBarProps {
  used: number;
  limit: number;
  color: string;
}

export default function TriesBar({ used, limit, color }: TriesBarProps) {
  const pct = Math.min((used / limit) * 100, 100);
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500">
          {used} / {limit}
        </span>
        <span className={`text-[10px] sm:text-[11px] font-bold ${used >= limit ? "text-red-600" : "text-gray-400"}`}>
          {used >= limit ? "Redistributed" : `${limit - used} left`}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
