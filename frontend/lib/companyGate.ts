import type { PortalRole } from "@/lib/loginRole";

export type PortalCompany = "BEM" | "GPS";

export type CompanyMeta = {
  key: PortalCompany;
  slug: string;
  name: string;
  legalName: string;
  tagline: string;
  accent: string;
  accentSoft: string;
  logoSrc: string;
  portalsLabel: string;
};

export const COMPANY_META: Record<PortalCompany, CompanyMeta> = {
  BEM: {
    key: "BEM",
    slug: "bem",
    name: "BEM Solutions",
    legalName: "BEM Solutions",
    tagline: "Operations, sales & finance portals",
    accent: "#B8112D",
    accentSoft: "#ff4d6d",
    logoSrc: "/images/LOGO.png",
    portalsLabel: "CEO · Admin · CSR · Accounts",
  },
  GPS: {
    key: "GPS",
    slug: "gps",
    name: "GPS",
    legalName: "Global Pre Construction Solution",
    tagline: "Estimation & takeoff portals",
    accent: "#0F398A",
    accentSoft: "#3B82F6",
    logoSrc: "/images/global-logo.png",
    portalsLabel: "Chief Estimator · Estimator",
  },
};

export const COMPANY_PORTAL_ROLES: Record<PortalCompany, PortalRole[]> = {
  BEM: ["admin", "manager", "csr", "accounts"],
  GPS: ["technical_manager", "estimator"],
};

const STORAGE_KEY = "crm_company_gate";

export function parseCompanyParam(raw: string | undefined | null): PortalCompany | null {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "bem") return "BEM";
  if (v === "gps") return "GPS";
  return null;
}

export function companyForPortal(role: PortalRole): PortalCompany {
  return COMPANY_PORTAL_ROLES.GPS.includes(role) ? "GPS" : "BEM";
}

export type CompanyGateSession = {
  company: PortalCompany;
  token: string;
};

function readRaw(): CompanyGateSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { company?: string; token?: string };
    const company = parsed.company === "GPS" ? "GPS" : parsed.company === "BEM" ? "BEM" : null;
    const token = typeof parsed.token === "string" ? parsed.token.trim() : "";
    if (!company || !token) return null;
    return { company, token };
  } catch {
    return null;
  }
}

export function getCompanyGate(): CompanyGateSession | null {
  return readRaw();
}

export function setCompanyGate(company: PortalCompany, token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ company, token }));
}

export function clearCompanyGate() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

export function hasCompanyGate(company: PortalCompany): boolean {
  const s = readRaw();
  return !!s && s.company === company && s.token.length > 0;
}
