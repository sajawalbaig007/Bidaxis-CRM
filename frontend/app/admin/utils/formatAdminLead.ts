/** Map API lead row → admin leads table Client shape */

import { adminLeadStatusLabel } from "./leadStatus";

export function formatAdminLead(lead: {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  website?: string | null;
  clientCode?: string | null;
  interestedService?: string;
  comments?: string;
  updatedAt?: string;
  status?: string;
  important?: boolean;
  isOldClient?: boolean;
  nextSchedule?: string;
  nextTime?: string;
  timezone?: string;
  state?: string | null;
  uploadFile?: { companyName?: string };
  csr?: { name?: string; csrCode?: string | null };
}): {
  id: string;
  clientName: string;
  email: string;
  contact: string;
  company: string;
  website: string;
  parentCompany: string;
  scope: string;
  lastEmail: string;
  lastCall: string;
  lastComment: string;
  status: string;
  rawStatus: string;
  csr: string;
  csrCode?: string | null;
  clientCode: string | null;
  nextFollowup: string;
  time: string;
  timezone: string;
  isOldClient: boolean;
  state: string;
} {
  const rawStatus = (lead.status || "pending").toLowerCase();
  const raw = lead.important && rawStatus !== "important" ? "important" : rawStatus;

  const displayName =
    lead.name?.trim() ||
    lead.company?.trim() ||
    lead.uploadFile?.companyName?.trim() ||
    "Unknown";

  const displayCompany =
    lead.company?.trim() || lead.uploadFile?.companyName?.trim() || "N/A";

  const nextFollowup = lead.nextSchedule || "";

  return {
    id: lead.id,
    clientName: displayName,
    email: lead.email?.trim() || "N/A",
    contact: lead.phone?.trim() || "N/A",
    company: displayCompany,
    website: lead.website?.trim() || "",
    parentCompany: lead.uploadFile?.companyName || lead.company || "N/A",
    scope: lead.interestedService?.trim() || "N/A",
    lastEmail: "",
    lastCall: lead.updatedAt?.split("T")[0] || "",
    lastComment: lead.comments || "No comments",
    rawStatus: raw,
    status: adminLeadStatusLabel(raw, nextFollowup),
    csr: lead.csr?.name || "Unassigned",
    csrCode: lead.csr?.csrCode ?? null,
    clientCode: lead.clientCode?.trim() || null,
    nextFollowup,
    time: lead.nextTime || "N/A",
    timezone: lead.timezone || "N/A",
    isOldClient: lead.isOldClient ?? false,
    state: lead.state?.trim() || "",
  };
}
