import { CalendarClock, Clock3, Trophy, UserX, X } from "lucide-react";
import ScheduleCallForm from "../shared/ScheduleCallForm";
import ProjectDetailsForm from "../shared/ProjectDetailsForm";
import EmailField from "../shared/EmailField";
import { usTimezones } from "../../constants/timezones";

export type EditAction = "reschedule" | "closeclient" | "deleteclient" | null;

interface EditClientModalProps {
  client: string;
  company: string;
  email: string; onEmailChange: (v: string) => void;
  editAction: EditAction;
  onSelectAction: (action: EditAction) => void;
  onClose: () => void;

  scheduleDate: string; onScheduleDateChange: (v: string) => void;
  scheduleTime: string; onScheduleTimeChange: (v: string) => void;
  timezone: string; onTimezoneChange: (v: string) => void;
  onSaveReschedule: () => void;

  projectCode: string; onProjectCodeChange: (v: string) => void;
  projectTitle: string; onProjectTitleChange: (v: string) => void;
  projectService: string; onProjectServiceChange: (v: string) => void;
  projectDeadline: string; onProjectDeadlineChange: (v: string) => void;
  projectBudget: string; onProjectBudgetChange: (v: string) => void;
  paidAmount: string; onPaidAmountChange: (v: string) => void;
  projectNotes: string; onProjectNotesChange: (v: string) => void;
  projectWonValid: boolean;
  onSaveProjectWon: () => void;

  onDeleteClient: () => void;
}

