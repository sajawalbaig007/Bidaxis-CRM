"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, Calendar, Users, ClipboardList, CheckCircle2,
  Calculator, Send, Layers, UserPlus, Check, Eye, Trash2, RefreshCw, RotateCcw,
} from "lucide-react";

import TechnicalSidebar from "../components/layout/Sidebar";
import DashboardNavbar from "@/app/admin/components/layout/Navbar";
import CapsuleTabs from "@/app/components/CapsuleTabs";
import ProjectWorkbenchModal from "@/app/components/projects/ProjectWorkbenchModal";
import CommentCell from "@/app/csr/components/shared/CommentCell";
import StateFilterDropdown from "@/app/csr/components/shared/StateFilterDropdown";
import PhoneAreaCodeFilterInput from "@/app/csr/components/shared/PhoneAreaCodeFilterInput";
import { matchesStateLocationFilter, matchesPhoneAreaCodeFilter } from "@/lib/stateLocationFilter";
import { NoteEntry } from "@/app/csr/hooks/useLeadsData";
import { useFixedPopover } from "@/app/csr/hooks/useFixedPopover";
import {
  TECHNICAL_PROJECT_COLS,
  TECHNICAL_ASSIGNED_COLS,
  TECHNICAL_FINAL_COLS,
  TECHNICAL_PRICING_COLS,
  CsrColGroup,
  CSR_THEAD,
} from "@/app/csr/components/shared/csrTableStyles";
import {
  ProjectDetailCell,
  DeadlineTimingBadge,
  TechnicalWorkflowStatusBadge,
  PROJECT_TABLE_CARD,
  PROJECT_TABLE_HEAD,
} from "@/app/components/projects/ProjectTableCells";
import AssignEstimatorsModal from "../components/AssignEstimatorsModal";
import API, { apiErrorMessage } from "@/lib/api";
import { fetchAllAdminProjects } from "@/lib/fetchAdminProjects";
import {
  emptyWorkbench,
  parsePayments,
  type ProjectWorkbenchData,
} from "@/lib/projectFields";
import {
  matchesTechnicalTab,
  parseTechnicalAssignments,
  parseTechnicalNotes,
  projectReceiveDate,
  pricingReceiveDate,
  formatDivisionSummary,
  formatElapsed,
  assignmentElapsedSeconds,
  getTechTaskStatus,
  TECH_TASK_STATUS_OPTIONS,
  getPricingQaMode,
  PRICING_QA_OPTIONS,
  isAssignmentWorking,
  isAssignmentTakeoffReady,
  allAssignmentsSentForPricing,
  pricedAssignments,
  type TechnicalAssignment,
  type TechnicalEstimator,
  type TechnicalWorkflowTab,
  type TechTaskStatus,
  type PricingQaMode,
} from "@/lib/technicalAssignments";

type Project = {
  id: string;
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  state: string | null;
  ownerName: string | null;
  interestedService: string | null;
  projectTitle: string | null;
  projectCode: string | null;
  clientCode?: string | null;
  projectScope: string | null;
  projectPhase: string | null;
  projectDeadline: string | null;
  deadlineTiming?: string | null;
  projectNotes: string | null;
  projectPayments: string | null;
  projectBudget?: string | null;
  projectSource?: string | null;
  projectWorkStatus?: string | null;
  takeoffDeadline?: string | null;
  pricingDeadline?: string | null;
  qaDeadline?: string | null;
  technicalReceivedAt?: string | null;
  pricingReceivedAt?: string | null;
  technicalAssignments?: string | null;
  technicalNotes?: string | null;
  needsRevision?: boolean;
  revisionRequestedAt?: string | null;
  revisionNotes?: string | null;
  createdAt?: string;
  updatedAt: string;
  csr: { id: string; name: string; email: string; csrCode: string | null };
  uploadFile: { companyName: string | null } | null;
  notes?: { id: string; text: string; createdAt: string }[];
};

const PAGE_SIZE = 30;

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.split("T")[0] || "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

function notesToHistory(notes?: { id: string; text: string; createdAt: string }[]): NoteEntry[] {
  return (notes ?? []).map((n) => ({ id: n.id, text: n.text, createdAt: n.createdAt }));
}

function projectToWorkbench(p: Project): ProjectWorkbenchData {
  return {
    id: p.id,
    name: "",
    company: "",
    phone: "",
    email: "",
    ownerName: "",
    state: p.state ?? "",
    projectCode: p.projectCode || p.clientCode || "",
    projectTitle: p.projectTitle ?? "",
    projectScope: p.projectScope ?? "",
    interestedService: p.interestedService ?? "",
    projectBudget: "",
    projectDeadline: (p.projectDeadline ?? "").split("T")[0],
    deadlineTiming: (p.deadlineTiming === "morning" || p.deadlineTiming === "cob" ? p.deadlineTiming : "") as "" | "morning" | "cob",
    projectPhase: p.projectPhase ?? "not_started",
    takeoffDeadline: p.takeoffDeadline ?? "",
    pricingDeadline: p.pricingDeadline ?? "",
    qaDeadline: p.qaDeadline ?? "",
    projectPayments: parsePayments(p.projectPayments),
    assignedTo: p.csr?.id,
    projectSource: p.projectSource ?? "",
    projectNotes: p.projectNotes ?? "",
  };
}

function projectAsRow(p: Project) {
  return {
    id: p.id,
    name: p.name,
    company: p.company ?? p.uploadFile?.companyName ?? null,
    ownerName: p.ownerName,
    phone: p.phone,
    email: p.email,
    projectCode: p.projectCode,
    clientCode: p.clientCode,
    projectTitle: p.projectTitle,
    projectScope: p.projectScope,
    interestedService: p.interestedService,
    projectBudget: null,
    projectDeadline: p.projectDeadline,
    projectPhase: p.projectPhase,
    projectPayments: p.projectPayments,
    state: p.state,
  };
}

