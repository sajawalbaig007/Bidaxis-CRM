"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAccountsPageKey = isAccountsPageKey;
exports.toPrismaAccountsPage = toPrismaAccountsPage;
exports.defaultAccountsData = defaultAccountsData;
exports.isValidRecordDate = isValidRecordDate;
function isAccountsPageKey(v) {
    return (v === "dashboard" ||
        v === "balance_sheet" ||
        v === "income_statement" ||
        v === "cash_flow" ||
        v === "total_assets");
}
function toPrismaAccountsPage(key) {
    return key;
}
function rid(prefix, n) {
    return `${prefix}-${n}`;
}
function defaultAccountsData(page) {
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
        case "income_statement":
            return {
                totalRevenue: 2659822,
                teamSalaries: [
                    {
                        id: rid("t", 1),
                        team: "Technical Team Salaries",
                        headLabels: [
                            "Basic Salary", "Week Days Overtime", "Weekend Overtime", "Total Overtime",
                            "Allowances", "Late Deduction", "Loan Deduction", "PF Deduction",
                            "Income Tax Deduction", "Total Salary",
                        ],
                        totalSalary: 162645,
                    },
                    {
                        id: rid("t", 2),
                        team: "Sales Team Salaries",
                        headLabels: [
                            "Basic Salary", "Project Closed", "TL Allowance", "Commission Per Project",
                            "Commission for Fixed Client", "Total Commission", "Late Deduction",
                            "PF Deduction", "Income Tax Deduction", "Total Salary",
                        ],
                        totalSalary: 420303,
                    },
                    {
                        id: rid("t", 3),
                        team: "Email Marketing Team Salaries",
                        headLabels: [
                            "Basic Salary", "Project Closed", "Commission Per Project",
                            "Commission for Fixed Client", "Total Commission", "Allowances",
                            "Late Deduction", "Loan Deduction", "Total Deduction", "Total Salary",
                        ],
                        totalSalary: 10000,
                    },
                    {
                        id: rid("t", 4),
                        team: "Administration Salaries",
                        headLabels: [
                            "Basic Salary", "Allowances", "Income Tax Deduction", "Loan Deduction",
                            "Unpaid Leaves", "Late Arrival Deduction", "PF Deduction",
                            "Total Deduction", "Net Salary", "Comment",
                        ],
                        totalSalary: 178693,
                    },
                    {
                        id: rid("t", 5),
                        team: "Executive Salaries",
                        headLabels: [
                            "Basic Salary", "Commission", "Loan (+ve)", "Loan (-ve)",
                            "Total Earning", "Transfer Date", "Comment",
                        ],
                        totalSalary: 40000,
                    },
                ],
                opexHeads: [
                    { id: rid("o", 1), label: "Office Management Expenses", amount: 10000 },
                    { id: rid("o", 2), label: "IT Equipments Expenses", amount: 0 },
                    { id: rid("o", 3), label: "Regular IT Expenses", amount: 90000 },
                    { id: rid("o", 4), label: "Outsourcing Expenses", amount: 100000 },
                    { id: rid("o", 5), label: "Asset Purchasing Expenses", amount: 0 },
                    { id: rid("o", 6), label: "Miscellaneous Expenses", amount: 50000 },
                ],
            };
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
                sections: [
                    { id: rid("s", 1), title: "IT Inventory", heads: ["SR#", "Description", "Qty", "Total Price"], total: 171540 },
                    { id: rid("s", 2), title: "Electrical Inventory", heads: ["SR#", "Description", "Qty", "Total Price"], total: 416730 },
                    { id: rid("s", 3), title: "Furniture Inventory", heads: ["SR#", "Description", "Qty", "Total Price"], total: 645770 },
                    { id: rid("s", 4), title: "Office Renovation & Security Expense", heads: ["SR#", "Description", "Qty", "Total Price"], total: 89350 },
                    { id: rid("s", 5), title: "BIM Designing Studio", heads: ["IT Inventory", "Electrical Inventory", "Furniture Inventory"], total: 323830 },
                    { id: rid("s", 6), title: "Global Pre-Construction Services", heads: ["SR#", "Description", "Qty", "Total Price"], total: 117900 },
                ],
            };
        default:
            return {};
    }
}
function isValidRecordDate(d) {
    return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
