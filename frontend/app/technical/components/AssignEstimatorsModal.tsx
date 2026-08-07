"use client";

import { useMemo, useState } from "react";
import {
  X, Check, CircleCheckBig, Clock, User2, Briefcase, Hash, Calendar,
} from "lucide-react";
import type { TechnicalAssignment, TechnicalEstimator } from "@/lib/technicalAssignments";

type ProjectBrief = {
  id: string;
  name?: string | null;
  projectCode?: string | null;
  clientCode?: string | null;
  projectTitle?: string | null;
  projectScope?: string | null;
  projectDeadline?: string | null;
};

type Step = "pick" | "details";

type Props = {
  open: boolean;
  project: ProjectBrief | null;
  estimators: TechnicalEstimator[];
  saving?: boolean;
  onClose: () => void;
  onConfirm: (assignments: TechnicalAssignment[]) => void | Promise<void>;
};

export default function AssignEstimatorsModal({
  open,
  project,
  estimators,
  saving = false,
  onClose,
  onConfirm,
}: Props) {
  const [step, setStep] = useState<Step>("pick");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { manHours: string; deadline: string }>>({});

  const code = (project?.projectCode || project?.clientCode || "").trim() || "—";
  const scope = (project?.projectScope || "").trim() || "—";
  const title = (project?.projectTitle || project?.name || "Project").trim();
  const defaultDeadline = (project?.projectDeadline ?? "").split("T")[0] || "";

  const selectedEstimators = useMemo(
    () => estimators.filter((e) => selectedIds.includes(e.id)),
    [estimators, selectedIds],
  );

  if (!open || !project) return null;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const goDetails = () => {
    if (selectedIds.length === 0) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of selectedIds) {
        if (!next[id]) {
          next[id] = { manHours: "", deadline: defaultDeadline };
        }
      }
      return next;
    });
    setStep("details");
  };

  const handleConfirm = async () => {
    const assignments: TechnicalAssignment[] = selectedEstimators.map((e) => ({
      estimatorId: e.id,
      estimatorName: e.name,
      manHours: (drafts[e.id]?.manHours ?? "").trim(),
      deadline: (drafts[e.id]?.deadline ?? "").trim(),
      takeoffDone: false,
    }));
    if (assignments.some((a) => !a.deadline)) return;
    await onConfirm(assignments);
    setStep("pick");
    setSelectedIds([]);
    setDrafts({});
  };

  const handleClose = () => {
    setStep("pick");
    setSelectedIds([]);
    setDrafts({});
    onClose();
  };

  const detailsValid =
    selectedEstimators.length > 0 &&
    selectedEstimators.every((e) => (drafts[e.id]?.deadline ?? "").trim());

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="w-full sm:max-w-[560px] bg-white rounded-t-[24px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}
      >
        <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-5 lg:px-6 pt-4 sm:pt-5 pb-4 sm:pb-5 shrink-0 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <button
            type="button"
            onClick={handleClose}
            className="absolute top-3 sm:top-4 right-3 sm:right-4 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10"
          >
            <X size={13} />
          </button>
          <div className="flex items-center gap-2.5 sm:gap-3 pr-10">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-base sm:text-xl font-bold shrink-0">
              {title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base lg:text-lg font-bold text-white leading-tight truncate">
                {step === "pick" ? "Assign Estimators" : "Assignment Details"}
              </h2>
              <p className="text-white/65 text-[10px] sm:text-xs mt-0.5 truncate">{title}</p>
            </div>
          </div>
          <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-green-500/25 text-green-100 border border-green-400/30 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] font-semibold">
              <CircleCheckBig size={9} />
              {step === "pick" ? "Select 1–3 estimators" : "Set man hours & deadline each"}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-4 sm:px-5 lg:px-6 py-4 sm:py-5 space-y-4">
            {/* Auto code + scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#F8F9FC] rounded-2xl border border-gray-100 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
                  <Hash size={10} /> Client / Project Code
                </p>
                <p className="text-sm font-bold text-[#B8112D] truncate">{code}</p>
              </div>
              <div className="bg-[#F8F9FC] rounded-2xl border border-gray-100 px-3.5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1 flex items-center gap-1">
                  <Briefcase size={10} /> Scope
                </p>
                <p className="text-sm font-semibold text-[#0F172A] truncate">{scope}</p>
              </div>
            </div>

            {step === "pick" ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                  Estimators ({selectedIds.length}/3)
                </p>
                {estimators.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No estimators available.</p>
                ) : (
                  estimators.map((est) => {
                    const active = selectedIds.includes(est.id);
                    const locked = !active && selectedIds.length >= 3;
                    return (
                      <button
                        key={est.id}
                        type="button"
                        disabled={locked}
                        onClick={() => toggle(est.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                          active
                            ? "border-[#B8112D] bg-[#FFF1F3]"
                            : locked
                              ? "border-gray-50 bg-gray-50 opacity-50 cursor-not-allowed"
                              : "border-gray-100 bg-[#FAFAFA] hover:border-gray-200"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                            active ? "bg-[#B8112D]" : "bg-gray-400"
                          }`}
                        >
                          {est.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold text-sm truncate ${active ? "text-[#B8112D]" : "text-[#0F172A]"}`}>
                            {est.name}
                          </p>
                          <p className="text-xs text-gray-400">{est.code}</p>
                        </div>
                        {active && (
                          <div className="w-5 h-5 rounded-full bg-[#B8112D] flex items-center justify-center shrink-0">
                            <Check size={11} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {selectedEstimators.map((est) => (
                  <div
                    key={est.id}
                    className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#B8112D] text-white flex items-center justify-center text-sm font-bold">
                        {est.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#0F172A] truncate flex items-center gap-1.5">
                          <User2 size={12} className="text-[#B8112D]" />
                          {est.name}
                        </p>
                        <p className="text-[11px] text-gray-400">{est.code}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                          <Clock size={10} /> Man Hours
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="e.g. 8"
                          value={drafts[est.id]?.manHours ?? ""}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [est.id]: {
                                manHours: e.target.value,
                                deadline: d[est.id]?.deadline ?? defaultDeadline,
                              },
                            }))
                          }
                          className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#B8112D] bg-[#FAFAFA]"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                          <Calendar size={10} /> Deadline <span className="text-[#B8112D]">*required</span>
                        </span>
                        <input
                          type="date"
                          value={drafts[est.id]?.deadline ?? ""}
                          onChange={(e) =>
                            setDrafts((d) => ({
                              ...d,
                              [est.id]: {
                                manHours: d[est.id]?.manHours ?? "",
                                deadline: e.target.value,
                              },
                            }))
                          }
                          className="w-full h-11 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#B8112D] bg-[#FAFAFA]"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 sm:gap-3 pb-1 pt-1">
              {step === "details" ? (
                <button
                  type="button"
                  onClick={() => setStep("pick")}
                  className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors"
                >
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              )}
              {step === "pick" ? (
                <button
                  type="button"
                  onClick={goDetails}
                  disabled={selectedIds.length === 0}
                  className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm text-white flex items-center justify-center gap-2 transition-all ${
                    selectedIds.length > 0
                      ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200"
                      : "bg-gray-200 cursor-not-allowed text-gray-400"
                  }`}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={!detailsValid || saving}
                  className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm text-white flex items-center justify-center gap-2 transition-all ${
                    detailsValid && !saving
                      ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200"
                      : "bg-gray-200 cursor-not-allowed text-gray-400"
                  }`}
                >
                  {saving ? "Assigning…" : "Confirm Assignment"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
