export type AccountsPageKey =
  | "dashboard"
  | "balance_sheet"
  | "income_statement"
  | "cash_flow"
  | "total_assets";

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
  amount: number;
  /** Date this individual entry was filled (YYYY-MM-DD). */
  filledAt: string;
};

export type BalanceLineItem = {
  id: string;
  label: string;
  note?: string;
  amount: number;
  filledAt?: string;
  subHeads?: SubHeadEntry[];
};

export type BalanceSection = {
  id: string;
  title: string;
  items: BalanceLineItem[];
};

export type StickyNote = {
  id: string;
  text: string;
  color?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type BalanceSheetData = {
  assetSections: BalanceSection[];
  equityLiabilitySections: BalanceSection[];
  stickyNotes?: StickyNote[];
};

export type TeamSalaryRow = {
  id: string;
  team: string;
  /** @deprecated migrated into subHeads */
  headLabels?: string[];
  totalSalary: number;
  filledAt?: string;
  subHeads?: SubHeadEntry[];
};

export type OpexRow = {
  id: string;
  label: string;
  amount: number;
  filledAt?: string;
  subHeads?: SubHeadEntry[];
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
};

export type TotalAssetsData = {
  sections: AssetSectionRow[];
};

export type CurrencyTabKey = "SN" | "AH";

export type DashboardCurrencyTab = {
  usdAmount: number;
  cadAmount: number;
  pkrAmount: number;
  usdToPkrRate: number;
  cadToPkrRate: number;
  usdTaxFactor: number;
  cadTaxFactor: number;
};

export type DashboardCurrency = {
  usdAmount?: number;
  cadAmount?: number;
  pkrAmount?: number;
  usdToPkrRate?: number;
  cadToPkrRate?: number;
  tabs: Record<CurrencyTabKey, DashboardCurrencyTab>;
};

export type DashboardData = {
  currency: DashboardCurrency;
};

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