function PricingProjectDetailCell({
  p,
  assignments,
}: {
  p: Project;
  assignments: TechnicalAssignment[];
}) {
  const priced = pricedAssignments(assignments);
  const showMainScope = allAssignmentsSentForPricing(assignments) || priced.length === 0;
  const code = (p.projectCode || p.clientCode || "").trim();
  const title = (p.projectTitle || "").trim();
  const mainScope = (p.projectScope || "").trim();
  const othersWorking =
    assignments.some(isAssignmentWorking) || assignments.some(isAssignmentTakeoffReady);

  const panelW = 300;
  const { open, toggle, anchorRef, panelRef, style } = useFixedPopover(panelW, 320, "start");
  const primary = priced[0];
  const extra = Math.max(0, priced.length - 1);

  const popup =
    open &&
    !showMainScope &&
    createPortal(
      <div
        ref={panelRef}
        style={style}
        className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 max-h-80 overflow-y-auto z-[80]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2.5 py-1.5 border-b border-gray-100 sticky top-0 bg-white">
          <span className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">
            Sent for pricing ({priced.length})
          </span>
        </div>
        {priced.map((a) => (
          <div key={a.estimatorId} className="px-2.5 py-2 border-b border-gray-50 last:border-0 space-y-0.5">
            <p className="text-[12px] font-bold text-[#0F172A] truncate">{a.estimatorName}</p>
            <p className="text-[10px] font-semibold text-gray-700">
              Scope: {(a.scopes ?? []).filter(Boolean).join(", ") || "—"}
            </p>
            <p className="text-[10px] font-semibold text-gray-700">
              Division: {formatDivisionSummary(a.divisions) || "—"}
            </p>
            {a.workDetail ? (
              <p className="text-[10px] text-gray-500 line-clamp-3">{a.workDetail}</p>
            ) : null}
          </div>
        ))}
        {othersWorking ? (
          <p className="px-2.5 py-2 text-[9px] text-amber-700 font-semibold">
            Others still on Assigned / Take Off Done
          </p>
        ) : null}
      </div>,
      document.body,
    );

  return (
    <div className="min-w-0 bg-[#F8F9FC] rounded-xl px-2.5 py-1.5 border border-gray-100/80 space-y-1">
      {title ? (
        <p className="text-xs font-semibold text-[#0F172A] truncate">{title}</p>
      ) : null}
      {code ? (
        <p className="text-[10px] text-gray-600">
          Code: <span className="font-bold text-[#B8112D]">{code}</span>
        </p>
      ) : null}

      {showMainScope ? (
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wide text-violet-700">Full project scope</p>
          <p className="text-[11px] font-semibold text-[#0F172A] truncate">Scope: {mainScope || "—"}</p>
          {p.interestedService ? (
            <p className="text-[11px] font-semibold text-gray-700 truncate">
              Division: {p.interestedService}
            </p>
          ) : null}
        </div>
      ) : primary ? (
        <button
          ref={anchorRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="w-full flex items-center gap-1.5 rounded-lg bg-white border border-violet-100 px-1.5 py-1 hover:border-violet-300 text-left"
          title="View who was sent for pricing"
        >
          <div className="w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center text-[9px] font-bold shrink-0">
            {primary.estimatorName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[#0F172A] truncate">{primary.estimatorName}</p>
            <p className="text-[9px] font-semibold text-violet-700 truncate">
              {(primary.scopes ?? []).filter(Boolean).join(", ") || "—"}
              {primary.divisions?.length ? ` · ${formatDivisionSummary(primary.divisions)}` : ""}
            </p>
          </div>
          {extra > 0 && (
            <span className="shrink-0 h-5 min-w-[20px] px-1 rounded-md bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center">
              +{extra}
            </span>
          )}
        </button>
      ) : null}
      {popup}
    </div>
  );
}

function ProjectStatusCell({
  p,
  editable,
  onChange,
}: {
  p: Project;
  editable: boolean;
  onChange: (next: TechTaskStatus) => void;
}) {
  if (editable) {
    return (
      <TechTaskStatusSelect
        value={getTechTaskStatus(p)}
        onChange={onChange}
      />
    );
  }
  return (
    <TechnicalWorkflowStatusBadge
      status={p.status}
      projectDeadline={p.projectDeadline}
      projectWorkStatus={p.projectWorkStatus}
      projectPhase={p.projectPhase}
      technicalAssignments={p.technicalAssignments}
    />
  );
}

function TechTaskStatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: TechTaskStatus;
  disabled?: boolean;
  onChange: (next: TechTaskStatus) => void;
}) {
  const styles =
    value === "completed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : value === "in_progress"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : "bg-amber-50 text-amber-800 border-amber-200";
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as TechTaskStatus)}
      className={`h-8 max-w-full rounded-lg border px-2 text-[10px] xl:text-[11px] font-bold outline-none cursor-pointer disabled:opacity-60 ${styles}`}
      title="Task status"
    >
      {TECH_TASK_STATUS_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function PricingQaSelect({
  phase,
  disabled,
  onChange,
}: {
  phase?: string | null;
  disabled?: boolean;
  onChange: (mode: PricingQaMode) => void;
}) {
  const mode = getPricingQaMode(phase);
  return (
    <select
      value={mode || ""}
      disabled={disabled}
      onChange={(e) => {
        const v = e.target.value as PricingQaMode;
        if (v) onChange(v);
      }}
      className="h-8 w-full max-w-full rounded-lg border border-violet-200 bg-violet-50 text-violet-800 px-1.5 text-[10px] font-bold outline-none cursor-pointer disabled:opacity-60"
      title="QA type — shown to Admin in real time"
    >
      <option value="" disabled>
        Select QA…
      </option>
      {PRICING_QA_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function AssignedToCell({
  assignments,
  onAssign,
  showTakeoff,
  onToggleTakeoff,
  detailed = false,
  onSendPricing,
  showSendPricing = false,
  assignmentFilter = "all",
}: {
  assignments: TechnicalAssignment[];
  onAssign: () => void;
  showTakeoff?: boolean;
  onToggleTakeoff?: (estimatorId: string, done: boolean) => void;
  detailed?: boolean;
  onSendPricing?: (estimatorId: string) => void;
  showSendPricing?: boolean;
  /** assigned tab = working only; takeoff_done = ready only */
  assignmentFilter?: "all" | "working" | "takeoff_ready";
}) {
  const panelW = 300;
  const { open, toggle, anchorRef, panelRef, style } = useFixedPopover(panelW, 320, "end");
  const [now, setNow] = useState(() => Date.now());

  const visible = assignments.filter((a) => {
    if (assignmentFilter === "working") return isAssignmentWorking(a);
    if (assignmentFilter === "takeoff_ready") return isAssignmentTakeoffReady(a);
    return true;
  });

  const anyLive = visible.some((a) => !!a.timerStartedAt && !a.takeoffDone);
  useEffect(() => {
    if (!open && !anyLive) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [open, anyLive]);

  if (assignments.length === 0) {
    return (
      <button
        type="button"
        onClick={onAssign}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#B8112D] text-white text-[11px] font-semibold hover:bg-[#a30f27] transition-colors shadow-sm shadow-red-100"
      >
        <UserPlus size={12} />
        Assign
      </button>
    );
  }

  if (visible.length === 0) {
    return <span className="text-[11px] text-gray-400">—</span>;
  }

  const primary = visible[0]!;
  const extra = visible.length - 1;
  const doneCount = visible.filter((a) => a.takeoffDone).length;
  const canToggle = Boolean((showTakeoff || detailed) && onToggleTakeoff);
  const canPrice = Boolean(showSendPricing && onSendPricing);

  const popup =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={style}
        className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 max-h-80 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2.5 py-1.5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">
            Estimators ({visible.length})
          </span>
          {detailed && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
              {doneCount}/{visible.length} done
            </span>
          )}
        </div>
        {visible.map((a) => {
          const elapsed = formatElapsed(assignmentElapsedSeconds(a, now));
          const running = !!a.timerStartedAt;
          const showPriceBtn = a.takeoffDone && !a.pricingSent && canPrice;
          return (
            <div
              key={a.estimatorId}
              className="flex flex-col gap-1 min-w-0 px-2.5 py-2 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-start gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#B8112D] text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                  {a.estimatorName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-[12px] font-bold text-[#0F172A] truncate leading-tight">
                    {a.estimatorName}
                  </p>
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-extrabold ${
                        a.pricingSent
                          ? "bg-violet-100 text-violet-800"
                          : a.takeoffDone
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {a.pricingSent ? "Pricing" : a.takeoffDone ? "Completed" : "Pending"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums ${
                        running ? "bg-sky-100 text-sky-800" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      Time {elapsed}
                      {running ? " · Live" : ""}
                    </span>
                    {a.divisions?.length ? (
                      <span className="text-[10px] font-semibold text-gray-600 truncate max-w-[100px]">
                        {formatDivisionSummary(a.divisions)}
                      </span>
                    ) : null}
                  </div>
                  {(canToggle || showPriceBtn) && (
                    <div className="flex flex-wrap items-center gap-1">
                      {canToggle && onToggleTakeoff && !a.pricingSent && (
                        <button
                          type="button"
                          title={a.takeoffDone ? "Set back to pending" : "Mark completed"}
                          onClick={() => onToggleTakeoff(a.estimatorId, !a.takeoffDone)}
                          className={`h-6 w-fit px-2 rounded-md inline-flex items-center justify-center text-[9px] font-bold gap-1 ${
                            a.takeoffDone
                              ? "bg-amber-500 text-white hover:bg-amber-600"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {a.takeoffDone ? (
                            <>
                              <RotateCcw size={10} /> Pending
                            </>
                          ) : (
                            <>
                              <Check size={11} /> Done
                            </>
                          )}
                        </button>
                      )}
                      {showPriceBtn && (
                        <button
                          type="button"
                          title="Send this estimator for Pricing"
                          onClick={() => onSendPricing?.(a.estimatorId)}
                          className="h-6 w-fit px-2 rounded-md bg-violet-600 text-white text-[9px] font-bold hover:bg-violet-700 inline-flex items-center justify-center gap-1"
                        >
                          <Calculator size={10} /> Pricing
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="border-t border-gray-100 px-2.5 py-2">
          <button
            type="button"
            onClick={() => onAssign()}
            className="w-full h-8 rounded-lg bg-[#B8112D] text-white text-[11px] font-bold hover:bg-[#a30f27] inline-flex items-center justify-center gap-1.5"
          >
            <UserPlus size={12} />
            Reassign
          </button>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-1 min-w-0 max-w-full">
        <button
          ref={anchorRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          className="flex items-center gap-1.5 min-w-0 flex-1 max-w-[200px] rounded-lg bg-[#F8F9FC] border border-gray-200 px-1.5 py-1 hover:border-[#B8112D]/40 transition-colors text-left"
          title="View all estimators"
        >
          <div className="flex items-center -space-x-1.5 shrink-0">
            {visible.slice(0, 2).map((a) => (
              <div
                key={a.estimatorId}
                className="w-5 h-5 rounded-full bg-[#B8112D] text-white flex items-center justify-center text-[9px] font-bold border border-white"
              >
                {a.estimatorName.charAt(0)}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[#0F172A] truncate leading-tight">
              {primary.estimatorName}
            </p>
            <p className="text-[9px] font-semibold truncate leading-tight">
              {detailed ? (
                <span
                  className={
                    primary.pricingSent
                      ? "text-violet-700"
                      : primary.takeoffDone
                        ? "text-emerald-700"
                        : "text-amber-700"
                  }
                >
                  {primary.pricingSent
                    ? "Pricing"
                    : primary.takeoffDone
                      ? "Completed"
                      : "Pending"}
                  {` · ${doneCount}/${visible.length}`}
                </span>
              ) : (
                <span className="text-gray-600">
                  {primary.manHours ? `${primary.manHours}h` : "—"}
                  {extra > 0 ? ` · ${visible.length}` : ""}
                </span>
              )}
            </p>
          </div>
          {extra > 0 && (
            <span className="shrink-0 h-5 min-w-[20px] px-1 rounded-md bg-[#B8112D] text-white text-[10px] font-bold flex items-center justify-center">
              +{extra}
            </span>
          )}
        </button>
        {canToggle && onToggleTakeoff && visible.length === 1 && !primary.pricingSent && (
          <button
            type="button"
            title={primary.takeoffDone ? "Set back to pending" : "Mark completed"}
            onClick={() => onToggleTakeoff(primary.estimatorId, !primary.takeoffDone)}
            className={`h-6 px-1.5 rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold ${
              primary.takeoffDone
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {primary.takeoffDone ? <RotateCcw size={10} /> : <Check size={11} />}
          </button>
        )}
        <button
          type="button"
          onClick={onAssign}
          className="h-6 px-1.5 rounded-md bg-[#B8112D] text-white flex items-center justify-center shrink-0 hover:bg-[#a30f27] text-[9px] font-bold gap-0.5"
          title="Reassign"
        >
          <UserPlus size={11} />
        </button>
      </div>
      {popup}
    </div>
  );
}

function AssignmentHoursCell({ assignments }: { assignments: TechnicalAssignment[] }) {
  const panelW = 260;
  const { open, toggle, anchorRef, panelRef, style } = useFixedPopover(panelW, 280, "start");
  const first = assignments[0];
  const extra = Math.max(0, assignments.length - 1);

  if (!first) return <span className="text-xs text-gray-400">—</span>;

  const popup =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={style}
        className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 max-h-72 overflow-y-auto z-[80]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2.5 py-1.5 border-b border-gray-100 text-[10px] font-bold text-gray-600 uppercase">
          Man hours ({assignments.length})
        </div>
        {assignments.map((a) => (
          <div
            key={a.estimatorId}
            className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-gray-50 last:border-0"
          >
            <p className="text-[11px] font-bold text-[#0F172A] truncate">{a.estimatorName}</p>
            <p className="text-[11px] font-semibold text-gray-700 tabular-nums shrink-0">
              {a.manHours ? `${a.manHours}h` : "—"}
            </p>
          </div>
        ))}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (assignments.length > 1) toggle();
        }}
        className={`text-[11px] font-semibold text-gray-700 whitespace-nowrap inline-flex items-center gap-1 rounded-md px-1 py-0.5 ${
          extra > 0 ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"
        }`}
        title={extra > 0 ? "View all man hours" : undefined}
      >
        {first.manHours ? `${first.manHours}h` : "—"}
        {extra > 0 && (
          <span className="text-[9px] font-bold text-[#B8112D] bg-[#FFF1F3] px-1 rounded">
            +{extra}
          </span>
        )}
      </button>
      {popup}
    </>
  );
}

function AssignmentDeadlineCell({ assignments }: { assignments: TechnicalAssignment[] }) {
  const panelW = 280;
  const { open, toggle, anchorRef, panelRef, style } = useFixedPopover(panelW, 280, "start");
  const first = assignments[0];
  const extra = Math.max(0, assignments.length - 1);

  if (!first) return <span className="text-xs text-gray-400">—</span>;

  const popup =
    open &&
    createPortal(
      <div
        ref={panelRef}
        style={style}
        className="bg-white border border-gray-200 rounded-xl shadow-xl py-1 max-h-72 overflow-y-auto z-[80]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-2.5 py-1.5 border-b border-gray-100 text-[10px] font-bold text-gray-600 uppercase">
          Deadlines ({assignments.length})
        </div>
        {assignments.map((a) => (
          <div
            key={a.estimatorId}
            className="flex items-center justify-between gap-2 px-2.5 py-2 border-b border-gray-50 last:border-0"
          >
            <p className="text-[11px] font-bold text-[#0F172A] truncate">{a.estimatorName}</p>
            <p className="text-[11px] font-semibold text-gray-700 shrink-0">{formatDate(a.deadline)}</p>
          </div>
        ))}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (assignments.length > 1) toggle();
        }}
        className={`text-[11px] font-semibold text-gray-700 inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 ${
          extra > 0 ? "hover:bg-gray-100 cursor-pointer" : "cursor-default"
        }`}
        title={extra > 0 ? "View all deadlines" : undefined}
      >
        <Calendar size={10} className="text-[#B8112D] shrink-0" />
        {formatDate(first.deadline)}
        {extra > 0 && (
          <span className="text-[9px] font-bold text-[#B8112D] bg-[#FFF1F3] px-1 rounded">
            +{extra}
          </span>
        )}
      </button>
      {popup}
    </>
  );
}

function ProjectRowActions({
  onEdit,
  onDelete,
  onSendPricing,
  showSendPricing = false,
  onSendFinal,
  showSendFinal = false,
  onReturnPricing,
  showReturnPricing = false,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onSendPricing?: () => void;
  showSendPricing?: boolean;
  onSendFinal?: () => void;
  showSendFinal?: boolean;
  onReturnPricing?: () => void;
  showReturnPricing?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 flex-nowrap min-w-0">
      {showSendPricing && onSendPricing && (
        <button
          type="button"
          onClick={onSendPricing}
          className="h-7 px-1.5 rounded-lg bg-violet-600 text-white text-[9px] font-bold hover:bg-violet-700 inline-flex items-center gap-0.5 shrink-0"
          title="Send for Pricing"
        >
          <Calculator size={11} className="shrink-0" />
          <span>Pricing</span>
        </button>
      )}
      {showSendFinal && onSendFinal && (
        <button
          type="button"
          onClick={onSendFinal}
          className="h-7 px-1.5 rounded-lg bg-emerald-600 text-white text-[9px] font-bold hover:bg-emerald-700 inline-flex items-center gap-0.5 shrink-0"
          title="Send for Final Submission"
        >
          <Send size={11} className="shrink-0" />
          <span>Final</span>
        </button>
      )}
      {showReturnPricing && onReturnPricing && (
        <button
          type="button"
          onClick={onReturnPricing}
          className="h-7 px-1.5 rounded-lg bg-amber-500 text-white text-[9px] font-bold hover:bg-amber-600 inline-flex items-center gap-0.5 shrink-0"
          title="Return to Pricing"
        >
          <Calculator size={11} className="shrink-0" />
          <span>Back</span>
        </button>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="w-7 h-7 rounded-lg bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 shrink-0"
        title="Edit project"
      >
        <Eye size={13} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="w-7 h-7 rounded-lg bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 shrink-0"
        title="Delete project"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export default function TechnicalActiveProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen bg-[#F5F6FA]">
          <TechnicalSidebar />
          <main className="flex-1 min-w-0 p-6 mt-[64px]">
            <div className="h-10 w-48 bg-gray-100 rounded-xl animate-pulse mb-4" />
            <div className="h-64 bg-white rounded-2xl border border-gray-100 animate-pulse" />
          </main>
        </div>
      }
    >
      <TechnicalActiveProjectsPageInner variant="active" />
    </Suspense>
  );
}

export type TechnicalProjectsVariant = "active" | "revisions";

export function TechnicalActiveProjectsPageInner({
  variant = "active",
}: {
  variant?: TechnicalProjectsVariant;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusProjectId = (searchParams.get("project") || "").trim();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [workflowTab, setWorkflowTab] = useState<TechnicalWorkflowTab>("all");
  const [estimators, setEstimators] = useState<TechnicalEstimator[]>([]);
  const [assignProject, setAssignProject] = useState<Project | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const focusHandledRef = useRef<string | null>(null);
  const isRevisions = variant === "revisions";
  const basePath = isRevisions ? "/technical/revisions" : "/technical/active-projects";

  const fetchProjects = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { leads } = await fetchAllAdminProjects<Project>({
        from: dateFrom || undefined,
        to: dateTo || undefined,
        technicalView: true,
        revisionsOnly: isRevisions,
        excludeRevisions: !isRevisions,
      });
      setProjects(Array.isArray(leads) ? leads : []);
    } catch {
      if (!silent) {
        toast.error("Failed to load projects");
        setProjects([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dateFrom, dateTo, isRevisions]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // Silent refresh every 30s (Admin Morning/COB + workflow stages)
  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchProjects(true);
    }, 30000);
    const onFocus = () => void fetchProjects(true);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchProjects]);

  const loadEstimators = useCallback(() => {
    API.get("/admin/technical-estimators")
      .then((res) => {
        const list = res.data?.estimators;
        if (Array.isArray(list) && list.length > 0) {
          setEstimators(list);
        } else {
          setEstimators([]);
          toast.error("No estimator users found. Add users with role Estimator in Admin → Users.");
        }
      })
      .catch(() => {
        setEstimators([]);
        toast.error("Failed to load estimators from users");
      });
  }, []);

  useEffect(() => {
    loadEstimators();
  }, [loadEstimators]);

  // Deep-link from TM notification bell: /technical/active-projects?project=<id>
  useEffect(() => {
    if (!focusProjectId || loading) return;
    if (focusHandledRef.current === focusProjectId) return;
    focusHandledRef.current = focusProjectId;
    let cancelled = false;

    const openFocused = async () => {
      let project: Project | null = null;
      try {
        const res = await API.get(`/admin/lead/${focusProjectId}`);
        const lead = res.data?.lead as Project | undefined;
        if (lead?.id) project = lead;
      } catch {
        /* fall through */
      }
      if (cancelled) return;
      if (!project) {
        toast.error("Project from notification not found");
        router.replace(basePath);
        return;
      }

      if (isRevisions && !project.needsRevision) {
        toast.error("This project is not in the revision queue");
        router.replace(basePath);
        return;
      }

      setProjects((prev) => (prev.some((p) => p.id === project!.id) ? prev : [project!, ...prev]));
      setWorkflowTab("all");
      setPage(1);
      setSearch(project.projectCode || project.projectTitle || "");
      setHighlightId(project.id);
      setEditProject(project);
      router.replace(basePath);
      window.setTimeout(() => {
        document
          .querySelector(`[data-project-row="${project!.id}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    };

    void openFocused();
    return () => {
      cancelled = true;
    };
  }, [focusProjectId, loading, router, basePath, isRevisions]);

  // Refresh roster every time Assign modal opens
  useEffect(() => {
    if (assignProject) loadEstimators();
  }, [assignProject, loadEstimators]);

  const addNote = async (id: string, text: string) => {
    const res = await API.post(`/admin/lead/${id}/technical-notes`, { text });
    const note = res.data.note as { id: string; text: string; createdAt: string };
    const entry: NoteEntry = { id: note.id, text: note.text, createdAt: note.createdAt };
    const list = (res.data.technicalNotes as { id: string; text: string; createdAt: string }[]) ?? null;
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? {
              ...p,
              technicalNotes: list
                ? JSON.stringify(list)
                : JSON.stringify([...parseTechnicalNotes(p.technicalNotes), note]),
            }
          : p,
      ),
    );
    return entry;
  };

  const confirmAssign = async (assignments: TechnicalAssignment[]) => {
    if (!assignProject) return;
    setAssignSaving(true);
    try {
      const res = await API.put(`/admin/project/${assignProject.id}/assign-estimators`, {
        assignments,
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success("Estimators assigned");
      setAssignProject(null);
    } catch {
      toast.error("Failed to assign estimators");
    } finally {
      setAssignSaving(false);
    }
  };

  const toggleTakeoff = async (projectId: string, estimatorId: string, takeoffDone: boolean) => {
    try {
      const res = await API.put(`/admin/project/${projectId}/estimator-takeoff`, {
        estimatorId,
        takeoffDone,
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success(
        takeoffDone
          ? "Marked Done — this estimator moved to Take Off Done"
          : "Set back to pending — estimator can work again",
      );
    } catch {
      toast.error("Failed to update task status");
    }
  };

  const sendForPricing = async (projectId: string, estimatorId?: string) => {
    try {
      const res = await API.put(`/admin/project/${projectId}/send-pricing`, {
        ...(estimatorId ? { estimatorId } : {}),
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success(
        estimatorId
          ? "Estimator sent for Pricing — others stay where they are"
          : "Sent for Pricing",
      );
      const stillReady = parseTechnicalAssignments(lead.technicalAssignments).some(
        isAssignmentTakeoffReady,
      );
      const stillWorking = parseTechnicalAssignments(lead.technicalAssignments).some(
        isAssignmentWorking,
      );
      if (stillReady) setWorkflowTab("takeoff_done");
      else if (stillWorking) setWorkflowTab("assigned");
      else setWorkflowTab("pricing");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to send for pricing";
      toast.error(msg);
    }
  };

  const sendForFinalSubmission = async (projectId: string) => {
    // Optimistic: move to Final immediately so UI never feels “stuck”
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, projectPhase: "qa_phase" } : p)),
    );
    try {
      const res = await API.put(`/admin/project/${projectId}/send-final-submission`, {});
      const lead = (res.data?.lead ?? res.data) as Project | undefined;
      if (lead?.id) {
        setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      }
      toast.success("Sent for Final Submission");
      setWorkflowTab("final_submission");
      void fetchProjects(true);
    } catch (err: unknown) {
      void fetchProjects(true);
      toast.error(apiErrorMessage(err, "Failed to send for final submission"));
    }
  };

  const returnToPricing = async (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, projectPhase: "pricing_phase" } : p)),
    );
    try {
      const res = await API.put(`/admin/project/${projectId}/return-pricing`, {});
      const lead = (res.data?.lead ?? res.data) as Project | undefined;
      if (lead?.id) {
        setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      }
      toast.success("Returned to Pricing");
      setWorkflowTab("pricing");
      void fetchProjects(true);
    } catch (err: unknown) {
      void fetchProjects(true);
      toast.error(apiErrorMessage(err, "Failed to return to pricing"));
    }
  };

  const setPricingQa = async (projectId: string, mode: PricingQaMode) => {
    try {
      const res = await API.put(`/admin/project/${projectId}/pricing-qa`, { mode });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success("QA status updated — Admin can see it live");
    } catch {
      toast.error("Failed to update QA status");
    }
  };

  const changeTaskStatus = async (projectId: string, status: TechTaskStatus) => {
    try {
      const projectWorkStatus =
        status === "pending" ? "pending" : status === "completed" ? "completed" : "in_progress";
      const res = await API.put(`/admin/project/${projectId}`, { projectWorkStatus });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const saveEdit = async (data: ProjectWorkbenchData) => {
    setEditSaving(true);
    try {
      // Technical must not overwrite client identity fields
      const res = await API.put(`/admin/project/${data.id}`, {
        state: data.state,
        projectCode: data.projectCode,
        projectTitle: data.projectTitle,
        projectScope: data.projectScope,
        interestedService: data.interestedService,
        projectDeadline: data.projectDeadline,
        deadlineTiming: data.deadlineTiming || "",
        projectPhase: data.projectPhase,
        takeoffDeadline: data.takeoffDeadline,
        pricingDeadline: data.pricingDeadline,
        qaDeadline: data.qaDeadline,
        projectNotes: data.projectNotes,
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead, name: null, ownerName: null } : p)));
      setEditProject(null);
      toast.success("Project updated");
    } catch {
      toast.error("Failed to save project");
    } finally {
      setEditSaving(false);
    }
  };

  const deleteProject = async (p: Project, opts?: { skipConfirm?: boolean }) => {
    const title = p.projectTitle || p.projectCode || p.clientCode || "this project";
    if (
      !opts?.skipConfirm &&
      !window.confirm(`Remove "${title}" from Technical? It will stay in Admin Project DB.`)
    ) {
      return;
    }
    try {
      await API.put(`/admin/project/${p.id}/hide-technical`);
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      if (editProject?.id === p.id) setEditProject(null);
      toast.success("Removed from Technical");
    } catch {
      toast.error("Failed to remove from Technical");
    }
  };

  const baseFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter((p) => {
      const assignments = parseTechnicalAssignments(p.technicalAssignments);
      const assignNames = assignments.map((a) => a.estimatorName).join(" ");
      const matchSearch =
        !q ||
        (p.projectTitle ?? "").toLowerCase().includes(q) ||
        (p.projectCode ?? "").toLowerCase().includes(q) ||
        (p.clientCode ?? "").toLowerCase().includes(q) ||
        (p.projectScope ?? "").toLowerCase().includes(q) ||
        assignNames.toLowerCase().includes(q);
      const matchState = matchesStateLocationFilter(p.state, p.phone, stateFilter);
      const matchPhone = matchesPhoneAreaCodeFilter(p.phone, phoneFilter);
      return matchSearch && matchState && matchPhone;
    });
  }, [projects, search, stateFilter, phoneFilter]);

  const tabCounts = useMemo(() => {
    const counts: Record<TechnicalWorkflowTab, number> = {
      all: baseFiltered.length,
      not_assigned: 0,
      assigned: 0,
      takeoff_done: 0,
      pricing: 0,
      final_submission: 0,
    };
    for (const p of baseFiltered) {
      (["not_assigned", "assigned", "takeoff_done", "pricing", "final_submission"] as const).forEach(
        (tab) => {
          if (matchesTechnicalTab(tab, p)) counts[tab] += 1;
        },
      );
    }
    return counts;
  }, [baseFiltered]);

  const displayed = useMemo(
    () => baseFiltered.filter((p) => matchesTechnicalTab(workflowTab, p)),
    [baseFiltered, workflowTab],
  );

  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const paginated = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const isAssignedView = workflowTab === "assigned" || workflowTab === "takeoff_done";
  const isPricingView = workflowTab === "pricing";
  const isFinalView = workflowTab === "final_submission";
  const showAssignColumn = !isAssignedView && !isPricingView && !isFinalView;
  const assignmentFilter = "all" as const;
  const isTakeoffDoneView = workflowTab === "takeoff_done";

  const headers = isAssignedView
    ? ["Project Details", "Man Hours", "Deadline", "Bid Instruction", "Notes for Sir", "Estimators", "Status", "Actions"]
    : isPricingView
      ? ["Project / Scope", "Receive Date", "Deadline", "Bid Instruction", "Notes for Sir", "QA Status", "Status", "Actions"]
      : isFinalView
        ? ["Project Details", "Receive Date", "Deadline", "Bid Instruction", "Notes for Sir", "Actions"]
        : [
            "Project Details",
            "Receive Date",
            "Deadline",
            "Bid Instruction",
            "Notes for Sir",
            "Assigned To",
            "Status",
            "Actions",
          ];
  const colWidths = isAssignedView
    ? TECHNICAL_ASSIGNED_COLS
    : isPricingView
      ? TECHNICAL_PRICING_COLS
      : isFinalView
        ? TECHNICAL_FINAL_COLS
        : TECHNICAL_PROJECT_COLS;

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }} />
      <TechnicalSidebar />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 overflow-x-hidden mt-[64px]">
        <DashboardNavbar />

        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">
              {isRevisions ? "Revisions" : "Active Projects"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
              {isRevisions
                ? "Admin-sent revision projects — assign estimators like Active Projects."
                : "Technical workflow — assign estimators, track takeoff, pricing & submission."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void fetchProjects()}
              disabled={loading}
              className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-gray-200 bg-white text-xs sm:text-sm font-semibold text-gray-700 inline-flex items-center justify-center gap-2 hover:border-[#B8112D]/40 hover:text-[#B8112D] hover:bg-[#FFF6F7] disabled:opacity-60 shadow-sm"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <div className="flex items-center gap-2 bg-[#ECFDF5] text-[#065F46] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold w-fit">
              <div className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
              Live Data
            </div>
          </div>
        </div>

        <CapsuleTabs
          className="mb-4 sm:mb-5"
          activeKey={workflowTab}
          onChange={(key) => {
            setWorkflowTab(key);
            setPage(1);
          }}
          tabs={[
            { key: "all", label: "All Projects", shortLabel: "All", count: tabCounts.all, icon: Layers },
            {
              key: "not_assigned",
              label: "Not Assigned",
              shortLabel: "Unassigned",
              count: tabCounts.not_assigned,
              icon: ClipboardList,
            },
            {
              key: "assigned",
              label: "Assigned",
              shortLabel: "Assigned",
              count: tabCounts.assigned,
              icon: Users,
            },
            {
              key: "takeoff_done",
              label: "Take Off Done",
              shortLabel: "Takeoff",
              count: tabCounts.takeoff_done,
              icon: CheckCircle2,
            },
            {
              key: "pricing",
              label: "Pricing",
              shortLabel: "Pricing",
              count: tabCounts.pricing,
              icon: Calculator,
            },
            {
              key: "final_submission",
              label: "Final Submission",
              shortLabel: "Final",
              count: tabCounts.final_submission,
              icon: Send,
            },
          ]}
        />

        <div className="flex flex-nowrap items-center gap-2 mb-4 sm:mb-5 overflow-x-auto pb-1 accounts-nav-scroll">
          <div className="relative flex-1 min-w-[180px] max-w-[280px] shrink-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search code, title, scope..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 sm:h-[42px] bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-9 pr-3 text-sm outline-none focus:border-[#B8112D]"
            />
          </div>
          <div className="shrink-0">
            <StateFilterDropdown
              value={stateFilter}
              onChange={(v) => {
                setStateFilter(v);
                setPage(1);
              }}
            />
          </div>
          <PhoneAreaCodeFilterInput
            value={phoneFilter}
            onChange={(v) => {
              setPhoneFilter(v);
              setPage(1);
            }}
          />
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <Calendar size={14} className="text-gray-400 shrink-0" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-10 sm:h-[42px] w-[132px] bg-white border border-gray-200 rounded-xl px-2 text-xs sm:text-sm outline-none focus:border-[#B8112D]"
            />
            <span className="text-[11px] text-gray-400 shrink-0">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-10 sm:h-[42px] w-[132px] bg-white border border-gray-200 rounded-xl px-2 text-xs sm:text-sm outline-none focus:border-[#B8112D]"
            />
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
                className="h-10 sm:h-[42px] px-3 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-all shrink-0 whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden space-y-3">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-36 animate-pulse" />
            ))
          ) : paginated.length > 0 ? (
            paginated.map((p) => {
              const assignments = parseTechnicalAssignments(p.technicalAssignments);
              const anyReady = assignments.some(isAssignmentTakeoffReady);
              return (
                <div
                  key={p.id}
                  data-project-row={p.id}
                  className={`bg-white rounded-2xl border p-4 shadow-sm space-y-3 ${
                    highlightId === p.id
                      ? "border-[#B8112D] ring-2 ring-[#B8112D]/20"
                      : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      {isPricingView ? (
                        <PricingProjectDetailCell p={p} assignments={assignments} />
                      ) : (
                        <ProjectDetailCell p={projectAsRow(p)} />
                      )}
                    </div>
                    <div className="flex flex-col items-start gap-2 shrink-0">
                      {!isFinalView && (
                        <ProjectStatusCell
                          p={p}
                          editable={isPricingView}
                          onChange={(next) => void changeTaskStatus(p.id, next)}
                        />
                      )}
                      <ProjectRowActions
                        onEdit={() => setEditProject(p)}
                        onDelete={() => void deleteProject(p)}
                        showSendPricing={isTakeoffDoneView && anyReady}
                        onSendPricing={() => void sendForPricing(p.id)}
                        showSendFinal={isPricingView}
                        onSendFinal={() => void sendForFinalSubmission(p.id)}
                        showReturnPricing={isFinalView}
                        onReturnPricing={() => void returnToPricing(p.id)}
                      />
                    </div>
                  </div>
                  {isAssignedView ? (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Man Hours</p>
                        <AssignmentHoursCell assignments={assignments} />
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Deadline</p>
                        <div className="space-y-1">
                          <AssignmentDeadlineCell assignments={assignments} />
                          <DeadlineTimingBadge timing={p.deadlineTiming} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Receive Date</p>
                        <p className="font-semibold text-gray-700">
                          {formatDate(isPricingView ? pricingReceiveDate(p) : projectReceiveDate(p))}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">Deadline</p>
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-700">{formatDate(p.projectDeadline)}</p>
                          <DeadlineTimingBadge timing={p.deadlineTiming} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Bid Instruction</p>
                    <CommentCell
                      id={p.id}
                      apiRole="admin"
                      readOnly
                      skipNotesFetch
                      comment={p.projectNotes ?? undefined}
                      noteHistory={notesToHistory(p.notes)}
                    />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Notes for Sir</p>
                    <CommentCell
                      id={p.id}
                      apiRole="admin"
                      skipNotesFetch
                      noteHistory={notesToHistory(parseTechnicalNotes(p.technicalNotes))}
                      onAddNote={addNote}
                    />
                  </div>
                  {isPricingView && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">QA Status</p>
                      <PricingQaSelect
                        phase={p.projectPhase}
                        onChange={(mode) => void setPricingQa(p.id, mode)}
                      />
                    </div>
                  )}
                  {showAssignColumn && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Assigned To</p>
                      <AssignedToCell
                        assignments={assignments}
                        onAssign={() => setAssignProject(p)}
                        showTakeoff={false}
                        onToggleTakeoff={(eid, done) => void toggleTakeoff(p.id, eid, done)}
                      />
                    </div>
                  )}
                  {isAssignedView && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1.5">Estimators</p>
                      <AssignedToCell
                        assignments={assignments}
                        onAssign={() => setAssignProject(p)}
                        showTakeoff
                        detailed
                        assignmentFilter={assignmentFilter}
                        showSendPricing={isTakeoffDoneView}
                        onSendPricing={(eid) => void sendForPricing(p.id, eid)}
                        onToggleTakeoff={(eid, done) => void toggleTakeoff(p.id, eid, done)}
                      />
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
              <FolderKanban size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium text-sm">No projects found</p>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className={`hidden lg:block ${PROJECT_TABLE_CARD} min-w-0`}>
          <div className="min-w-0 w-full overflow-x-hidden">
            <table className="w-full table-fixed border-collapse">
              <CsrColGroup widths={colWidths} />
              <thead className={CSR_THEAD}>
                <tr className="text-left">
                  {headers.map((h, i) => (
                    <th
                      key={i}
                      className={`px-2 xl:px-3 py-3 leading-tight ${PROJECT_TABLE_HEAD}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i} className="border-b border-[#F3F3F3]">
                      {headers.map((_, j) => (
                        <td key={j} className="px-2 xl:px-3 py-4">
                          <div className="h-4 bg-gray-100 rounded animate-pulse w-16" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : paginated.length > 0 ? (
                  paginated.map((p) => {
                    const assignments = parseTechnicalAssignments(p.technicalAssignments);
                    const anyReady = assignments.some(isAssignmentTakeoffReady);
                    return (
                      <tr
                        key={p.id}
                        data-project-row={p.id}
                        className={`border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-all align-top ${
                          highlightId === p.id ? "bg-[#FFF1F3] ring-2 ring-inset ring-[#B8112D]/30" : ""
                        }`}
                      >
                        <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0 overflow-hidden">
                          {isPricingView ? (
                            <PricingProjectDetailCell p={p} assignments={assignments} />
                          ) : (
                            <ProjectDetailCell p={projectAsRow(p)} />
                          )}
                        </td>
                        {isAssignedView ? (
                          <>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <AssignmentHoursCell assignments={assignments} />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <div className="space-y-1">
                                <AssignmentDeadlineCell assignments={assignments} />
                                <DeadlineTimingBadge timing={p.deadlineTiming} />
                              </div>
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <CommentCell
                                id={p.id}
                                apiRole="admin"
                                readOnly
                                skipNotesFetch
                                comment={p.projectNotes ?? undefined}
                                noteHistory={notesToHistory(p.notes)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <CommentCell
                                id={p.id}
                                apiRole="admin"
                                skipNotesFetch
                                noteHistory={notesToHistory(parseTechnicalNotes(p.technicalNotes))}
                                onAddNote={addNote}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0 overflow-visible">
                              <AssignedToCell
                                assignments={assignments}
                                onAssign={() => setAssignProject(p)}
                                detailed
                                showTakeoff
                                assignmentFilter={assignmentFilter}
                                showSendPricing={isTakeoffDoneView}
                                onSendPricing={(eid) => void sendForPricing(p.id, eid)}
                                onToggleTakeoff={(eid, done) => void toggleTakeoff(p.id, eid, done)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <ProjectStatusCell
                                p={p}
                                editable={isPricingView}
                                onChange={(next) => void changeTaskStatus(p.id, next)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <ProjectRowActions
                                onEdit={() => setEditProject(p)}
                                onDelete={() => void deleteProject(p)}
                                showSendPricing={isTakeoffDoneView && anyReady}
                                onSendPricing={() => void sendForPricing(p.id)}
                              />
                            </td>
                          </>
                        ) : isPricingView ? (
                          <>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <p className="text-[10px] xl:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                <Calendar size={10} className="text-[#B8112D] shrink-0" />
                                {formatDate(pricingReceiveDate(p))}
                              </p>
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <div className="space-y-1">
                                <p className="text-[10px] xl:text-xs font-semibold text-gray-700">
                                  {formatDate(p.projectDeadline)}
                                </p>
                                <DeadlineTimingBadge timing={p.deadlineTiming} />
                              </div>
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <CommentCell
                                id={p.id}
                                apiRole="admin"
                                readOnly
                                skipNotesFetch
                                comment={p.projectNotes ?? undefined}
                                noteHistory={notesToHistory(p.notes)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <CommentCell
                                id={p.id}
                                apiRole="admin"
                                skipNotesFetch
                                noteHistory={notesToHistory(parseTechnicalNotes(p.technicalNotes))}
                                onAddNote={addNote}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <PricingQaSelect
                                phase={p.projectPhase}
                                onChange={(mode) => void setPricingQa(p.id, mode)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <ProjectStatusCell
                                p={p}
                                editable={isPricingView}
                                onChange={(next) => void changeTaskStatus(p.id, next)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <ProjectRowActions
                                onEdit={() => setEditProject(p)}
                                onDelete={() => void deleteProject(p)}
                                showSendFinal
                                onSendFinal={() => void sendForFinalSubmission(p.id)}
                              />
                            </td>
                          </>
                        ) : isFinalView ? (
                          <>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <p className="text-[10px] xl:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                <Calendar size={10} className="text-[#B8112D] shrink-0" />
                                {formatDate(projectReceiveDate(p))}
                              </p>
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <div className="space-y-1">
                                <p className="text-[10px] xl:text-xs font-semibold text-gray-700">
                                  {formatDate(p.projectDeadline)}
                                </p>
                                <DeadlineTimingBadge timing={p.deadlineTiming} />
                              </div>
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <CommentCell
                                id={p.id}
                                apiRole="admin"
                                readOnly
                                skipNotesFetch
                                comment={p.projectNotes ?? undefined}
                                noteHistory={notesToHistory(p.notes)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <CommentCell
                                id={p.id}
                                apiRole="admin"
                                skipNotesFetch
                                noteHistory={notesToHistory(parseTechnicalNotes(p.technicalNotes))}
                                onAddNote={addNote}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0 overflow-visible">
                              <ProjectRowActions
                                onEdit={() => setEditProject(p)}
                                onDelete={() => void deleteProject(p)}
                                showReturnPricing
                                onReturnPricing={() => void returnToPricing(p.id)}
                              />
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <p className="text-[10px] xl:text-xs font-semibold text-gray-700 flex items-center gap-1">
                                <Calendar size={10} className="text-[#B8112D] shrink-0" />
                                {formatDate(projectReceiveDate(p))}
                              </p>
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <div className="space-y-1">
                                <p className="text-[10px] xl:text-xs font-semibold text-gray-700">
                                  {formatDate(p.projectDeadline)}
                                </p>
                                <DeadlineTimingBadge timing={p.deadlineTiming} />
                              </div>
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <CommentCell
                                id={p.id}
                                apiRole="admin"
                                readOnly
                                skipNotesFetch
                                comment={p.projectNotes ?? undefined}
                                noteHistory={notesToHistory(p.notes)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <CommentCell
                                id={p.id}
                                apiRole="admin"
                                skipNotesFetch
                                noteHistory={notesToHistory(parseTechnicalNotes(p.technicalNotes))}
                                onAddNote={addNote}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <AssignedToCell
                                assignments={assignments}
                                onAssign={() => setAssignProject(p)}
                                showTakeoff={false}
                                onToggleTakeoff={(eid, done) => void toggleTakeoff(p.id, eid, done)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0">
                              <ProjectStatusCell
                                p={p}
                                editable={isPricingView}
                                onChange={(next) => void changeTaskStatus(p.id, next)}
                              />
                            </td>
                            <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0 overflow-visible">
                              <ProjectRowActions
                                onEdit={() => setEditProject(p)}
                                onDelete={() => void deleteProject(p)}
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={headers.length} className="py-16 text-center">
                      <FolderKanban size={36} className="text-gray-200 mx-auto mb-3" />
                      <p className="font-semibold text-gray-400 text-sm">No projects found</p>
                      <p className="text-xs text-gray-300 mt-1">
                        {search ? "Try a different search." : "No projects in this section yet."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, displayed.length)} of{" "}
                {displayed.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg"
                >
                  ‹
                </button>
                <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      <AssignEstimatorsModal
        open={!!assignProject}
        project={assignProject}
        estimators={estimators}
        saving={assignSaving}
        onClose={() => setAssignProject(null)}
        onConfirm={confirmAssign}
      />

      <ProjectWorkbenchModal
        open={!!editProject}
        onClose={() => setEditProject(null)}
        initial={editProject ? projectToWorkbench(editProject) : emptyWorkbench()}
        mode="admin"
        saving={editSaving}
        onSave={saveEdit}
        onDelete={editProject ? async () => { await deleteProject(editProject, { skipConfirm: true }); } : undefined}
        noteHistory={editProject ? notesToHistory(editProject.notes) : undefined}
        onAddNote={
          editProject
            ? async (text) => {
                await addNote(editProject.id, text);
              }
            : undefined
        }
        hideClientFinanceSections
      />
    </div>
  );
}
