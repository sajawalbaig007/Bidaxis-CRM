import { Briefcase, X } from "lucide-react";
import ServicePicker from "../shared/ServicePicker";

interface InterestedModalProps {
  service?: string;
  onServiceChange?: (v: string) => void;
  services?: string[];
  onServicesChange?: (v: string[]) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function InterestedModal({
  service = "", onServiceChange,
  services = [], onServicesChange,
  onClose, onSave,
}: InterestedModalProps) {
  const multi = !!onServicesChange;
  const selected = multi ? services : (service ? [service] : []);
  const canSave = selected.length > 0;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] p-5 sm:p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-0">
          <div>
            <h2 className="text-xl sm:text-[26px] font-bold text-[#0F172A] dark:text-gray-100">Client Interested In</h2>
            <p className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
              Select one or more services (notes go in the Notes column).
            </p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-[#F5F6FA] dark:bg-gray-800 flex items-center justify-center text-gray-500 shrink-0">
            <X size={15} className="sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>
        <div className="mt-4 sm:mt-7 space-y-4">
          {multi ? (
            <ServicePicker multi values={services} onValuesChange={onServicesChange} />
          ) : (
            <ServicePicker value={service} onChange={onServiceChange} />
          )}

          {canSave && (
            <div className="p-3 sm:p-4 bg-[#FFF4E5] dark:bg-amber-950/30 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3">
              <Briefcase size={15} className="text-[#D97706] shrink-0 sm:w-[18px] sm:h-[18px]" />
              <div>
                <p className="text-[11px] sm:text-[12px] font-medium text-gray-500 dark:text-gray-400">Selected</p>
                <p className="text-[13px] sm:text-[15px] font-bold text-[#D97706]">{selected.join(", ")}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-7">
          <button onClick={onClose}
            className="flex-1 h-11 sm:h-[52px] rounded-xl sm:rounded-2xl bg-[#F5F6FA] dark:bg-gray-800 font-semibold text-gray-600 dark:text-gray-300 text-sm">Cancel</button>
          <button onClick={onSave} disabled={!canSave}
            className={`flex-1 h-11 sm:h-[52px] rounded-xl sm:rounded-2xl font-semibold text-white text-sm transition-all ${canSave ? "bg-[#B8112D]" : "bg-gray-300 cursor-not-allowed"}`}>
            Save Interest
          </button>
        </div>
      </div>
    </div>
  );
}
