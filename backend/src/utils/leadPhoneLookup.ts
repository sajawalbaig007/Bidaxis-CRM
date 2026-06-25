import prisma from "../config/db";
import { normalizePhone, phonesMatch } from "./phone";

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

export function buildPhoneLookupResponse(matches: Awaited<ReturnType<typeof findLeadsByPhone>>) {
  if (matches.length === 0) {
    return { success: true, found: false };
  }

  const latest = matches[0];
  const wonProject = matches.find(l =>
    ["Close Client", "completed", "close client"].includes((l.status ?? "").toLowerCase())
  );

  return {
    success:           true,
    found:             true,
    isReturningClient: matches.length >= 1,
    projectCount:      matches.length,
    client: {
      name:              latest.name              ?? "",
      company:           latest.company           ?? "",
      email:             latest.email             ?? "",
      state:             latest.state             ?? "",
      interestedService: wonProject?.interestedService ?? latest.interestedService ?? "",
    },
  };
}