export default function EditClientModal({
  client, company, email, onEmailChange, editAction, onSelectAction, onClose,
  scheduleDate, onScheduleDateChange, scheduleTime, onScheduleTimeChange,
  timezone, onTimezoneChange, onSaveReschedule,
  projectCode, onProjectCodeChange,
  projectTitle, onProjectTitleChange, projectService, onProjectServiceChange,
  projectDeadline, onProjectDeadlineChange, projectBudget, onProjectBudgetChange,
  paidAmount, onPaidAmountChange,
  projectNotes, onProjectNotesChange, projectWonValid, onSaveProjectWon,
  onDeleteClient,
}: EditClientModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="w-full sm:max-w-[520px] lg:max-w-[540px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}
      >
        {/* Gradient header */}
        <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <button onClick={onClose}
            className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
            <X size={13} className="sm:w-[15px] sm:h-[15px]" />
          </button>
          <div className="flex items-center gap-2.5 sm:gap-3 pr-10">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-lg sm:text-xl font-bold shrink-0">
              {client.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white leading-tight">
                {editAction === "reschedule"   ? "Reschedule Call"
                 : editAction === "closeclient"  ? "Close Client"
                 : editAction === "deleteclient" ? "Delete Client"
                 : "Edit Client"}
              </h2>
              <p className="text-white/65 text-[11px] sm:text-xs mt-0.5 truncate">
                {client}{company && company !== "N/A" ? ` · ${company}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-3 sm:space-y-5">

            {/* EMAIL */}
            <EmailField email={email} onEmailChange={onEmailChange} />

            {/* ACTION CHOOSER */}
            {!editAction && (
              <div className="space-y-2 sm:space-y-3">
                <p className="text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  What would you like to do?
                </p>
                {[
                  { action: "reschedule" as EditAction,  Icon: CalendarClock, iconBg: "bg-[#EAF5FF] text-[#0B84F3]", title: "Reschedule",    sub: "Pick a new date, time & timezone" },
                  { action: "closeclient" as EditAction, Icon: Trophy,        iconBg: "bg-[#ECFDF5] text-[#065F46]", title: "Close Client",   sub: "Fill project details & move to Projects" },
                  { action: "deleteclient" as EditAction,Icon: UserX,         iconBg: "bg-[#FFF1F3] text-[#B42318]", title: "Delete Client",  sub: "Move this client to Bin" },
                ].map(opt => (
                  <button
                    key={String(opt.action)}
                    onClick={() => onSelectAction(opt.action)}
                    className="w-full flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-gray-100 bg-[#FAFAFA] hover:border-[#B8112D] hover:bg-[#FFF1F3] transition-all text-left"
                  >
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl ${opt.iconBg} flex items-center justify-center shrink-0`}>
                      <opt.Icon size={18} className="sm:w-[22px] sm:h-[22px]" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-[#0F172A] text-sm sm:text-[15px]">{opt.title}</h4>
                      <p className="text-gray-500 text-xs sm:text-sm mt-0.5">{opt.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* RESCHEDULE */}
            {editAction === "reschedule" && (
              <>
                <ScheduleCallForm
                  date={scheduleDate} onDateChange={onScheduleDateChange}
                  time={scheduleTime} onTimeChange={onScheduleTimeChange}
                  timezone={timezone} onTimezoneChange={onTimezoneChange}
                  dateLabel="New Schedule Date" timeLabel="New Call Time"
                />
                {scheduleDate && scheduleTime && (
                  <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-3.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock3 size={11} className="text-[#B8112D]" />
                      <p className="text-gray-400 text-[10px] sm:text-[11px]">New Schedule Preview</p>
                    </div>
                    <h4 className="font-semibold text-[#0F172A] text-xs sm:text-[13px]">
                      {scheduleDate} at {scheduleTime} {usTimezones.find(tz => tz.value === timezone)?.abbreviation}
                    </h4>
                  </div>
                )}
                <div className="flex gap-2 sm:gap-3 pb-1">
                  <button onClick={() => onSelectAction(null)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Back</button>
                  <button
                    onClick={onSaveReschedule}
                    disabled={!scheduleDate || !scheduleTime}
                    className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${scheduleDate && scheduleTime ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"}`}
                  >
                    Save Schedule
                  </button>
                </div>
              </>
            )}

            {/* CLOSE CLIENT */}
            {editAction === "closeclient" && (
              <>
                <div className="bg-[#F8F9FC] rounded-xl sm:rounded-2xl p-3 sm:p-3.5 flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#ECFDF5] text-[#065F46] flex items-center justify-center shrink-0">
                    <Trophy size={15} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-[#0F172A] text-xs sm:text-[13px]">Close Client</h4>
                    <p className="text-gray-400 text-[10px] sm:text-[11px] mt-0.5 truncate">
                      Fill in project details for <strong className="text-gray-600">{client}</strong>
                    </p>
                  </div>
                </div>

                <ProjectDetailsForm
                  projectCode={projectCode} onProjectCodeChange={onProjectCodeChange}
                  title={projectTitle} onTitleChange={onProjectTitleChange}
                  service={projectService} onServiceChange={onProjectServiceChange}
                  deadline={projectDeadline} onDeadlineChange={onProjectDeadlineChange}
                  budget={projectBudget} onBudgetChange={onProjectBudgetChange}
                  paidAmount={paidAmount} onPaidAmountChange={onPaidAmountChange}
                  notes={projectNotes} onNotesChange={onProjectNotesChange}
                />

                <div className="flex gap-2 sm:gap-3 pb-1">
                  <button onClick={() => onSelectAction(null)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Back</button>
                  <button
                    onClick={onSaveProjectWon}
                    disabled={!projectWonValid}
                    className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${projectWonValid ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"}`}
                  >
                    Confirm &amp; Move
                  </button>
                </div>
              </>
            )}

            {/* DELETE CLIENT */}
            {editAction === "deleteclient" && (
              <>
                <div className="bg-[#FFF1F3] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3">
                  <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white text-[#B42318] flex items-center justify-center shrink-0 shadow-sm">
                    <UserX size={16} className="sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-[#B42318] text-xs sm:text-[14px]">Confirm Delete Client</h4>
                    <p className="text-[#B42318]/70 text-[11px] sm:text-[12px] mt-0.5">
                      <strong>{client}</strong> will be moved to your Bin.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 sm:gap-3 pb-1">
                  <button onClick={() => onSelectAction(null)} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">Back</button>
                  <button onClick={onDeleteClient} className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#B42318] text-white font-semibold text-sm hover:bg-[#9c1d14] transition-colors">
                    Delete Client
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
