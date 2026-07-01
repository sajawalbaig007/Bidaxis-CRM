import { NoteEntry, SubContact } from "../hooks/useLeadsData";

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
  hiddenOnMain?: boolean;
  important?: boolean;
  interested?: boolean;
  updatedAt?: string;
  uploadFile?: { companyName?: string; source?: { sudoName?: string | null } };
  notes?: { id: string; text?: string; createdAt?: string; }[];
  subContacts?: { id: string; name: string; designation?: string; phone?: string; email?: string; createdAt?: string; }[];
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
  hiddenOnMain: boolean;
  important: boolean;
  interested: boolean;
  sourceSudoName: string;
  statusUpdatedAt: string;
  noteCount: number;
  noteHistory: NoteEntry[];
  subContacts: SubContact[];
};

export const mapBackendLead = (lead: BackendLead): Lead => {
  const rawNotes = lead.notes ?? [];
  const fullNotes = rawNotes.filter(n => n.text?.trim());
  const noteCount = fullNotes.length > 0 ? fullNotes.length : rawNotes.length;

  const legacyNotes: NoteEntry[] = [];
  if (fullNotes.length === 0 && lead.comments?.trim()) {
    legacyNotes.push({
      id: "legacy-comments",
      text: lead.comments.trim(),
      createdAt: lead.createdAt ?? new Date().toISOString(),
    });
  }
  if (fullNotes.length === 0 && lead.followUpNotes?.trim()) {
    legacyNotes.push({
      id: "legacy-followup",
      text: lead.followUpNotes.trim(),
      createdAt: lead.updatedAt ?? lead.createdAt ?? new Date().toISOString(),
    });
  }

  const noteHistory: NoteEntry[] = fullNotes.length > 0
    ? fullNotes.map(n => ({
        id: n.id!,
        text: n.text!.trim(),
        createdAt: n.createdAt ?? new Date().toISOString(),
      }))
    : legacyNotes;

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
    comments:     lead.comments     ?? "",
    state:        lead.state        ?? "",
    hiddenOnMain: lead.hiddenOnMain ?? false,
    important:    lead.important    ?? false,
    interested:   lead.interested   ?? false,
    sourceSudoName: lead.uploadFile?.source?.sudoName?.trim() ?? "",
    statusUpdatedAt: lead.updatedAt ?? lead.createdAt ?? "",
    noteCount,
    noteHistory,
    subContacts: (lead.subContacts ?? []).map(s => ({
      id:          s.id,
      name:        s.name,
      designation: s.designation,
      phone:       s.phone,
      email:       s.email,
      createdAt:   s.createdAt,
    })),
  };
};

export const getPriority = (status: string): "High" | "Medium" =>
  status === "important" ? "High" : "Medium";
