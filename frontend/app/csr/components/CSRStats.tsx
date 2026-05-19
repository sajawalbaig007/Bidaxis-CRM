import {
  Phone,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from "lucide-react";

const stats = [
  {
    title: "Calls Today",
    value: "52",
    icon: Phone,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Completed",
    value: "34",
    icon: CheckCircle2,
    color: "bg-green-100 text-green-600",
  },
  {
    title: "Pending",
    value: "12",
    icon: Clock3,
    color: "bg-yellow-100 text-yellow-600",
  },
  {
    title: "Important",
    value: "4",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-600",
  },
];

export default function CSRStats() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mt-5">
      {stats.map((item) => {
        const Icon = item.icon;

        return (
          <div
            key={item.title}
            className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between"
          >
            <div>
              <p className="text-gray-500 text-sm">
                {item.title}
              </p>

              <h2 className="text-4xl font-bold mt-3 text-[#0F172A]">
                {item.value}
              </h2>
            </div>

            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${item.color}`}
            >
              <Icon size={28} />
            </div>
          </div>
        );
      })}
    </div>
  );
}