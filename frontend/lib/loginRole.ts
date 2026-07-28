export type PortalRole = "admin" | "csr" | "manager" | "technical_manager" | "accounts";

export const PORTAL_OPTIONS: { value: PortalRole; label: string; hint: string }[] = [
  { value: "admin",              label: "Admin",              hint: "Full admin dashboard" },
  { value: "csr",                label: "CSR",                hint: "Client calls & leads" },
  { value: "manager",            label: "Manager",            hint: "Same as admin — leads, reports & projects" },
  { value: "technical_manager",  label: "Technical Manager",  hint: "TMS — projects, KPI & team monitoring" },
  { value: "accounts",           label: "Accounts",           hint: "Accounts dashboard — statements & assets" },
];

export function portalLabel(role: PortalRole) {
  return PORTAL_OPTIONS.find(o => o.value === role)?.label ?? role;
}
