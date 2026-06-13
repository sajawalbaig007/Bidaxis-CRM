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
};

export const mapBackendLead = (lead: BackendLead): Lead => ({
  id: lead.id,
  client: lead.name ?? "Unknown",
  company: lead.uploadFile?.companyName ?? lead.company ?? "N/A",
  rawCompany: lead.company ?? "",
  phone: lead.phone ?? "N/A",
  email: lead.email ?? "N/A",
  status: lead.status ?? "pending",
  nextSchedule: lead.nextSchedule ?? "",
  nextTime: lead.nextTime ?? "",
  timezone: lead.timezone ?? "",
  followUpNotes: lead.followUpNotes ?? "",
  interestedService:
    lead.interestedService ??
    lead.interested_service ??
    lead.service ??
    lead.serviceInterested ??
    lead.serviceName ??
    "",
  comments: lead.comments ?? "",
  state: lead.state ?? "",
});

export const getPriority = (status: string): "High" | "Medium" =>
  status === "important" ? "High" : "Medium";
