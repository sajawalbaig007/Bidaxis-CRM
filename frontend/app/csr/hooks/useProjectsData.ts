import { useCallback, useEffect, useState } from "react";
import { csrProjectsApi } from "@/lib/csrApiCache";
import { NoteEntry } from "./useLeadsData";

export type Project = {
  id: string;
  projectCode: string;
  projectTitle: string;
  client: string;
  company: string;
  email: string;
  status: string;
  state: string;
  deadline: string;
  budget: string;
  budgetNum: number;
  paidAmount: string;
  paidAmountNum: number;
  paidPercent: number;
  notes: string;
  service: string;
  timezone: string;
  phone: string;
  closedAt: string;
  clientCode: string | null;
  noteHistory: NoteEntry[];
};

type RawNote = { id?: string; text?: string; createdAt?: string; };

type RawLead = {
  id?: string | number;
  status?: string;
  name?: string;
  company?: string;
  projectTitle?: string;
  project_title?: string;
  ProjectTitle?: string;
  title?: string;
  projectName?: string;
  project_name?: string;
  projectDeadline?: string;
  project_deadline?: string;
  ProjectDeadline?: string;
  deadline?: string;
  nextSchedule?: string;
  projectBudget?: string | number;
  project_budget?: string | number;
  ProjectBudget?: string | number;
  budget?: string | number;
  projectNotes?: string;
  project_notes?: string;
  ProjectNotes?: string;
  notes?: RawNote[];
  followUpNotes?: string;
  comments?: string;
  createdAt?: string;
  interestedService?: string;
  interested_service?: string;
  service?: string;
  serviceInterested?: string;
  serviceName?: string;
  services?: string;
  timezone?: string;
  phone?: string;
  email?: string;
  updatedAt?: string;
  clientCode?: string | null;
  projectCode?: string | null;
  state?: string | null;
  paidAmount?: string | number | null;
};

export const parseBudget = (raw: string | number | null | undefined): number => {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

export const isDeadlinePast = (deadline: string): boolean => {
  if (!deadline || deadline === "N/A") return false;
  return deadline < new Date().toISOString().split("T")[0];
};

function mapProject(lead: RawLead): Project {
  const projectTitle =
    lead.projectTitle || lead.project_title || lead.ProjectTitle ||
    lead.title || lead.projectName || lead.project_name || "";
  const deadline =
    lead.projectDeadline ?? lead.project_deadline ?? lead.ProjectDeadline ??
    lead.deadline ?? lead.nextSchedule ?? "N/A";
  const budget  = lead.projectBudget ?? lead.project_budget ?? lead.ProjectBudget ?? lead.budget ?? "";
  const notes   = lead.projectNotes ?? lead.project_notes ?? lead.ProjectNotes ?? lead.followUpNotes ?? "";
  const service =
    lead.interestedService ?? lead.interested_service ?? lead.service ??
    lead.serviceInterested ?? lead.serviceName ?? lead.services ?? "N/A";

  const deadlineStr      = String(deadline);
  const backendCompleted = lead.status === "completed";
  const pastDeadline     = isDeadlinePast(deadlineStr);
  const derivedStatus    = backendCompleted || pastDeadline ? "Completed" : "In Progress";

  const budgetNum    = parseBudget(budget);
  const paidAmount   = lead.paidAmount ?? "";
  const paidAmountNum = parseBudget(paidAmount);
  const paidPercent  = budgetNum > 0 ? (paidAmountNum / budgetNum) * 100 : 0;

  const rawNotes = Array.isArray(lead.notes) ? lead.notes : [];
  const fullNotes = rawNotes.filter(n => n.text?.trim());
  const legacyNote: NoteEntry[] = [];
  if (fullNotes.length === 0 && (lead.comments?.trim() || lead.followUpNotes?.trim())) {
    if (lead.comments?.trim()) {
      legacyNote.push({ id: "legacy-comments", text: lead.comments.trim(), createdAt: lead.createdAt ?? new Date().toISOString() });
    }
    if (lead.followUpNotes?.trim()) {
      legacyNote.push({ id: "legacy-followup", text: lead.followUpNotes.trim(), createdAt: lead.createdAt ?? new Date().toISOString() });
    }
  }
  const noteHistory: NoteEntry[] = fullNotes.length > 0
    ? fullNotes.map((n: RawNote) => ({
        id: n.id ?? String(Math.random()),
        text: n.text!.trim(),
        createdAt: n.createdAt ?? new Date().toISOString(),
      }))
    : legacyNote;

  return {
    id:            String(lead.id ?? ""),
    projectCode:   String(lead.projectCode ?? ""),
    projectTitle:  String(projectTitle),
    client:        String(lead.name    || "Unknown"),
    company:       String(lead.company || "N/A"),
    email:         String(lead.email   || ""),
    status:        derivedStatus,
    state:         String(lead.state   || "N/A"),
    deadline:      deadlineStr,
    budget:        String(budget),
    budgetNum,
    paidAmount:    String(paidAmount),
    paidAmountNum,
    paidPercent,
    notes:         String(notes),
    service:       String(service),
    timezone:      String(lead.timezone || "N/A"),
    phone:         String(lead.phone    || "N/A"),
    closedAt:      lead.updatedAt ? String(lead.updatedAt).split("T")[0] : "N/A",
    clientCode:    lead.clientCode ?? null,
    noteHistory,
  };
}

export function useProjectsData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);

  const refetch = useCallback(async (force = false) => {
    try {
      setLoading(true);
      const res = await csrProjectsApi.get(force);
      setProjects((res.leads as RawLead[] ?? []).map((l) => mapProject(l)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void (async () => { await Promise.resolve(); refetch(); })(); }, [refetch]);

  return { projects, setProjects, loading, refetch };
}
