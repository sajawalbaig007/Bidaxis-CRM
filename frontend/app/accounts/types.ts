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

export type BalanceLineItem = {
  id: string;
  label: string;
  note?: string;
  amount: number;
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
  headLabels: string[];
  totalSalary: number;
};

export type OpexRow = {
  id: string;
  label: string;
  amount: number;
};

export type IncomeStatementData = {
  totalRevenue: number;
  teamSalaries: TeamSalaryRow[];
  opexHeads: OpexRow[];
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
};

export type TotalAssetsData = {
  sections: AssetSectionRow[];
};

export type DashboardCurrency = {
  usdAmount: number;
  cadAmount: number;
  pkrAmount: number;
  usdToPkrRate: number;
  cadToPkrRate: number;
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
