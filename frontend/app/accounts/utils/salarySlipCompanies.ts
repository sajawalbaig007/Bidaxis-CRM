/** Company profiles for salary-slip downloads. Add formats here as more companies go live. */

export type SalarySlipCompanyKey = "BEM" | "GPS" | "BDS";

export type SalarySlipCompany = {
  key: SalarySlipCompanyKey;
  /** Button / UI label */
  label: string;
  legalName: string;
  brandLine: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  hrManager: string;
  accountOfficer: string;
  accent: string;
  /** When false, download shows “format coming soon” */
  slipReady: boolean;
};

export const SALARY_SLIP_COMPANIES: Record<SalarySlipCompanyKey, SalarySlipCompany> = {
  BEM: {
    key: "BEM",
    label: "BEM Solutions",
    legalName: "BEM Solutions",
    brandLine: "BEM SOLUTION",
    address: "425, J-03 Block, Phase 2 Johar Town, Lahore",
    phone: "0323-6431991",
    email: "hr@bemsolutions.io",
    website: "bemsolutions.io",
    hrManager: "Shakeela Tabassum",
    accountOfficer: "Muhammad Bilal",
    accent: "#B8112D",
    slipReady: true,
  },
  GPS: {
    key: "GPS",
    label: "GPS",
    legalName: "GPS",
    brandLine: "GPS",
    address: "",
    phone: "",
    email: "",
    website: "",
    hrManager: "",
    accountOfficer: "",
    accent: "#0B84F3",
    slipReady: false,
  },
  BDS: {
    key: "BDS",
    label: "BDS",
    legalName: "BDS",
    brandLine: "BDS",
    address: "",
    phone: "",
    email: "",
    website: "",
    hrManager: "",
    accountOfficer: "",
    accent: "#0D9488",
    slipReady: false,
  },
};

export const DEFAULT_SALARY_SLIP_COMPANY: SalarySlipCompanyKey = "BEM";
