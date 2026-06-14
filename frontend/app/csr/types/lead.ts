import { NoteEntry } from "../hooks/useLeadsData";

export interface BackendLead {
  id: string;
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  status?: string;
  nextSchedule?: string;
  nextTime?: string;
  timezone?: string;
  followUpNotes?: string;
  interestedService?: string;
  interested_service?: string;
  service?: string;
  serviceInterested?: string;
  serviceName?: string;
  comments?: string;
  state?: string;
  uploadFile?: { companyName?: string };
  notes?: { id: string; text: string; createdAt: string; }[];
  createdAt?: string;
}

export type Lead = {
  id: string;
  client: string;
  company: string;
  rawCompany: string;
  phone: string;
  email: string;
  status: string;
  nextSchedule: string;
  nextTime: string;
  timezone: string;
  followUpNotes: string;
  interestedService: string;
  comments: string;
  state: string;
  noteHistory: NoteEntry[];
};

export const mapBackendLead = (lead: BackendLead): Lead => {
  const legacyNote: NoteEntry[] = lead.comments
    ? [{ id: "legacy", text: lead.comments, createdAt: lead.createdAt ?? new Date().toISOString() }]
    : [];
  const noteHistory: NoteEntry[] = (lead.notes ?? []).length > 0
    ? (lead.notes ?? []).map(n => ({ id: n.id, text: n.text, createdAt: n.createdAt }))
    : legacyNote;

  return {
    id:               lead.id,
    client:           lead.name                              ?? "Unknown",
    company:          lead.uploadFile?.companyName ?? lead.company ?? "N/A",
    rawCompany:       lead.company                            ?? "",
    phone:            lead.phone                             ?? "N/A",
    email:            lead.email                             ?? "N/A",
    status:           lead.status                            ?? "pending",
    nextSchedule:     lead.nextSchedule                      ?? "",
    nextTime:         lead.nextTime                          ?? "",
    timezone:         lead.timezone                          ?? "",
    followUpNotes:    lead.followUpNotes                     ?? "",
    interestedService:
      lead.interestedService ??
      lead.interested_service ??
      lead.service ??
      lead.serviceInterested ??
      lead.serviceName ??
      "",
    comments:         lead.comments   ?? "",
    state:            lead.state      ?? "",
    noteHistory,
  };
};

export const getPriority = (status: string): "High" | "Medium" =>
  status === "important" ? "High" : "Medium";
