import {
  Phone,
  PhoneCall,
  Clock3,
} from "lucide-react";

export default function DailyCalls() {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            Daily Calls
          </h3>

          <p className="text-sm text-gray-500 mt-1">
            Today's call performance.
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
          <Phone size={22} />
        </div>
      </div>

      <div className="space-y-4 mt-6">

        {/* TOTAL CALLS */}
        <div className="flex items-center justify-between border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <PhoneCall size={18} />
            </div>

            <div>
              <h4 className="font-semibold text-gray-800">
                Total Calls
              </h4>

              <p className="text-sm text-gray-500">
                Calls made today
              </p>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-[#0F172A]">
            52
          </h3>
        </div>

        {/* PENDING */}
        <div className="flex items-center justify-between border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-yellow-100 text-yellow-600 flex items-center justify-center">
              <Clock3 size={18} />
            </div>

            <div>
              <h4 className="font-semibold text-gray-800">
                Pending Calls
              </h4>

              <p className="text-sm text-gray-500">
                Awaiting callback
              </p>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-[#0F172A]">
            12
          </h3>
        </div>

      </div>
    </div>
  );
}