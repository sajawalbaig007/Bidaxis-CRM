import prisma from "../config/db";
import { hashPassword } from "./hash";

export const COMPANY_KEYS = ["BEM"] as const;
export type CompanyKey = (typeof COMPANY_KEYS)[number];

const DEFAULTS: Record<CompanyKey, { username: string; password: string }> = {
  BEM: { username: "BidAxis", password: "TrioA15A20S30@" },
};

export function normalizeCompanyKey(raw: unknown): CompanyKey | null {
  const v = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  if (v === "BEM" || v === "BIDAXIS" || v === "GPS") return "BEM";
  return null;
}

export function publicCredential(row: { company: string; username: string; updatedAt: Date; createdAt: Date }) {
  return {
    company: row.company,
    username: row.username,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

/** Create BidAxis company access if missing. GPS is not a company. */
export async function seedDefaultCompanyCredentials(): Promise<void> {
  await prisma.companyCredential.deleteMany({ where: { company: "GPS" } });
  const existing = await prisma.companyCredential.findUnique({ where: { company: "BEM" } });
  if (existing) return;
  const def = DEFAULTS.BEM;
  await prisma.companyCredential.create({
    data: {
      company: "BEM",
      username: def.username,
      password: await hashPassword(def.password),
    },
  });
}
