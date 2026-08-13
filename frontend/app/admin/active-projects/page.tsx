"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, FolderKanban, X, Eye,
  Calendar, Building2, User2,
  ChevronDown, ArrowRightLeft, Check, RefreshCw,
  Plus, GitBranch, CheckCircle2, Download, Upload,
} from "lucide-react";

import CapsuleTabs from "@/app/components/CapsuleTabs";
import { StaffSidebar } from "@/app/hooks/useStaffSidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import ProjectWorkbenchModal from "@/app/components/projects/ProjectWorkbenchModal";
import CommentCell from "@/app/csr/components/shared/CommentCell";
import StateFilterDropdown from "@/app/csr/components/shared/StateFilterDropdown";
import PhoneAreaCodeFilterInput from "@/app/csr/components/shared/PhoneAreaCodeFilterInput";
import { matchesStateLocationFilter, matchesPhoneAreaCodeFilter } from "@/lib/stateLocationFilter";
import { NoteEntry } from "@/app/csr/hooks/useLeadsData";
import { buildNoteHistory } from "@/app/csr/utils/noteHistory";
import { useClientPhoneLookup, ClientLookupData } from "@/app/csr/hooks/useClientPhoneLookup";
import { ADMIN_PROJECT_COLS, ADMIN_TECH_VIEW_COLS, CsrColGroup, CSR_THEAD } from "@/app/csr/components/shared/csrTableStyles";
import { parseTechnicalNotes, parseTechnicalNotesBundle, getTechnicalWorkflowStatus } from "@/lib/technicalAssignments";
import { peekAuthMe } from "@/lib/authMeCache";
import API from "@/lib/api";
import { fetchAllAdminProjects } from "@/lib/fetchAdminProjects";
import {
  ClientDetailCell,
  FulfillmentCell,
  PaymentDetailCell,
  ProjectDetailCell,
  QuotedAmountCell,
  TechnicalWorkflowStatusBadge,
  PROJECT_TABLE_CARD,
  PROJECT_TABLE_HEAD,
} from "@/app/components/projects/ProjectTableCells";
import {
  emptyWorkbench,
  parsePayments,
  isProjectActive,
  getProjectWorkStatus,
  ProjectWorkbenchData,
  CSR_ASSIGN_OTHER,
  PROJECT_PHASE_OPTIONS,
  PAYMENT_TYPE_FILTER_OPTIONS,
  matchesPaymentCollectionFilter,
  paymentPercent,
} from "@/lib/projectFields";

function phaseLabel(value: string) {
  return PROJECT_PHASE_OPTIONS.find(o => o.value === value)?.label ?? value;
}

const ProjectOverviewCharts = dynamic(() => import("./ProjectOverviewCharts"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="h-[200px] bg-gray-50 rounded-2xl animate-pulse" />
      <div className="h-[200px] bg-gray-50 rounded-2xl animate-pulse" />
    </div>
  ),
});

type Project = {
  id:                string;
  name:              string | null;
  company:           string | null;
  phone:             string | null;
  email:             string | null;
  status:            string;
  state:             string | null;
  timezone:          string | null;
  ownerName:         string | null;
  interestedService: string | null;
  projectTitle:      string | null;
  projectCode:       string | null;
  clientCode?:       string | null;
  projectScope:      string | null;
  projectPhase:      string | null;
  projectDeadline:   string | null;
  deadlineTiming?:   string | null;
  takeoffDeadline:   string | null;
  pricingDeadline:   string | null;
  qaDeadline:        string | null;
  projectBudget:     string | null;
  projectNotes:      string | null;
  technicalNotes?:   string | null;
  projectPayments:   string | null;
  projectSource:     string | null;
  projectWorkStatus?: string | null;
  technicalAssignments?: string | null;
  needsRevision?: boolean;
  revisionRequestedAt?: string | null;
  revisionNotes?: string | null;
  isOldClient:       boolean;
  createdAt?:        string;
  updatedAt:         string;
  csr: { id: string; name: string; email: string; csrCode: string | null };
  uploadFile: { companyName: string | null } | null;
  notes?: { id: string; text: string; createdAt: string; parentId?: string | null }[];
};

function projectToWorkbench(p: Project): ProjectWorkbenchData {
  const isOther = !!p.projectSource?.trim();
  return {
    id: p.id,
    name: p.name ?? "",
    company: p.company ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    ownerName: p.ownerName ?? "",
    state: p.state ?? "",
    projectCode: p.projectCode || p.clientCode || "",
    projectTitle: p.projectTitle ?? "",
    projectScope: p.projectScope ?? "",
    interestedService: p.interestedService ?? "",
    projectBudget: p.projectBudget ?? "",
    projectDeadline: (p.projectDeadline ?? "").split("T")[0],
    deadlineTiming: (p.deadlineTiming === "morning" || p.deadlineTiming === "cob" ? p.deadlineTiming : "") as "" | "morning" | "cob",
    projectPhase: p.projectPhase ?? "not_started",
    takeoffDeadline: p.takeoffDeadline ?? "",
    pricingDeadline: p.pricingDeadline ?? "",
    qaDeadline: p.qaDeadline ?? "",
    projectPayments: parsePayments(p.projectPayments),
    assignedTo: isOther ? CSR_ASSIGN_OTHER : p.csr.id,
    projectSource: p.projectSource ?? "",
    csrName: projectAssigneeLabel(p),
    csrCode: p.projectSource ? null : p.csr.csrCode,
  };
}

type CSROption = { id: string; name: string; csrCode: string | null };
type Stats = { total: number; withBudget: number; thisMonth: number };

const serviceColors: Record<string, string> = {
  "Estimating":   "bg-blue-100 text-blue-700",
  "Scheduling":   "bg-purple-100 text-purple-700",
  "Shop Drawing": "bg-orange-100 text-orange-700",
  "Drafting":     "bg-teal-100 text-teal-700",
  "BIM":          "bg-indigo-100 text-indigo-700",
  "IT":           "bg-pink-100 text-pink-700",
};
const getServiceColor = (s: string | null) =>
  serviceColors[s ?? ""] ?? "bg-gray-100 text-gray-600";

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
};

const isOverdue = (d: string | null) => !!d && new Date(d) < new Date();


function notesToHistory(
  notes?: { id: string; text: string; createdAt: string; parentId?: string | null }[],
): NoteEntry[] {
  const { noteHistory } = buildNoteHistory({ notes: notes ?? [] });
  return noteHistory;
}

