import type { EmployeeSalaryDetail } from "./utils/payrollFormula";
import type { SalesPayrollEmployee } from "./utils/salesPayrollFormula";

export type AccountsPageKey =
  | "dashboard"
  | "balance_sheet"
  | "income_statement"
  | "cash_flow"
  | "total_assets"
  | "sales_payroll"
  | "technical_payroll";

export type AccountsUpload = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  createdAt: string;
};

/** Individual fillable line under a parent head. */
export type SubHeadEntry = {
  id: string;
  label: string;
  /** Net / total for charts — for salary people = computed totalSalary */
  amount: number;
  /** Date this individual entry was filled (YYYY-MM-DD). */
  filledAt: string;
  /** Optional payment-proof / screenshot URL (OPEX lines). */
  proofUrl?: string;
  proofName?: string;
  /** Rich payroll fields (Team Salaries people). */
  salary?: EmployeeSalaryDetail;
  /** Sales team commission payroll (no overtime, 6 PM shift). */
  salesPayroll?: SalesPayrollEmployee;
};

/** Date-tagged note on a table row / head. */
export type DatedNote = {
  id: string;
  text: string;
  date: string;
};

export type BalanceLineItem = {
  id: string;
  label: string;
  /** @deprecated use notes[] — kept for old saves */
  note?: string;
  amount: number;
  filledAt?: string;
  subHeads?: SubHeadEntry[];
  notes?: DatedNote[];
};

export type BalanceSection = {
  id: string;
  title: string;
  items: BalanceLineItem[];
};

export type BalanceSheetData = {
  assetSections: BalanceSection[];
  equityLiabilitySections: BalanceSection[];
};

export type TeamSalaryRow = {
  id: string;
  team: string;
  /** @deprecated migrated into subHeads */
  headLabels?: string[];
  totalSalary: number;
  filledAt?: string;
  subHeads?: SubHeadEntry[];
  notes?: DatedNote[];
};

export type OpexRow = {
  id: string;
  label: string;
  amount: number;
  filledAt?: string;
  subHeads?: SubHeadEntry[];
  notes?: DatedNote[];
};

export type IncomeStatementData = {
  totalRevenue: number;
  teamSalaries: TeamSalaryRow[];
  opexHeads: OpexRow[];
  loanHeads?: OpexRow[];
  providentFundHeads?: OpexRow[];
};

export type CashFlowRow = {
  id: string;
  date: string;
  description: string;
  bankAmounts: Record<string, { debit: number; credit: number }>;
  netAmount: number;
  notes?: DatedNote[];
};

export type CashFlowMonth = {
  id: string;
  month: string;
  rows: CashFlowRow[];
};

export type CashFlowData = {
  bankHeads: string[];
  months: CashFlowMonth[];
};

export type AssetSectionRow = {
  id: string;
  title: string;
  heads: string[];
  total: number;
  filledAt?: string;
  subHeads?: SubHeadEntry[];
  notes?: DatedNote[];
};

/** Company keys for Total Assets register. */
export type AssetsCompanyKey = "BEM" | "GPS" | "BDS";

export const ASSETS_COMPANIES: { key: AssetsCompanyKey; label: string; accent: string }[] = [
  { key: "BEM", label: "BEM", accent: "#0D9488" },
  { key: "GPS", label: "GPS", accent: "#0B84F3" },
  { key: "BDS", label: "BDS", accent: "#B8112D" },
];

export type TotalAssetsData = {
  /** Company-wise asset registers */
  companies?: Record<AssetsCompanyKey, AssetSectionRow[]>;
  /** @deprecated legacy flat list — migrated into companies.BEM */
  sections?: AssetSectionRow[];
};

/** AH/SN = FX; CHQ = cheque 25% tax; HM = Habib Metro direct 1% tax */
export type CurrencyTabKey = "SN" | "AH" | "CHQ" | "HM";

export const CURRENCY_TAB_LABELS: Record<CurrencyTabKey | "ALL", string> = {
  AH: "Ahmed Hamza",
  SN: "Sharjeel Nasir",
  CHQ: "Cheque Payment",
  HM: "Direct Habib Metro",
  ALL: "All",
};

export const CURRENCY_TAB_SHORT: Record<CurrencyTabKey | "ALL", string> = {
  AH: "Ahmed",
  SN: "Sharjeel",
  CHQ: "Cheque",
  HM: "Habib",
  ALL: "All",
};

export type DashboardCurrencyTab = {
  usdAmount: number;
  cadAmount: number;
  pkrAmount: number;
  usdToPkrRate: number;
  cadToPkrRate: number;
  usdTaxFactor: number;
  cadTaxFactor: number;
  /**
   * Local PKR payment tax deduction rate (e.g. 0.25 cheque, 0.01 Habib Metro).
   * When set, `pkrAmount` is treated as gross and net = gross × (1 − rate).
   */
  taxDeductionRate?: number;
};

export type DashboardCurrency = {
  usdAmount?: number;
  cadAmount?: number;
  pkrAmount?: number;
  usdToPkrRate?: number;
  cadToPkrRate?: number;
  tabs: Record<CurrencyTabKey, DashboardCurrencyTab>;
};

/** User edit on a built-in (code-defined) formula — sirf text/note override hota hai. */
export type FormulaOverride = {
  expression?: string;
  note?: string;
};

/** User ka apna banaya hua formula. */
export type CustomFormula = {
  id: string;
  section: string;
  title: string;
  expression: string;
  appliesTo?: string;
  note?: string;
};

export type FormulasState = {
  overrides?: Record<string, FormulaOverride>;
  custom?: CustomFormula[];
};

export type DashboardData = {
  currency: DashboardCurrency;
  /** Formula Book — overrides + custom formulas (dashboard record ke saath save hote hain) */
  formulas?: FormulasState;
};

export function isLocalPaymentTab(tab: CurrencyTabKey): boolean {
  return tab === "CHQ" || tab === "HM";
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function monthStartIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function newRowId(prefix = "row"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function currency(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function sumSubHeads(subHeads?: SubHeadEntry[]): number {
  return (subHeads ?? []).reduce((a, s) => a + (Number(s.amount) || 0), 0);
}

export function lineAmount(item: { amount?: number; totalSalary?: number; subHeads?: SubHeadEntry[] }): number {
  if (item.subHeads && item.subHeads.length > 0) return sumSubHeads(item.subHeads);
  return Number(item.amount ?? item.totalSalary) || 0;
}

/** Normalize legacy string note + notes[] into a dated list. */
export function normalizeNotes(
  notes?: DatedNote[],
  legacyNote?: string,
  fallbackDate?: string,
): DatedNote[] {
  if (notes && notes.length > 0) return notes;
  const text = legacyNote?.trim();
  if (!text) return [];
  return [{ id: "legacy-note", text, date: fallbackDate || todayIso() }];
}

/** Latest note by date (then id). */
export function latestNote(
  notes?: DatedNote[],
  legacyNote?: string,
  fallbackDate?: string,
): DatedNote | null {
  const list = normalizeNotes(notes, legacyNote, fallbackDate);
  if (!list.length) return null;
  return [...list].sort((a, b) => {
    const d = b.date.localeCompare(a.date);
    return d !== 0 ? d : b.id.localeCompare(a.id);
  })[0];
}
