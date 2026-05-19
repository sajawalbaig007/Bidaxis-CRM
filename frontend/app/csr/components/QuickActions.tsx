import {
  Phone,
  Link2,
} from "lucide-react";

export default function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-5 mt-5">
      <button className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition">
        <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
          <Phone size={24} />
        </div>

        <div className="text-left">
          <h4 className="font-semibold">
            Calls
          </h4>

          <p className="text-sm text-gray-500">
            Manage daily calls
          </p>
        </div>
      </button>

      <button className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 hover:shadow-md transition">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
          <Link2 size={24} />
        </div>

        <div className="text-left">
          <h4 className="font-semibold">
            My Links
          </h4>

          <p className="text-sm text-gray-500">
            View assigned leads
          </p>
        </div>
      </button>
    </div>
  );
}