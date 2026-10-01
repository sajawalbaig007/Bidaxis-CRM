import type { Prisma } from "@prisma/client";

export type ProjectDesk = "estimation" | "bim";

export function isBimDeskRole(role: string | undefined | null): boolean {
  return role === "bim_manager" || role === "bim";
}

export function staffRoleForDesk(role: string | undefined | null): "estimator" | "bim" {
  return role === "bim_manager" || role === "bim" ? "bim" : "estimator";
}

/** Admin and Chief Estimator stay on estimation. BIM desk is isolated. */
export function deskWhereForRole(role: string | undefined | null): Prisma.LeadWhereInput {
  if (role === "bim_manager" || role === "bim") return { projectDesk: "bim" };
  return { OR: [{ projectDesk: null }, { projectDesk: { not: "bim" } }] };
}

export function leadOnBimDesk(lead: { projectDesk?: string | null }): boolean {
  return lead.projectDesk === "bim";
}

export function leadVisibleOnDesk(lead: { projectDesk?: string | null }, role: string | undefined | null): boolean {
  const bim = leadOnBimDesk(lead);
  if (role === "bim_manager" || role === "bim") return bim;
  return !bim;
}
