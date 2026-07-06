export type PortalRole = "admin" | "csr" | "manager";

export const PORTAL_OPTIONS: { value: PortalRole; label: string; hint: string }[] = [
  { value: "admin",   label: "Admin",   hint: "Full admin dashboard" },
  { value: "csr",     label: "CSR",     hint: "Client calls & leads" },
  { value: "manager", label: "Manager", hint: "Same as admin — leads, reports & projects" },
];

export function portalLabel(role: PortalRole) {
  return PORTAL_OPTIONS.find(o => o.value === role)?.label ?? role;
}
