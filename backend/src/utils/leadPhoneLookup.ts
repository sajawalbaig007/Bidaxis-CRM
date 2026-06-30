import prisma from "../config/db";
import { normalizePhone, phonesMatch } from "./phone";
import { parseProjectPayments, paidTotalFromEntries } from "./projectPayments";

export async function findLeadsByPhone(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return [];

  const exact = await prisma.lead.findMany({
    where:   { phone: trimmed },
    orderBy: { updatedAt: "desc" },
  });
  if (exact.length > 0) return exact;

  const digits = normalizePhone(trimmed);
  if (digits.length < 7) return [];

  const suffix = digits.slice(-10);
  const candidates = await prisma.lead.findMany({
    where:   { phone: { not: null, contains: suffix } },
    orderBy: { updatedAt: "desc" },
  });
  return candidates.filter(l => l.phone && phonesMatch(l.phone, trimmed));
}

function paidTotal(lead: { paidAmount?: string | null; projectPayments?: string | null }) {
  if (lead.projectPayments) {
    try {
      return paidTotalFromEntries(parseProjectPayments(lead.projectPayments));
    } catch { /* fall through */ }
  }
  const n = parseFloat(String(lead.paidAmount ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function isWonStatus(status: string | null | undefined) {
  const s = (status ?? "").toLowerCase();
  return s === "close client" || s === "completed" || s === "closed";
}

export function buildPhoneLookupResponse(matches: Awaited<ReturnType<typeof findLeadsByPhone>>) {
  if (matches.length === 0) {
    return { success: true, found: false };
  }

  const latest = matches[0];
  const wonProject = matches.find(l => isWonStatus(l.status));

  const services = [...new Set(
    matches
      .map(l => l.interestedService?.trim())
      .filter((s): s is string => !!s),
  )];

  const projects = matches
    .filter(l => isWonStatus(l.status) || l.projectTitle || l.clientCode)
    .map(l => ({
      id: l.id,
      title: l.projectTitle || l.company || l.name || "Project",
      clientCode: l.clientCode,
      service: l.interestedService,
      status: l.status,
      paidAmount: paidTotal(l),
      deadline: l.projectDeadline,
      closedAt: l.updatedAt,
    }));

  const totalBusiness = projects.reduce((sum, p) => sum + p.paidAmount, 0);

  return {
    success:           true,
    found:             true,
    isReturningClient: matches.length >= 1,
    projectCount:      matches.length,
    totalBusiness,
    services,
    projects,
    history: matches.map(l => ({
      id: l.id,
      name: l.name,
      company: l.company,
      status: l.status,
      service: l.interestedService,
      clientCode: l.clientCode,
      paidAmount: paidTotal(l),
      updatedAt: l.updatedAt,
    })),
    client: {
      name:              latest.name              ?? "",
      company:           latest.company           ?? "",
      email:             latest.email             ?? "",
      state:             latest.state             ?? "",
      interestedService: wonProject?.interestedService ?? latest.interestedService ?? "",
    },
  };
}