function threadNotesHistory(notes?: {
  id: string;
  text: string;
  createdAt: string;
  authorId?: string;
  authorRole?: string;
  authorName?: string;
}[]): NoteEntry[] {
  return (notes ?? [])
    .filter((n) => n.text?.trim())
    .map((n) => ({
      id: n.id,
      text: n.text,
      createdAt: n.createdAt,
      authorId: n.authorId,
      authorRole: n.authorRole,
      authorName: n.authorName,
    }));
}

function sirNotesHistory(p: { technicalNotes?: unknown }): NoteEntry[] {
  return threadNotesHistory(parseTechnicalNotes(p.technicalNotes));
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
    projectBudget: p.projectBudget,
    projectDeadline: p.projectDeadline,
    deadlineTiming: p.deadlineTiming,
    projectPhase: p.projectPhase,
    projectPayments: p.projectPayments,
    state: p.state,
    timezone: p.timezone,
    createdAt: p.createdAt ?? null,
  };
}

/* ── Projects Card (mobile / tablet) ── */
function canMarkProjectCompleted(p: Project) {
  return getTechnicalWorkflowStatus(p).key === "final_submission";
}

function ProjectCard({
  p,
  onView,
  onReassign,
  onRequestRevision,
  onMarkCompleted,
  onAddNote,
  onAddTechnicalNote,
  onSaveBidInstruction,
  onNoteUpdated,
  onNoteDeleted,
  onTimingChange,
  hideClientFinanceCols = false,
}: {
  p: Project;
  onView: () => void;
  onReassign: () => void;
  onRequestRevision?: () => void;
  onMarkCompleted?: () => void;
  onAddNote: (id: string, text: string) => Promise<unknown>;
  onAddTechnicalNote: (id: string, text: string) => Promise<unknown>;
  onSaveBidInstruction: (id: string, text: string) => Promise<void>;
  onNoteUpdated?: (id: string, noteId: string, text: string, createdAt?: string) => void;
  onNoteDeleted?: (id: string, noteId: string) => void;
  onTimingChange?: (id: string, timing: "" | "morning" | "cob") => void;
  hideClientFinanceCols?: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {hideClientFinanceCols ? (
            <ProjectDetailCell p={projectAsRow(p)} />
          ) : (
            <ClientDetailCell p={projectAsRow(p)} />
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {!hideClientFinanceCols && onMarkCompleted && canMarkProjectCompleted(p) && (
            <button
              type="button"
              onClick={onMarkCompleted}
              className="h-8 px-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-[10px] font-bold inline-flex items-center gap-1 hover:bg-emerald-100"
              title="Mark as completed — remove from Technical Manager"
            >
              <CheckCircle2 size={12} />
              Complete
            </button>
          )}
          {!hideClientFinanceCols && onRequestRevision && (
            <button
              onClick={onRequestRevision}
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                p.needsRevision
                  ? "bg-violet-100 text-violet-700"
                  : "bg-violet-50 text-violet-600 hover:bg-violet-100"
              }`}
              title={p.needsRevision ? "In revision queue" : "Send for revision"}
            >
              <GitBranch size={13} />
            </button>
          )}
          {!hideClientFinanceCols && (
            <button onClick={onReassign}
              className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100">
              <ArrowRightLeft size={13} />
            </button>
          )}
          <button onClick={onView}
            className="w-8 h-8 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80">
            <Eye size={13} />
          </button>
        </div>
      </div>

      {!hideClientFinanceCols && <ProjectDetailCell p={projectAsRow(p)} />}

      {!hideClientFinanceCols && (
        <div className="grid grid-cols-2 gap-3">
          <QuotedAmountCell p={projectAsRow(p)} />
          <PaymentDetailCell p={projectAsRow(p)} />
        </div>
      )}
      <FulfillmentCell
        p={projectAsRow(p)}
        onTimingChange={onTimingChange ? (next) => onTimingChange(p.id, next) : undefined}
      />

      <div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</p>
        <TechnicalWorkflowStatusBadge
          status={p.status}
          projectDeadline={p.projectDeadline}
          projectWorkStatus={p.projectWorkStatus}
          projectPhase={p.projectPhase}
          technicalAssignments={p.technicalAssignments}
        />
      </div>

      <div className="pt-1 space-y-2">
        <div>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Bid Instruction</p>
          <CommentCell
            id={p.id}
            apiRole="admin"
            commentOnly
            skipNotesFetch
            comment={p.projectNotes ?? undefined}
            onSave={(id, text) => onSaveBidInstruction(id, text)}
          />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">Notes for Technical</p>
          <CommentCell
            id={p.id}
            apiRole="admin"
            skipNotesFetch
            chatStyle
            notesKind="technical"
            currentUserId={peekAuthMe()?.id}
            badgeLabel="Notes for Technical"
            noteHistory={sirNotesHistory(p)}
            onAddNote={async (_id, text) => onAddTechnicalNote(p.id, text)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {p.uploadFile?.companyName && (
          <span className="inline-flex items-center gap-1 bg-[#FFF1F3] text-[#B8112D] px-2.5 py-1 rounded-xl text-xs font-semibold">
            <Building2 size={10} />{p.uploadFile.companyName}
          </span>
        )}
        {p.interestedService && (
          <span className={`px-2.5 py-1 rounded-xl text-xs font-semibold ${getServiceColor(p.interestedService)}`}>
            {p.interestedService}
          </span>
        )}
      </div>

      {!hideClientFinanceCols && (
        <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50 gap-2">
          <span className="font-medium truncate flex items-center gap-1.5 min-w-0">
            <ProjectCsrCell p={p} />
          </span>
          {p.email && <span className="text-gray-400 truncate max-w-[140px] shrink-0">{p.email}</span>}
        </div>
      )}
    </div>
  );
}

/* ── Projects list section ── */
function ProjectsSection({
  projects,
  page,
  setPage,
  loading,
  search,
  onView,
  onReassign,
  onRequestRevision,
  onMarkCompleted,
  onAddNote,
  onAddTechnicalNote,
  onSaveBidInstruction,
  onNoteUpdated,
  onNoteDeleted,
  onTimingChange,
  hideClientFinanceCols = false,
}: {
  projects: Project[];
  page: number;
  setPage: (p: number) => void;
  loading: boolean;
  search: string;
  onView: (p: Project) => void;
  onReassign: (p: Project) => void;
  onRequestRevision?: (p: Project) => void;
  onMarkCompleted?: (p: Project) => void;
  onAddNote: (id: string, text: string) => Promise<unknown>;
  onAddTechnicalNote: (id: string, text: string) => Promise<unknown>;
  onSaveBidInstruction: (id: string, text: string) => Promise<void>;
  onNoteUpdated?: (id: string, noteId: string, text: string, createdAt?: string) => void;
  onNoteDeleted?: (id: string, noteId: string) => void;
  onTimingChange?: (id: string, timing: "" | "morning" | "cob") => void;
  hideClientFinanceCols?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(projects.length / PAGE_SIZE));
  const paginated  = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const headers = hideClientFinanceCols
    ? ["Project Detail", "Client Deadline", "Bid Instruction", "Notes for Technical", "Status", ""]
    : ["Client Detail", "Project Detail", "Quoted", "Payment Detail", "Client Deadline", "CSR", "Bid Instruction", "Notes for Technical", "Status", ""];
  const colCount = headers.length;
  const colWidths = hideClientFinanceCols ? ADMIN_TECH_VIEW_COLS : ADMIN_PROJECT_COLS;

  return (
    <div>
      <div className="lg:hidden space-y-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 h-32 animate-pulse" />
          ))
        ) : projects.length > 0 ? (
          paginated.map((p) => (
            <ProjectCard
              key={p.id}
              p={p}
              onView={() => onView(p)}
              onReassign={() => void onReassign(p)}
              onRequestRevision={onRequestRevision ? () => onRequestRevision(p) : undefined}
              onMarkCompleted={onMarkCompleted ? () => onMarkCompleted(p) : undefined}
              onAddNote={onAddNote}
              onAddTechnicalNote={onAddTechnicalNote}
              onSaveBidInstruction={onSaveBidInstruction}
              onNoteUpdated={onNoteUpdated}
              onNoteDeleted={onNoteDeleted}
              onTimingChange={onTimingChange}
              hideClientFinanceCols={hideClientFinanceCols}
            />
          ))
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 sm:p-12 text-center">
            <FolderKanban size={32} className="text-gray-200 mx-auto mb-3 sm:w-9 sm:h-9" />
            <p className="text-gray-400 font-medium text-sm sm:text-base">No projects found</p>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-white rounded-2xl border border-gray-100">
            <p className="text-xs text-gray-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, projects.length)} of {projects.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
              <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
            </div>
          </div>
        )}
      </div>

      <div className={`hidden lg:block ${PROJECT_TABLE_CARD}`}>
        <div className="overflow-x-auto">
          <table
            className="w-full table-fixed border-collapse"
            style={{ minWidth: hideClientFinanceCols ? "720px" : "1280px" }}
          >
            <CsrColGroup widths={colWidths} />
            <thead className={CSR_THEAD}>
              <tr className="text-left">
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className={`px-3 xl:px-4 py-3 xl:py-4 whitespace-nowrap ${PROJECT_TABLE_HEAD} ${
                      i === colCount - 1 ? "text-right" : ""
                    }`}
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
                    {Array.from({ length: colCount }, (_, j) => (
                      <td key={j} className="px-3 xl:px-4 py-4 xl:py-5">
                        <div className="h-4 bg-gray-100 rounded animate-pulse w-16 xl:w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : projects.length > 0 ? (
                paginated.map((p) => (
                  <tr key={p.id} className="border-b border-[#F3F3F3] hover:bg-[#FAFAFA] transition-all align-top">
                    {!hideClientFinanceCols && (
                      <td className="px-3 xl:px-4 py-3 xl:py-4"><ClientDetailCell p={projectAsRow(p)} /></td>
                    )}
                    <td className="px-3 xl:px-4 py-3 xl:py-4"><ProjectDetailCell p={projectAsRow(p)} /></td>
                    {!hideClientFinanceCols && (
                      <>
                        <td className="px-3 xl:px-4 py-3 xl:py-4"><QuotedAmountCell p={projectAsRow(p)} /></td>
                        <td className="px-3 xl:px-4 py-3 xl:py-4"><PaymentDetailCell p={projectAsRow(p)} /></td>
                      </>
                    )}
                    <td className="px-3 xl:px-4 py-3 xl:py-4">
                      <FulfillmentCell
                        p={projectAsRow(p)}
                        onTimingChange={onTimingChange ? (next) => onTimingChange(p.id, next) : undefined}
                      />
                    </td>
                    {!hideClientFinanceCols && (
                      <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0 overflow-hidden align-top">
                        <ProjectCsrCell p={p} />
                      </td>
                    )}
                    <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0 overflow-hidden align-top">
                      <CommentCell
                        id={p.id}
                        apiRole="admin"
                        commentOnly
                        skipNotesFetch
                        comment={p.projectNotes ?? undefined}
                        onSave={(id, text) => onSaveBidInstruction(id, text)}
                      />
                    </td>
                    <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0 overflow-hidden align-top">
                      <CommentCell
                        id={p.id}
                        apiRole="admin"
                        skipNotesFetch
                        chatStyle
                        notesKind="technical"
                        currentUserId={peekAuthMe()?.id}
                        badgeLabel="Notes for Technical"
                        noteHistory={sirNotesHistory(p)}
                        onAddNote={async (_id, text) => onAddTechnicalNote(p.id, text)}
                      />
                    </td>
                    <td className="px-2 xl:px-3 py-3 xl:py-4 min-w-0 overflow-hidden align-top">
                      <div className="flex flex-col items-start gap-1.5 min-w-0 max-w-full">
                        <TechnicalWorkflowStatusBadge
                          status={p.status}
                          projectDeadline={p.projectDeadline}
                          projectWorkStatus={p.projectWorkStatus}
                          projectPhase={p.projectPhase}
                          technicalAssignments={p.technicalAssignments}
                        />
                        {!hideClientFinanceCols && onMarkCompleted && canMarkProjectCompleted(p) && (
                          <button
                            type="button"
                            onClick={() => onMarkCompleted(p)}
                            className="h-7 px-2 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100 inline-flex items-center gap-1 shrink-0 border border-emerald-200"
                            title="Mark as completed — remove from Technical Manager"
                          >
                            <CheckCircle2 size={12} />
                            Complete
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 xl:px-3 py-3 xl:py-4 text-right min-w-0 overflow-hidden align-top">
                      <div className="inline-flex items-center justify-end gap-1 flex-wrap max-w-full">
                        {!hideClientFinanceCols && onRequestRevision && (
                          <button
                            onClick={() => onRequestRevision(p)}
                            className={`w-8 h-8 rounded-xl text-[10px] font-medium flex items-center justify-center shrink-0 ${
                              p.needsRevision
                                ? "bg-violet-100 text-violet-700"
                                : "bg-violet-50 text-violet-600 hover:bg-violet-100"
                            }`}
                            title={p.needsRevision ? "In revision queue" : "Send for revision"}
                          >
                            <GitBranch size={12} />
                          </button>
                        )}
                        {!hideClientFinanceCols && (
                          <button
                            onClick={() => void onReassign(p)}
                            className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 text-[10px] font-medium hover:bg-blue-200 flex items-center justify-center shrink-0"
                            title="Reassign"
                          >
                            <ArrowRightLeft size={12} />
                          </button>
                        )}
                        <button
                          onClick={() => onView(p)}
                          className="w-8 h-8 rounded-xl bg-[#EAF5FF] text-[#0B84F3] flex items-center justify-center hover:opacity-80 shrink-0"
                          title="View / Edit"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={colCount} className="py-16 xl:py-20 text-center">
                    <FolderKanban size={36} className="text-gray-200 mx-auto mb-3 xl:w-10 xl:h-10" />
                    <p className="font-semibold text-gray-400 text-sm xl:text-base">No projects found</p>
                    <p className="text-xs xl:text-sm text-gray-300 mt-1">
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
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, projects.length)} of {projects.length}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
              <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const PAGE_SIZE = 30;

function projectAssigneeLabel(p: Project): string {
  if (p.projectSource?.trim()) return p.projectSource.trim();
  if (p.csr?.name) return p.csr.name;
  if (p.csr?.csrCode) return p.csr.csrCode;
  return "Unassigned";
}

function ProjectCsrCell({ p }: { p: Project }) {
  if (p.projectSource?.trim()) {
    return (
      <span className="text-xs font-semibold text-gray-600 break-words" title={p.projectSource.trim()}>
        {p.projectSource.trim()}
      </span>
    );
  }
  if (p.csr?.csrCode) {
    return (
      <span
        className="inline-flex bg-[#B8112D]/10 text-[#B8112D] text-[10px] xl:text-[11px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
        title={p.csr.name ? `${p.csr.csrCode} — ${p.csr.name}` : p.csr.csrCode}
      >
        {p.csr.csrCode}
      </span>
    );
  }
  return <span className="text-xs text-gray-400">—</span>;
}

export default function AdminProjectsPage() {
  const pathname = usePathname();
  const hideClientFinanceCols = pathname?.startsWith("/technical") ?? false;
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [stats,     setStats]     = useState<Stats>({ total: 0, withBudget: 0, thisMonth: 0 });
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [phoneFilter, setPhoneFilter] = useState("");
  const [filterCSR, setFilterCSR] = useState("all");
  const [allCsrs,     setAllCsrs]     = useState<CSROption[]>([]);
  const [workbenchProject, setWorkbenchProject] = useState<Project | null>(null);
  const [workbenchSaving, setWorkbenchSaving]   = useState(false);
  const [projectTab,  setProjectTab]  = useState<"all" | "active" | "completed">("all");
  const [markingCompletedId, setMarkingCompletedId] = useState<string | null>(null);
  const [excelUploading, setExcelUploading] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [page,        setPage]        = useState(1);
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // Survive remounts / refresh for this browser tab
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("crm_deleted_project_ids");
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) arr.forEach((id) => deletedIdsRef.current.add(id));
      }
    } catch { /* ignore */ }
  }, []);

  const rememberDeletedId = (id: string) => {
    deletedIdsRef.current.add(id);
    try {
      sessionStorage.setItem(
        "crm_deleted_project_ids",
        JSON.stringify([...deletedIdsRef.current]),
      );
    } catch { /* ignore */ }
  };

  /* ── Reassign modal ── */
  const [showReassign,  setShowReassign]  = useState(false);
  const [reassignProj,  setReassignProj]  = useState<Project | null>(null);
  const [csrOpts,       setCsrOpts]       = useState<CSROption[]>([]);
  const [selCsrId,      setSelCsrId]      = useState("");
  const [isReassigning, setIsReassigning] = useState(false);
  const [csrOptsLoaded, setCsrOptsLoaded] = useState(false);

  const [showRevision, setShowRevision] = useState(false);
  const [revisionProj, setRevisionProj] = useState<Project | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [revisionSaving, setRevisionSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addDraft,     setAddDraft]     = useState<ProjectWorkbenchData | null>(null);
  const [addSaving,    setAddSaving]    = useState(false);

  const applyClientLookup = useCallback((client: ClientLookupData) => {
    setAddDraft((d) => {
      if (!d) return d;
      return {
        ...d,
        name: client.name || d.name,
        company: client.company || d.company,
        email: client.email || d.email,
        state: client.state || d.state,
        interestedService: d.interestedService || client.interestedService || "",
      };
    });
  }, []);

  const { phoneLookupLoading, returningClient, resetLookup, onPhoneValueChange, onPhoneBlur, onPhonePaste } =
    useClientPhoneLookup(applyClientLookup, "/admin/lookup-by-phone");

  const resetAddModal = useCallback(() => {
    setShowAddModal(false);
    setAddDraft(null);
    resetLookup();
  }, [resetLookup]);

  const openAddModal = useCallback(() => {
    resetLookup();
    setAddDraft({
      ...emptyWorkbench(),
      assignedTo: filterCSR !== "all" ? filterCSR : "",
    });
    setShowAddModal(true);
  }, [filterCSR, resetLookup]);

  const saveNewProject = async (data: ProjectWorkbenchData) => {
    if (data.assignedTo === CSR_ASSIGN_OTHER && !(data.projectSource ?? "").trim()) {
      toast.error("Enter the external resource name for Other.");
      return;
    }
    if (!data.name.trim()) { toast.error("Client name is required."); return; }
    if (!data.projectTitle.trim()) { toast.error("Project title is required."); return; }
    if (!data.interestedService) { toast.error("Please select a service."); return; }
    if (!data.projectDeadline) { toast.error("Deadline is required."); return; }
    setAddSaving(true);
    try {
      const res = await API.post("/admin/project", {
        csrId:             data.assignedTo || undefined,
        projectSource:     data.projectSource?.trim() || undefined,
        name:              data.name.trim(),
        company:           data.company.trim() || undefined,
        phone:             data.phone.trim() || undefined,
        email:             data.email.trim() || undefined,
        ownerName:         data.ownerName.trim() || undefined,
        state:             data.state.trim() || undefined,
        projectCode:       data.projectCode.trim() || undefined,
        projectTitle:      data.projectTitle.trim(),
        projectScope:      data.projectScope.trim() || undefined,
        interestedService: data.interestedService,
        projectDeadline:   data.projectDeadline,
        deadlineTiming:    data.deadlineTiming || "",
        projectBudget:     data.projectBudget.trim() || undefined,
        projectNotes:      data.projectNotes?.trim() || undefined,
        projectPhase:      data.projectPhase,
        takeoffDeadline:   data.takeoffDeadline || undefined,
        pricingDeadline:   data.pricingDeadline || undefined,
        qaDeadline:        data.qaDeadline || undefined,
        projectPayments:   data.projectPayments,
        status:            "Close Client",
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => [lead, ...prev]);
      setStats((s) => ({ ...s, total: s.total + 1 }));
      toast.success("Project added");
      resetAddModal();
      void fetchProjects();
    } catch {
      toast.error("Failed to save project. Please try again.");
    } finally {
      setAddSaving(false);
    }
  };

  const addAdminNote = async (id: string, text: string, parentId?: string) => {
    const res = await API.post(`/admin/lead/${id}/notes`, {
      text,
      ...(parentId ? { parentId } : {}),
    });
    const note = res.data.note as {
      id: string;
      text: string;
      createdAt: string;
      parentId?: string | null;
    };
    const entry: NoteEntry = {
      id: note.id,
      text: note.text,
      createdAt: note.createdAt,
      parentId: note.parentId ?? parentId ?? null,
    };
    const mergeNotes = (list: { id: string; text: string; createdAt: string; parentId?: string | null }[] | undefined) => {
      const prev = list ?? [];
      return [...prev.filter((n) => n.id !== note.id), note];
    };
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notes: mergeNotes(p.notes) } : p)),
    );
    setWorkbenchProject((prev) =>
      prev?.id === id ? { ...prev, notes: mergeNotes(prev.notes) } : prev,
    );
    return entry;
  };

  const addTechnicalNote = async (id: string, text: string) => {
    const res = await API.post(`/admin/lead/${id}/technical-notes`, { text, thread: "sir" });
    const note = res.data.note as {
      id: string;
      text: string;
      createdAt: string;
      authorId?: string;
      authorRole?: string;
      authorName?: string;
    };
    const bundle = res.data.technicalNotesBundle as { sir?: typeof note[]; estimator?: typeof note[] } | undefined;
    const entry: NoteEntry = {
      id: note.id,
      text: note.text,
      createdAt: note.createdAt,
      authorId: note.authorId,
      authorRole: note.authorRole,
      authorName: note.authorName,
    };
    const nextJson = bundle
      ? JSON.stringify(bundle)
      : JSON.stringify({
          ...parseTechnicalNotesBundle(
            (projects.find((p) => p.id === id) ?? workbenchProject)?.technicalNotes,
          ),
          sir: [
            ...parseTechnicalNotes(
              (projects.find((p) => p.id === id) ?? workbenchProject)?.technicalNotes,
            ).filter((n) => n.id !== note.id),
            note,
          ],
        });
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, technicalNotes: nextJson } : p)),
    );
    setWorkbenchProject((prev) =>
      prev?.id === id ? { ...prev, technicalNotes: nextJson } : prev,
    );
    return entry;
  };

  const updateAdminNote = (id: string, noteId: string, text: string, createdAt?: string) => {
    const patch = (list: { id: string; text: string; createdAt: string; parentId?: string | null }[] | undefined) =>
      (list ?? []).map((n) =>
        n.id === noteId ? { ...n, text, createdAt: createdAt ?? n.createdAt } : n,
      );
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notes: patch(p.notes) } : p)),
    );
    setWorkbenchProject((prev) =>
      prev?.id === id ? { ...prev, notes: patch(prev.notes) } : prev,
    );
  };

  const deleteAdminNote = (id: string, noteId: string) => {
    const drop = (list: { id: string; text: string; createdAt: string; parentId?: string | null }[] | undefined) =>
      (list ?? []).filter((n) => n.id !== noteId && n.parentId !== noteId);
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notes: drop(p.notes) } : p)),
    );
    setWorkbenchProject((prev) =>
      prev?.id === id ? { ...prev, notes: drop(prev.notes) } : prev,
    );
  };

  const saveWorkbench = async (data: ProjectWorkbenchData) => {
    setWorkbenchSaving(true);
    try {
      const isOther = data.assignedTo === CSR_ASSIGN_OTHER;
      const res = await API.put(`/admin/project/${data.id}`, {
        name: data.name,
        company: data.company,
        phone: data.phone,
        email: data.email,
        ownerName: data.ownerName,
        state: data.state,
        projectCode: data.projectCode,
        projectTitle: data.projectTitle,
        projectScope: data.projectScope,
        interestedService: data.interestedService,
        projectBudget: data.projectBudget,
        projectDeadline: data.projectDeadline,
        deadlineTiming: data.deadlineTiming || "",
        projectPhase: data.projectPhase,
        takeoffDeadline: data.takeoffDeadline,
        pricingDeadline: data.pricingDeadline,
        qaDeadline: data.qaDeadline,
        projectPayments: data.projectPayments,
        assignedTo: isOther ? undefined : data.assignedTo,
        projectSource: isOther ? data.projectSource : "",
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      setWorkbenchProject((prev) => (prev?.id === lead.id ? { ...prev, ...lead } : prev));
      toast.success("Project updated");
    } catch {
      toast.error("Failed to save project");
    } finally {
      setWorkbenchSaving(false);
    }
  };

  const saveBidInstruction = async (projectId: string, text: string) => {
    try {
      const res = await API.put(`/admin/project/${projectId}`, { projectNotes: text });
      const lead = res.data.lead as Project | undefined;
      if (lead) {
        setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
        setWorkbenchProject((prev) => (prev?.id === lead.id ? { ...prev, ...lead } : prev));
      } else {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, projectNotes: text } : p)),
        );
        setWorkbenchProject((prev) =>
          prev?.id === projectId ? { ...prev, projectNotes: text } : prev,
        );
      }
      toast.success(text.trim() ? "Bid instruction updated" : "Bid instruction deleted");
    } catch {
      toast.error("Failed to update bid instruction");
      throw new Error("bid save failed");
    }
  };

  const changeDeadlineTiming = async (id: string, deadlineTiming: "" | "morning" | "cob") => {
    // Optimistic UI so Technical signal is instant
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, deadlineTiming: deadlineTiming || null } : p)),
    );
    setWorkbenchProject((prev) =>
      prev?.id === id ? { ...prev, deadlineTiming: deadlineTiming || null } : prev,
    );
    try {
      const res = await API.put(`/admin/project/${id}`, { deadlineTiming });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success(
        deadlineTiming === "morning"
          ? "Marked Morning — Technical notified"
          : deadlineTiming === "cob"
            ? "Marked COB — Technical notified"
            : "Emergency timing cleared",
      );
    } catch {
      toast.error("Failed to update timing");
      void fetchProjects();
    }
  };

  const deleteWorkbenchProject = async () => {
    if (!workbenchProject) return;
    const id = workbenchProject.id;
    // Optimistic — leave UI immediately so poll/cache cannot flash it back
    rememberDeletedId(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setStats((s) => ({ ...s, total: Math.max(0, s.total - 1) }));
    setWorkbenchProject(null);
    try {
      const res = await API.delete(`/admin/project/${id}`);
      if (!res.data?.success) {
        throw new Error(res.data?.message || "delete failed");
      }
      toast.success("Project permanently deleted from Project DB");
      // Do NOT refetch immediately — that was reloading stale cached rows
    } catch {
      deletedIdsRef.current.delete(id);
      try {
        sessionStorage.setItem(
          "crm_deleted_project_ids",
          JSON.stringify([...deletedIdsRef.current]),
        );
      } catch { /* ignore */ }
      toast.error("Failed to delete project");
      void fetchProjects(true);
      throw new Error("delete failed");
    }
  };

  const openReassign = async (p: Project) => {
    setReassignProj(p);
    setSelCsrId("");
    setShowReassign(true);
    if (!csrOptsLoaded) {
      try {
        const res = await API.get("/admin/csrs");
        setCsrOpts(res.data.csrs ?? []);
        setCsrOptsLoaded(true);
      } catch { toast.error("Failed to load CSRs."); }
    }
  };

  const confirmReassign = async () => {
    if (!reassignProj || !selCsrId) return;
    setIsReassigning(true);
    try {
      await API.put(`/admin/lead/${reassignProj.id}/reassign`, { csrId: selCsrId });
      const csr = csrOpts.find(c => c.id === selCsrId);
      toast.success(`Project reassigned to ${csr?.name ?? "CSR"}.`);
      setProjects(prev => prev.map(p =>
        p.id === reassignProj.id
          ? { ...p, csr: { id: selCsrId, name: csr?.name ?? p.csr.name, email: p.csr.email, csrCode: csr?.csrCode ?? p.csr.csrCode } }
          : p
      ));
      setShowReassign(false);
      setReassignProj(null);
    } catch { toast.error("Failed to reassign project."); }
    finally { setIsReassigning(false); }
  };

  const openRevision = (p: Project) => {
    setRevisionProj(p);
    setRevisionNotes(p.revisionNotes ?? "");
    setShowRevision(true);
  };

  const confirmRevision = async () => {
    if (!revisionProj) return;
    setRevisionSaving(true);
    try {
      const res = await API.put(`/admin/project/${revisionProj.id}/request-revision`, {
        revisionNotes: revisionNotes.trim(),
      });
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((p) => (p.id === lead.id ? { ...p, ...lead } : p)));
      toast.success("Sent to Technical Manager → Revisions");
      setShowRevision(false);
      setRevisionProj(null);
      setRevisionNotes("");
    } catch {
      toast.error("Failed to send for revision");
    } finally {
      setRevisionSaving(false);
    }
  };

  const markProjectCompleted = async (p: Project) => {
    if (!canMarkProjectCompleted(p) || markingCompletedId) return;
    setMarkingCompletedId(p.id);
    try {
      const res = await API.put(`/admin/project/${p.id}/mark-completed`);
      const lead = res.data.lead as Project;
      setProjects((prev) => prev.map((row) => (row.id === lead.id ? { ...row, ...lead } : row)));
      toast.success("Marked completed — removed from Technical Manager");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to mark completed";
      toast.error(msg);
    } finally {
      setMarkingCompletedId(null);
    }
  };

  const downloadProjectDbTemplate = async () => {
    try {
      const res = await API.get("/admin/projects/excel-template", {
        responseType: "arraybuffer",
      });
      const contentType =
        String(res.headers?.["content-type"] ?? "") ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const blob = new Blob([res.data], { type: contentType });
      // Guard: if proxy returned JSON error, don't save as xlsx
      if (contentType.includes("application/json") || blob.size < 100) {
        toast.error("Template download failed — invalid file from server");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "project-db-template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Template downloaded — use Projects sheet (columns across row 1)");
    } catch {
      toast.error("Failed to download template");
    }
  };

  const uploadProjectDbExcel = async (file: File) => {
    setExcelUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await API.post("/admin/projects/excel-upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const created = Number(res.data?.created ?? 0);
      const failed = Number(res.data?.failed ?? 0);
      const errs = Array.isArray(res.data?.errors) ? res.data.errors : [];
      if (created > 0) {
        toast.success(res.data?.message || `Imported ${created} project(s)`);
        void fetchProjects(true);
      } else {
        toast.error(res.data?.message || "No projects imported");
      }
      if (failed > 0 && errs[0]?.message) {
        toast.error(`Row ${errs[0].row}: ${errs[0].message}`, { duration: 5000 });
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to upload Excel";
      toast.error(msg);
    } finally {
      setExcelUploading(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
  };

  const fetchProjects = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const { leads, total } = await fetchAllAdminProjects<Project>({
        csrId: filterCSR !== "all" ? filterCSR : undefined,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        search: search.trim() || undefined,
      });
      const purged = leads.filter((p) => !deletedIdsRef.current.has(p.id));
      setProjects(purged);
      setStats({
        total: Math.max(0, total - (leads.length - purged.length)),
        withBudget: purged.filter((p) => !!p.projectBudget).length,
        thisMonth: purged.filter((p) => {
          const d = new Date(p.updatedAt);
          const now = new Date();
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }).length,
      });
    } catch {
      if (!silent) toast.error("Failed to load projects");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filterCSR, dateFrom, dateTo, search]);

  useEffect(() => {
    API.get("/admin/csrs")
      .then(res => setAllCsrs(res.data.csrs ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  // Pick up Technical workflow status changes without full refresh
  useEffect(() => {
    const poll = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchProjects(true);
    }, 8000);
    return () => window.clearInterval(poll);
  }, [fetchProjects]);

  const csrList: [string, string][] = allCsrs.length > 0
    ? allCsrs.map((c): [string, string] => [c.id, c.name])
    : Array.from(
        new Map<string, string>(
          projects
            .filter((p): p is Project & { csr: NonNullable<Project["csr"]> } => !!p.csr?.id)
            .map((p): [string, string] => [p.csr.id, p.csr.name ?? "Unknown"]),
        ),
      );

  const baseFiltered = projects.filter((p) => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      (p.name ?? "").toLowerCase().includes(q) ||
      (p.projectTitle ?? "").toLowerCase().includes(q) ||
      (p.projectCode ?? "").toLowerCase().includes(q) ||
      (p.clientCode ?? "").toLowerCase().includes(q) ||
      (p.company ?? "").toLowerCase().includes(q);
    const matchState = matchesStateLocationFilter(p.state, p.phone, stateFilter);
    const matchPhone = matchesPhoneAreaCodeFilter(p.phone, phoneFilter);
    const matchCsr = filterCSR === "all" || p.csr?.id === filterCSR;
    const matchMonth = !monthFilter || (() => {
      const iso = p.createdAt || p.updatedAt;
      if (!iso) return false;
      return iso.slice(0, 7) === monthFilter;
    })();
    const matchPaymentType = matchesPaymentCollectionFilter(
      paymentTypeFilter,
      parsePayments(p.projectPayments),
      p.projectBudget,
    );
    return matchSearch && matchState && matchPhone && matchCsr && matchMonth && matchPaymentType;
  });

  const allProjects    = baseFiltered;
  const activeProjects = baseFiltered.filter(isProjectActive);
  const completedProjects = baseFiltered.filter((p) => getProjectWorkStatus(p).key === "completed");
  const displayedProjects =
    projectTab === "all"
      ? allProjects
      : projectTab === "active"
        ? activeProjects
        : completedProjects;

  const phasePieData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of projects) {
      const key = p.projectPhase ?? "not_started";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([key, value]) => ({ name: phaseLabel(key), value, key }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [projects]);

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster
        position="top-right"
        toastOptions={{ style: { borderRadius: "16px", fontSize: "14px" } }}
      />
      <StaffSidebar />

      {/* ─── MAIN ─── */}
      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 overflow-x-hidden mt-[64px]">
        <DashboardNavbar />

        {/* HEADER */}
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">
              Project DB
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
              {hideClientFinanceCols
                ? "Active projects — filter by date, view all or active only."
                : "All CSR projects — All / Active / Completed. Final Submission → Mark Complete."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => void fetchProjects()}
              disabled={loading}
              className="h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:border-[#B8112D]/40 hover:text-[#B8112D] disabled:opacity-60"
              title="Refresh projects"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            {!hideClientFinanceCols && (
              <>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void uploadProjectDbExcel(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => void downloadProjectDbTemplate()}
                  className="flex items-center justify-center gap-2 h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-gray-200 bg-white text-gray-700 text-xs sm:text-sm font-semibold hover:border-[#B8112D]/40 hover:text-[#B8112D] transition-colors"
                  title="Download Excel template with all Project DB fields"
                >
                  <Download size={14} /> Template
                </button>
                <button
                  type="button"
                  disabled={excelUploading}
                  onClick={() => excelInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-semibold hover:bg-emerald-100 disabled:opacity-60 transition-colors"
                  title="Upload previous projects Excel (any date range)"
                >
                  <Upload size={14} className={excelUploading ? "animate-pulse" : ""} />
                  {excelUploading ? "Uploading…" : "Upload Excel"}
                </button>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="flex items-center justify-center gap-2 h-10 sm:h-11 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white text-xs sm:text-sm font-semibold shadow-md shadow-red-200 hover:bg-[#a30f27] transition-colors"
                >
                  <Plus size={14} /> Add New Project
                </button>
              </>
            )}
            <div className="flex items-center gap-2 bg-[#ECFDF5] text-[#065F46] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-semibold w-fit">
              <div className="w-2 h-2 rounded-full bg-[#12B76A] animate-pulse" />
              Live Data
            </div>
          </div>
        </div>

        {/* PROJECTS OVERVIEW */}
        <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-4 sm:mb-6">
          <ProjectOverviewCharts loading={loading} stats={stats} phasePieData={phasePieData} />
        </div>

        {/* SEARCH + FILTER */}
        <div className="flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-5">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="relative flex-1 sm:max-w-sm lg:max-w-md">
              <Search size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by project name, client, project code..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-4 py-2.5 sm:py-3 text-sm outline-none focus:border-[#B8112D]"
              />
            </div>

            {!hideClientFinanceCols && (
              <div className="relative w-full sm:w-auto">
                <User2 size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={filterCSR}
                  onChange={(e) => { setFilterCSR(e.target.value); setPage(1); }}
                  className="appearance-none w-full sm:min-w-[200px] lg:min-w-[220px] h-10 sm:h-12 bg-white border border-gray-200 rounded-xl sm:rounded-2xl pl-10 sm:pl-11 pr-9 sm:pr-10 text-sm outline-none focus:border-[#B8112D]"
                >
                  <option value="all">All CSRs</option>
                  {csrList.map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            )}

            <StateFilterDropdown value={stateFilter} onChange={v => { setStateFilter(v); setPage(1); }} />
            <PhoneAreaCodeFilterInput value={phoneFilter} onChange={v => { setPhoneFilter(v); setPage(1); }} />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
            <div className="flex items-center gap-2 flex-1 sm:max-w-md">
              <Calendar size={15} className="text-gray-400 shrink-0" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="flex-1 h-10 sm:h-11 bg-white border border-gray-200 rounded-xl px-3 text-sm outline-none focus:border-[#B8112D]"
              />
              <span className="text-xs text-gray-400 shrink-0">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="flex-1 h-10 sm:h-11 bg-white border border-gray-200 rounded-xl px-3 text-sm outline-none focus:border-[#B8112D]"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                className="h-10 px-4 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-all"
              >
                Clear dates
              </button>
            )}
          </div>

          {!hideClientFinanceCols && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center">
              <div className="relative flex items-center gap-2 h-10 sm:h-11 px-3 rounded-xl border border-gray-200 bg-white shadow-sm w-full sm:w-auto sm:min-w-[200px]">
                <Calendar size={14} className="text-gray-400 shrink-0" />
                <input
                  type="month"
                  value={monthFilter}
                  onChange={(e) => { setMonthFilter(e.target.value); setPage(1); }}
                  aria-label="Filter by month"
                  className="outline-none bg-transparent text-sm font-semibold text-[#0F172A] min-w-0 flex-1"
                />
                {monthFilter ? (
                  <button
                    type="button"
                    onClick={() => { setMonthFilter(""); setPage(1); }}
                    className="text-[10px] font-bold text-[#B8112D] hover:underline shrink-0"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <div className="relative w-full sm:w-auto">
                <select
                  value={paymentTypeFilter}
                  onChange={(e) => { setPaymentTypeFilter(e.target.value); setPage(1); }}
                  className="appearance-none w-full sm:min-w-[180px] h-10 sm:h-11 bg-white border border-gray-200 rounded-xl pl-3.5 pr-9 text-sm outline-none focus:border-[#B8112D] font-semibold text-gray-700"
                >
                  <option value="">All payments</option>
                  {PAYMENT_TYPE_FILTER_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t === "Full" ? "Full payment" : "Partial"}</option>
                  ))}
                </select>
                <ChevronDown size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              {(monthFilter || paymentTypeFilter) && (
                <button
                  type="button"
                  onClick={() => { setMonthFilter(""); setPaymentTypeFilter(""); setPage(1); }}
                  className="h-10 px-4 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition-all w-fit"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* ALL / ACTIVE / COMPLETED — sliding capsule */}
        <div className="mb-4 sm:mb-5">
          <CapsuleTabs
            activeKey={projectTab}
            onChange={(key) => { setProjectTab(key); setPage(1); }}
            accent="#B8112D"
            tabs={[
              { key: "all", label: "All Projects", shortLabel: "All", count: allProjects.length },
              { key: "active", label: "Active Projects", shortLabel: "Active", count: activeProjects.length },
              { key: "completed", label: "Completed", shortLabel: "Done", count: completedProjects.length },
            ]}
          />
          <p className="mt-2 text-[11px] sm:text-xs text-gray-400">
            {projectTab === "all"
              ? "New, old, completed & in-progress"
              : projectTab === "active"
                ? "Currently in progress only"
                : "Final submission marked done by Admin"}
          </p>
        </div>

        <ProjectsSection
          projects={displayedProjects}
          page={page}
          setPage={setPage}
          loading={loading}
          search={search}
          onView={(p) => {
            setWorkbenchProject(p);
            void API.put(`/admin/lead/${p.id}/technical-notes/read`).catch(() => {});
          }}
          onReassign={openReassign}
          onRequestRevision={hideClientFinanceCols ? undefined : openRevision}
          onMarkCompleted={hideClientFinanceCols ? undefined : (p) => void markProjectCompleted(p)}
          onAddNote={addAdminNote}
          onAddTechnicalNote={addTechnicalNote}
          onSaveBidInstruction={saveBidInstruction}
          onNoteUpdated={updateAdminNote}
          onNoteDeleted={deleteAdminNote}
          onTimingChange={(id, timing) => void changeDeadlineTiming(id, timing)}
          hideClientFinanceCols={hideClientFinanceCols}
        />

        <ProjectWorkbenchModal
          open={!!workbenchProject}
          onClose={() => setWorkbenchProject(null)}
          initial={workbenchProject ? projectToWorkbench(workbenchProject) : emptyWorkbench()}
          mode="admin"
          csrs={allCsrs}
          saving={workbenchSaving}
          onSave={saveWorkbench}
          onDelete={deleteWorkbenchProject}
          noteHistory={workbenchProject ? notesToHistory(workbenchProject.notes) : undefined}
          onAddNote={workbenchProject ? async (text, parentId) => { await addAdminNote(workbenchProject.id, text, parentId); } : undefined}
          technicalNoteHistory={
            workbenchProject
              ? sirNotesHistory(workbenchProject)
              : undefined
          }
          onAddTechnicalNote={
            workbenchProject
              ? async (text) => { await addTechnicalNote(workbenchProject.id, text); }
              : undefined
          }
          hideClientFinanceSections={hideClientFinanceCols}
        />

        <ProjectWorkbenchModal
          open={showAddModal && !!addDraft}
          onClose={resetAddModal}
          initial={addDraft ?? emptyWorkbench()}
          mode="admin"
          createMode
          csrs={allCsrs}
          saving={addSaving}
          onSave={saveNewProject}
          hideClientFinanceSections={hideClientFinanceCols}
          phoneLookup={{
            phoneLookupLoading,
            returningClient,
            onPhoneValueChange,
            onPhoneBlur,
            onPhonePaste,
          }}
        />

      {/* ══ SEND FOR REVISION MODAL ══ */}
      {showRevision && revisionProj && !hideClientFinanceCols && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-violet-600 to-violet-800 px-5 sm:px-6 pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <GitBranch size={18} />
                    Send for Revision
                  </h2>
                  <p className="text-white/70 text-xs sm:text-sm mt-0.5">
                    {revisionProj.projectTitle ?? revisionProj.name ?? "Project"} → Technical Manager Revisions
                  </p>
                </div>
                <button
                  onClick={() => setShowRevision(false)}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 space-y-3">
              <label className="block text-xs font-semibold text-gray-600">
                Revision notes (optional)
                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  rows={4}
                  placeholder="What needs to be revised — construction, as-built, takeoff, pricing…"
                  className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-[#0F172A] outline-none focus:border-violet-400 resize-none"
                />
              </label>
              {revisionProj.needsRevision ? (
                <p className="text-xs text-violet-700 bg-violet-50 px-3 py-2 rounded-xl">
                  Already in revision queue — sending again will update notes and notify Technical Manager.
                </p>
              ) : null}
            </div>

            <div className="flex gap-3 px-5 sm:px-6 pb-5 pt-2">
              <button
                onClick={() => setShowRevision(false)}
                className="flex-1 h-11 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmRevision()}
                disabled={revisionSaving}
                className="flex-1 h-11 rounded-2xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <GitBranch size={14} />
                {revisionSaving ? "Sending…" : "Send to Revisions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ REASSIGN CSR MODAL ══ */}
      {showReassign && reassignProj && !hideClientFinanceCols && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-[32px] shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white">Reassign Project</h2>
                  <p className="text-white/70 text-xs sm:text-sm mt-0.5">
                    Reassigning <span className="font-semibold text-white">{reassignProj.projectTitle ?? reassignProj.name ?? "project"}</span>
                  </p>
                </div>
                <button onClick={() => setShowReassign(false)}
                  className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white shrink-0">
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-4 space-y-2 max-h-64 overflow-y-auto">
              {!csrOptsLoaded ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw size={20} className="animate-spin text-gray-400" />
                </div>
              ) : csrOpts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No CSRs available.</p>
              ) : csrOpts.map(csr => (
                <button key={csr.id} onClick={() => setSelCsrId(csr.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                    selCsrId === csr.id ? "border-[#B8112D] bg-[#FFF1F3]" : "border-gray-100 bg-[#FAFAFA] hover:border-gray-200"
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${
                    selCsrId === csr.id ? "bg-[#B8112D]" : "bg-gray-400"
                  }`}>
                    {csr.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-semibold text-sm truncate ${selCsrId === csr.id ? "text-[#B8112D]" : "text-[#0F172A]"}`}>
                      {csr.name}
                    </p>
                    {csr.csrCode && <p className="text-xs text-gray-400">{csr.csrCode}</p>}
                  </div>
                  {selCsrId === csr.id && (
                    <div className="ml-auto w-5 h-5 rounded-full bg-[#B8112D] flex items-center justify-center shrink-0">
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3 px-5 sm:px-6 pb-5 pt-2">
              <button onClick={() => setShowReassign(false)}
                className="flex-1 h-11 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm">
                Cancel
              </button>
              <button onClick={confirmReassign} disabled={!selCsrId || isReassigning}
                className="flex-1 h-11 rounded-2xl bg-[#B8112D] text-white font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
                <ArrowRightLeft size={14} />
                {isReassigning ? "Reassigning…" : "Reassign"}
              </button>
            </div>
          </div>
        </div>
      )}

      </main>
    </div>
  );
}