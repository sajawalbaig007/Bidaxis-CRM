import { useCallback, useEffect, useState } from "react";
import API from "@/lib/api";

export type Project = {
  id: string;
  projectTitle: string;
  client: string;
  company: string;
  status: string;
  deadline: string;
  budget: string;
  budgetNum: number;
  notes: string;
  service: string;
  timezone: string;
  phone: string;
  closedAt: string;
  clientCode: string | null;
};

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
  notes?: string;
  followUpNotes?: string;
  interestedService?: string;
  interested_service?: string;
  service?: string;
  serviceInterested?: string;
  serviceName?: string;
  services?: string;
  timezone?: string;
  phone?: string;
  updatedAt?: string;
  clientCode?: string | null;
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
    lead.projectTitle ?? lead.project_title ?? lead.ProjectTitle ??
    lead.title ?? lead.projectName ?? lead.project_name ?? lead.name ?? "Untitled Project";
  const deadline =
    lead.projectDeadline ?? lead.project_deadline ?? lead.ProjectDeadline ??
    lead.deadline ?? lead.nextSchedule ?? "N/A";
  const budget  = lead.projectBudget ?? lead.project_budget ?? lead.ProjectBudget ?? lead.budget ?? "";
  const notes   =
    lead.projectNotes ?? lead.project_notes ?? lead.ProjectNotes ??
    lead.notes ?? lead.followUpNotes ?? "";
  const service =
    lead.interestedService ?? lead.interested_service ?? lead.service ??
    lead.serviceInterested ?? lead.serviceName ?? lead.services ?? "N/A";

  const deadlineStr      = String(deadline);
  const backendCompleted = lead.status === "completed";
  const pastDeadline     = isDeadlinePast(deadlineStr);
  const derivedStatus    = backendCompleted || pastDeadline ? "Completed" : "In Progress";

  return {
    id:           String(lead.id ?? ""),
    projectTitle: String(projectTitle),
    client:       String(lead.name    || "Unknown"),
    company:      String(lead.company || "N/A"),
    status:       derivedStatus,
    deadline:     deadlineStr,
    budget:       String(budget),
    budgetNum:    parseBudget(budget),
    notes:        String(notes),
    service:      String(service),
    timezone:     String(lead.timezone || "N/A"),
    phone:        String(lead.phone    || "N/A"),
    closedAt:     lead.updatedAt ? String(lead.updatedAt).split("T")[0] : "N/A",
    clientCode:   lead.clientCode ?? null,
  };
}

export function useProjectsData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get("/csr/projects");
      setProjects((res.data.leads ?? []).map((l: RawLead) => mapProject(l)));
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { projects, setProjects, loading, refetch };
}
