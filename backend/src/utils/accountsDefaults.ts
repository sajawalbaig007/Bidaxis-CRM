import { defaultSalesPayrollData } from "./salesPayrollDefaults";
import { defaultTechnicalPayrollData } from "./technicalPayrollDefaults";

export type AccountsPageKey =
  | "dashboard"
  | "balance_sheet"
  | "income_statement"
  | "cash_flow"
  | "total_assets"
  | "sales_payroll"
  | "technical_payroll";

export function isAccountsPageKey(v: string): v is AccountsPageKey {
  return (
    v === "dashboard" ||
    v === "balance_sheet" ||
    v === "income_statement" ||
    v === "cash_flow" ||
    v === "total_assets" ||
    v === "sales_payroll" ||
    v === "technical_payroll"
  );
}

export function toPrismaAccountsPage(key: AccountsPageKey): AccountsPageKey {
  return key;
}

function rid(prefix: string, n: number) {
  return `${prefix}-${n}`;
}

export function defaultAccountsData(page: AccountsPageKey): Record<string, unknown> {
  switch (page) {
    case "dashboard":
      return {
        currency: {
          usdAmount: 3200,
          cadAmount: 1800,
          pkrAmount: 950000,
          usdToPkrRate: 278,
          cadToPkrRate: 204,
        },
      };

    case "balance_sheet":
      return {
        assetSections: [
          {
            id: rid("as", 1),
            title: "Non-Current Assets",
            items: [
              { id: rid("a", 1), label: "Property, Plant & Equipment", note: "1", amount: 1825000 },
              { id: rid("a", 2), label: "Intangible Assets", note: "2", amount: 420000 },
              { id: rid("a", 3), label: "Investments", note: "3", amount: 760000 },
              { id: rid("a", 4), label: "Other Non-Current Assets", note: "4", amount: 240000 },
            ],
          },
          {
            id: rid("as", 2),
            title: "Current Assets",
            items: [
              { id: rid("a", 5), label: "Inventories", note: "5", amount: 535000 },
              { id: rid("a", 6), label: "Investments", note: "6", amount: 315000 },
              { id: rid("a", 7), label: "Trade Receivables", note: "7", amount: 650000 },
              { id: rid("a", 8), label: "Cash and Cash Equivalents", note: "8", amount: 280000 },
              { id: rid("a", 9), label: "Other Current Assets", note: "9", amount: 145000 },
            ],
          },
        ],
        equityLiabilitySections: [
          {
            id: rid("es", 1),
            title: "Equity",
            items: [
              { id: rid("e", 1), label: "Share Capital", note: "10", amount: 1800000 },
              { id: rid("e", 2), label: "Retained Earnings", note: "11", amount: 970000 },
              { id: rid("e", 3), label: "Other Equity", note: "12", amount: 345000 },
            ],
          },
          {
            id: rid("es", 2),
            title: "Non-Current Liabilities",
            items: [
              { id: rid("e", 4), label: "Long-Term Borrowings", note: "13", amount: 620000 },
              { id: rid("e", 5), label: "Long-Term Provisions", note: "14", amount: 215000 },
              { id: rid("e", 6), label: "Deferred Tax Liabilities (Net)", note: "15", amount: 260000 },
              { id: rid("e", 7), label: "Other Non-Current Liabilities", note: "16", amount: 170000 },
            ],
          },
          {
            id: rid("es", 3),
            title: "Current Liabilities",
            items: [
              { id: rid("e", 8), label: "Short-Term Borrowings", note: "17", amount: 330000 },
              { id: rid("e", 9), label: "Trade Payables", note: "18", amount: 380000 },
              { id: rid("e", 10), label: "Other Current Liabilities", note: "19", amount: 235000 },
              { id: rid("e", 11), label: "Short-Term Provisions", note: "20", amount: 145000 },
            ],
          },
        ],
      };

    case "income_statement": {
      const sub = (prefix: string, n: number, label: string, amount: number) => ({
        id: rid(prefix, n),
        label,
        amount,
        filledAt: "",
      });
      return {
        totalRevenue: 2_659_822,
        teamSalaries: [
          {
            id: rid("t", 1),
            team: "Technical Team Salaries",
            totalSalary: 162_645,
            subHeads: [
              sub("ts", 1, "Noman Khan", 19_512),
              sub("ts", 2, "Muhammad Abdullah", 18_458),
              sub("ts", 3, "Rizwan Sabir", 19_682),
              sub("ts", 4, "Usama Jameel", 20_849),
              sub("ts", 5, "Khaldoon Abrar", 19_733),
              sub("ts", 6, "Muhammad Zaid", 19_682),
              sub("ts", 7, "Muhammad Bariq", 23_896),
              sub("ts", 8, "Afaq", 20_833),
            ],
          },
          {
            id: rid("t", 2),
            team: "Sales Team Salaries",
            totalSalary: 358_853,
            subHeads: [
              sub("ss", 2, "Huraira", 71_055),
              sub("ss", 3, "Faris", 43_763),
              sub("ss", 4, "Ali", 71_979),
              sub("ss", 5, "Faizan", 93_856),
              sub("ss", 6, "Asim", 31_400),
              sub("ss", 7, "Anam", 46_800),
            ],
          },
          {
            id: rid("t", 6),
            team: "Sales Team Lead Salaries",
            totalSalary: 61_450,
            subHeads: [
              sub("stl", 1, "Hammad", 61_450),
            ],
          },
          {
            id: rid("t", 3),
            team: "Email Marketing Team Salaries",
            totalSalary: 10_000,
            subHeads: [
              sub("es", 1, "Aftab", 10_000),
            ],
          },
          {
            id: rid("t", 4),
            team: "Administration Salaries",
            totalSalary: 178_693,
            subHeads: [
              sub("as", 1, "Qasim (Admin)", 15_955),
              sub("as", 2, "Shakeela (HR)", 19_864),
              sub("as", 3, "Attiq Rehman (Account Officer)", 18_000),
              sub("as", 4, "Muhammad Bilal (Accounts Officer)", 14_973),
              sub("as", 5, "Mr. Noreed (Chartered)", 20_000),
              sub("as", 6, "Hamza (Floor Manager)", 7_400),
              sub("as", 7, "Sajawal", 16_000),
              sub("as", 8, "Ahmer", 16_000),
              sub("as", 9, "Mahnoor", 16_501),
              sub("as", 10, "Office Boy", 14_000),
              sub("as", 11, "Guard", 20_000),
            ],
          },
          {
            id: rid("t", 5),
            team: "Executive Salaries",
            totalSalary: 40_000,
            subHeads: [
              sub("xs", 1, "Mr. Mohsin Qayyum (80%)", 10_000),
              sub("xs", 2, "Mr. Sharjeel Nasir (60%)", 10_000),
              sub("xs", 3, "Mr. Talha Ahmed (60%)", 10_000),
              sub("xs", 4, "Muhammad Irtaza (60%)", 10_000),
            ],
          },
        ],
        opexHeads: [
          {
            id: rid("o", 1),
            label: "Office Management Expenses",
            amount: 10_000,
            subHeads: [
              sub("om", 1, "BEM Rent & Electricity Bill", 10_000),
            ],
          },
          {
            id: rid("o", 2),
            label: "IT Equipments Expenses",
            amount: 0,
            subHeads: [],
          },
          {
            id: rid("o", 3),
            label: "Regular IT Expenses",
            amount: 90_000,
            subHeads: [
              sub("it", 1, "Ptcl Bill payment", 10_000),
              sub("it", 2, "Claude payment hamza bhai", 10_000),
              sub("it", 3, "Devcon server", 10_000),
              sub("it", 4, "Zoom payment devcon", 10_000),
              sub("it", 5, "Zoom payment of two dialer", 10_000),
              sub("it", 6, "Storm fibre bill payment", 10_000),
              sub("it", 7, "LLC Tax Payment", 10_000),
              sub("it", 8, "100 CAD shopdrawing structure review", 10_000),
              sub("it", 9, "Gmails monthly payments", 10_000),
            ],
          },
          {
            id: rid("o", 4),
            label: "Outsourcing Expenses",
            amount: 100_000,
            subHeads: [
              sub("out", 1, "Payment to Sir shafaqat", 10_000),
              sub("out", 2, "Mohsin Mughal", 10_000),
              sub("out", 3, "Ayesha", 10_000),
              sub("out", 4, "Irtiza (April)", 10_000),
              sub("out", 5, "Ahmed's Reference", 10_000),
              sub("out", 6, "Ahmed", 10_000),
              sub("out", 7, "Irtaza (May)", 10_000),
              sub("out", 8, "Ayesha (May)", 10_000),
              sub("out", 9, "Mohsin Mughal (May)", 10_000),
              sub("out", 10, "Outsourcing — other", 10_000),
            ],
          },
          {
            id: rid("o", 5),
            label: "Asset Purchasing Expenses",
            amount: 0,
            subHeads: [],
          },
          {
            id: rid("o", 6),
            label: "Miscellaneous Expenses",
            amount: 50_000,
            subHeads: [
              sub("misc", 1, "Kitchen Grocery", 10_000),
              sub("misc", 2, "Miscellaneous — other", 10_000),
              sub("misc", 3, "Notepad, Ballpen", 10_000),
              sub("misc", 4, "Hand wash", 10_000),
              sub("misc", 5, "Tissue boxes and rolls", 10_000),
            ],
          },
        ],
        loanHeads: [
          {
            id: rid("ln", 1),
            label: "Loan Issued",
            amount: 8_000,
            subHeads: [
              sub("loan", 1, "Office Boy — Loan 1", 4_000),
              sub("loan", 2, "Office Boy — Loan 2 (12/05/2026)", 1_000),
              sub("loan", 3, "Office Boy — Loan 3 (16/05/2026)", 1_000),
              sub("loan", 4, "Office Boy — Loan 4 (20/05/2026)", 2_000),
            ],
          },
        ],
        providentFundHeads: [
          {
            id: rid("pf", 1),
            label: "Sales Team PF",
            amount: 70_000,
            subHeads: [
              sub("pfs", 1, "Hammad", 10_000),
              sub("pfs", 2, "Huraira", 10_000),
              sub("pfs", 3, "Faris", 10_000),
              sub("pfs", 4, "Ali", 10_000),
              sub("pfs", 5, "Faizan", 10_000),
              sub("pfs", 6, "Asim", 10_000),
              sub("pfs", 7, "Anam", 10_000),
            ],
          },
          {
            id: rid("pf", 2),
            label: "Administration PF",
            amount: 100_000,
            subHeads: [
              sub("pfa", 1, "Qasim (Admin)", 10_000),
              sub("pfa", 2, "Shakeela (HR)", 10_000),
              sub("pfa", 3, "Attiq Rehman (Account Officer)", 10_000),
              sub("pfa", 4, "Muhammad Bilal (Accounts Officer)", 10_000),
              sub("pfa", 5, "Hamza (Floor Manager)", 10_000),
              sub("pfa", 6, "Sajawal", 10_000),
              sub("pfa", 7, "Ahmer", 10_000),
              sub("pfa", 8, "Mahnoor", 10_000),
              sub("pfa", 9, "Office Boy", 10_000),
              sub("pfa", 10, "Guard", 10_000),
            ],
          },
          {
            id: rid("pf", 3),
            label: "Technical Team PF",
            amount: 90_000,
            subHeads: [
              sub("pft", 1, "Muhammad Abdullah", 10_000),
              sub("pft", 2, "Rizwan Sabir", 10_000),
              sub("pft", 3, "Usama Jameel", 10_000),
              sub("pft", 4, "Muhammad Afaq Amin", 10_000),
              sub("pft", 5, "Khaldoon Abrar", 10_000),
              sub("pft", 6, "Muhammad Bariq", 10_000),
              sub("pft", 7, "Ayesha Ashraf", 10_000),
              sub("pft", 8, "Manal Younas", 10_000),
              sub("pft", 9, "Zainab Khalil", 10_000),
            ],
          },
        ],
      };
    }

    case "cash_flow":
      return {
        bankHeads: ["AH Paypal", "SN Paypal", "CO. Habib Metro", "Qasim Habib Metro"],
        months: [
          {
            id: rid("m", 1),
            month: "May 2026",
            rows: [
              {
                id: rid("r", 1),
                date: "2026-04-30",
                description: "Closing Balance at the end of April",
                bankAmounts: {
                  "AH Paypal": { debit: 0, credit: 0 },
                  "SN Paypal": { debit: 0, credit: 0 },
                  "CO. Habib Metro": { debit: 0, credit: 0 },
                  "Qasim Habib Metro": { debit: 0, credit: 0 },
                },
                netAmount: 200000,
              },
            ],
          },
          {
            id: rid("m", 2),
            month: "June 2026",
            rows: [
              {
                id: rid("r", 2),
                date: "2026-05-31",
                description: "Closing Balance at the end of May",
                bankAmounts: {
                  "AH Paypal": { debit: 0, credit: 0 },
                  "SN Paypal": { debit: 0, credit: 0 },
                  "CO. Habib Metro": { debit: 0, credit: 0 },
                  "Qasim Habib Metro": { debit: 0, credit: 0 },
                },
                netAmount: 200000,
              },
            ],
          },
        ],
      };

    case "total_assets":
      return {
        companies: {
          BEM: [
            { id: rid("bem", 1), title: "IT Inventory", heads: [], total: 0, subHeads: [] },
            { id: rid("bem", 2), title: "Electrical Inventory", heads: [], total: 0, subHeads: [] },
            { id: rid("bem", 3), title: "Furniture Inventory", heads: [], total: 0, subHeads: [] },
          ],
          GPS: [
            { id: rid("gps", 1), title: "IT Inventory", heads: [], total: 0, subHeads: [] },
            { id: rid("gps", 2), title: "Global Pre-Construction Services", heads: [], total: 0, subHeads: [] },
          ],
          BDS: [
            { id: rid("bds", 1), title: "BIM Designing Studio", heads: [], total: 0, subHeads: [] },
            { id: rid("bds", 2), title: "Office Renovation & Security", heads: [], total: 0, subHeads: [] },
          ],
        },
        sections: [],
      };

    case "sales_payroll":
      return defaultSalesPayrollData() as unknown as Record<string, unknown>;

    case "technical_payroll":
      return defaultTechnicalPayrollData() as unknown as Record<string, unknown>;

    default:
      return {};
  }
}

export function isValidRecordDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
