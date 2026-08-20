import prisma from "../config/db";
import { hashPassword } from "./hash";

export const COMPANY_KEYS = ["BEM", "GPS"] as const;
export type CompanyKey = (typeof COMPANY_KEYS)[number];

const DEFAULTS: Record<CompanyKey, { username: string; password: string }> = {
  BEM: { username: "BEM", password: "123456" },
  GPS: { username: "GPS", password: "123456" },
};

export function normalizeCompanyKey(raw: unknown): CompanyKey | null {
  const v = String(raw ?? "").trim().toUpperCase();
  if (v === "BEM" || v === "GPS") return v;
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

/** First deploy only: if the collection is empty, create BEM + GPS defaults. */
export async function seedDefaultCompanyCredentials(): Promise<void> {
  const count = await prisma.companyCredential.count();
  if (count > 0) return;

  await Promise.all(
    COMPANY_KEYS.map(async (company) => {
      const def = DEFAULTS[company];
      await prisma.companyCredential.create({
        data: {
          company,
          username: def.username,
          password: await hashPassword(def.password),
        },
      });
    }),
  );
}
