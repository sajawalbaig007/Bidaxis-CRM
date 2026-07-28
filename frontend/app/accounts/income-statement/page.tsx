"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AccountsSidebar from "../components/layout/Sidebar";
import RechartsBox from "@/app/components/charts/RechartsBox";

type TeamSalaryHead = {
  team: string;
  headLabels: string[];
  totalSalary: number;
};

const TOTAL_REVENUE = 2_659_822;

const TEAM_SALARY_HEADS: TeamSalaryHead[] = [
  {
    team: "Technical Team Salaries",
    headLabels: [
      "Basic Salary",
      "Week Days Overtime",
      "Weekend Overtime",
      "Total Overtime",
      "Allowances",
      "Late Deduction",
      "Loan Deduction",
      "PF Deduction",
      "Income Tax Deduction",
      "Total Salary",
    ],
    totalSalary: 162_645,
  },
  {
    team: "Sales Team Salaries",
    headLabels: [
      "Basic Salary",
      "Project Closed",
      "TL Allowance",
      "Commission Per Project",
      "Commission for Fixed Client",
      "Total Commission",
      "Late Deduction",
      "PF Deduction",
      "Income Tax Deduction",
      "Total Salary",
    ],
    totalSalary: 420_303,
  },
  {
    team: "Email Marketing Team Salaries",
    headLabels: [
      "Basic Salary",
      "Project Closed",
      "Commission Per Project",
      "Commission for Fixed Client",
      "Total Commission",
      "Allowances",
      "Late Deduction",
      "Loan Deduction",
      "Total Deduction",
      "Total Salary",
    ],
    totalSalary: 10_000,
  },
  {
    team: "Administration Salaries",
    headLabels: [
      "Basic Salary",
      "Allowances",
      "Income Tax Deduction",
      "Loan Deduction",
      "Unpaid Leaves",
      "Late Arrival Deduction",
      "PF Deduction",
      "Total Deduction",
      "Net Salary",
      "Comment",
    ],
    totalSalary: 178_693,
  },
  {
    team: "Executive Salaries",
    headLabels: [
      "Basic Salary",
      "Commission",
      "Loan (+ve)",
      "Loan (-ve)",
      "Total Earning",
      "Transfer Date",
      "Comment",
    ],
    totalSalary: 40_000,
  },
];

const OPEX_HEADS = [
  { label: "Office Management Expenses", amount: 10_000 },
  { label: "IT Equipments Expenses", amount: 0 },
  { label: "Regular IT Expenses", amount: 90_000 },
  { label: "Outsourcing Expenses", amount: 100_000 },
  { label: "Asset Purchasing Expenses", amount: 0 },
  { label: "Miscellaneous Expenses", amount: 50_000 },
];

function currency(value: number) {
  return value.toLocaleString("en-US");
}

export default function IncomeStatementPage() {
  const payrollExpense = TEAM_SALARY_HEADS.reduce((acc, item) => acc + item.totalSalary, 0);
  const operatingExpense = OPEX_HEADS.reduce((acc, item) => acc + item.amount, 0);
  const totalExpense = payrollExpense + operatingExpense;
  const netProfit = TOTAL_REVENUE - totalExpense;
  const netMargin = TOTAL_REVENUE > 0 ? (netProfit / TOTAL_REVENUE) * 100 : 0;

  const payrollChartData = TEAM_SALARY_HEADS.map((item) => ({
    name: item.team.replace(" Salaries", ""),
    value: item.totalSalary,
  }));

  const expenseMixData = [
    { name: "Payroll", value: payrollExpense },
    { name: "Operating", value: operatingExpense },
  ];

  const incomeCompareData = [
    { name: "Revenue", amount: TOTAL_REVENUE },
    { name: "Total Expense", amount: totalExpense },
    { name: "Net Profit", amount: netProfit },
  ];

  const PIE_COLORS = ["#0B84F3", "#B8112D"];

  return (
    <div className="flex min-h-screen bg-[#F0F2F8]">
      <AccountsSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden mt-[64px]">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-4 md:px-6 lg:px-8 py-6 space-y-5">
          <header className="flex flex-col gap-2">
            <h1 className="text-xl sm:text-2xl md:text-[28px] font-bold text-[#0F172A] tracking-tight">Income Statement</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Structured using your salary sheet heads with payroll and operating expense split.
            </p>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="bg-gradient-to-br from-[#0B84F3] to-[#0369A1] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Revenue</p>
              <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(TOTAL_REVENUE)}</p>
            </div>
            <div className="bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Payroll Expense</p>
              <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(payrollExpense)}</p>
            </div>
            <div className="bg-gradient-to-br from-[#B8112D] to-[#8b0d22] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Total Expense</p>
              <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(totalExpense)}</p>
            </div>
            <div className="bg-gradient-to-br from-[#12B76A] to-[#027A48] rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">Net Profit</p>
              <p className="text-lg sm:text-2xl font-extrabold mt-1 tracking-tight">{currency(netProfit)}</p>
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-12 gap-3 sm:gap-4">
            <div className="xl:col-span-6 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Team Salary Distribution</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Net salary paid by team</p>
              <div className="mt-3 h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={payrollChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#475569" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                    <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#0B84F3" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="xl:col-span-6 bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Expense Mix</h2>
              <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Payroll vs Operating cost share</p>
              <RechartsBox height={280} className="mt-3">
                <PieChart>
                  <Pie data={expenseMixData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={5}>
                    {expenseMixData.map((_, idx) => (
                      <Cell key={`mix-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </RechartsBox>
            </div>
          </section>

          <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-gray-100 shadow-sm">
            <h2 className="font-bold text-gray-800 text-sm sm:text-base">Revenue vs Expense vs Profit</h2>
            <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">Monthly performance comparison</p>
            <div className="mt-3 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeCompareData} barSize={52}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700, fill: "#475569" }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                  <Tooltip formatter={(value) => currency(Number(value ?? 0))} />
                  <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                    {incomeCompareData.map((item) => (
                      <Cell
                        key={item.name}
                        fill={item.name === "Revenue" ? "#0B84F3" : item.name === "Total Expense" ? "#B8112D" : "#12B76A"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-5 py-3 border-b border-gray-200 bg-[#F8FAFC]">
              <h2 className="font-bold text-gray-800 text-sm sm:text-base">Income Statement (Head Wise)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: "980px" }}>
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Section</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-700">Picked Heads From Salary Table</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-700">Net Total</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAM_SALARY_HEADS.map((section) => (
                    <tr key={section.team} className="border-b border-gray-100 align-top">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{section.team}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600 leading-5">{section.headLabels.join(" • ")}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{currency(section.totalSalary)}</td>
                    </tr>
                  ))}
                  {OPEX_HEADS.map((item) => (
                    <tr key={item.label} className="border-b border-gray-100">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{item.label}</td>
                      <td className="px-3 py-2.5 text-xs text-gray-600">Payment Purpose, Date, Person of Payment, Account Specification, Amount, Remarks</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-800">{currency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#EEF7FF] border-t border-gray-200">
                    <td className="px-3 py-2.5 font-bold text-[#0F172A]" colSpan={2}>
                      Total Expense
                    </td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-[#0F172A]">{currency(totalExpense)}</td>
                  </tr>
                  <tr className="bg-[#ECFDF3] border-t border-gray-200">
                    <td className="px-3 py-2.5 font-bold text-[#0F172A]" colSpan={2}>
                      Net Profit ({netMargin.toFixed(2)}%)
                    </td>
                    <td className="px-3 py-2.5 text-right font-extrabold text-[#0F172A]">{currency(netProfit)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
