"use client";

import { useMemo, useState } from "react";

import DashboardNavbar from "../components/Navbar";
import DashboardSidebar from "../components/Sidebar";

import {
  PhoneCall,
  ShoppingCart,
  Users,
  CalendarDays,
  Search,
  Clock3,
  FileBarChart2,
  TrendingUp,
  UserCheck,
  Target,
  Database,
  ChevronDown,
  Activity,
  Trophy,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
  Eye,
  FileText,
  Sparkles,
} from "lucide-react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

/* =========================================
   REPORT TABS
========================================= */

const reportTabs = [
  "CSR Performance",
  "Orders Report",
  "Calls Report",
  "Leads Report",
];

/* =========================================
   MOCK DATABASE
========================================= */

type CsrEntry = {
  name: string;
  calls: number;
  orders: number;
  conversion: string;
  avgTime: string;
  status: string;
};

type CallsChartEntry = {
  day: string;
  calls: number;
};

type OrdersChartEntry = {
  day: string;
  orders: number;
};

type LeadEntry = {
  state: string;
  leads: number;
  assigned: number;
};

type ReportData = {
  csr: CsrEntry[];
  callsChart: CallsChartEntry[];
  ordersChart: OrdersChartEntry[];
  leads: LeadEntry[];
};

type ReportDatabase = Record<string, ReportData>;

const reportDatabase: ReportDatabase = {
  "2026-05-10": {
    csr: [
      {
        name: "John Carter",
        calls: 210,
        orders: 52,
        conversion: "28%",
        avgTime: "3m 42s",
        status: "Excellent",
      },

      {
        name: "Emma Watson",
        calls: 184,
        orders: 41,
        conversion: "22%",
        avgTime: "4m 01s",
        status: "Good",
      },

      {
        name: "Sophia Adams",
        calls: 163,
        orders: 36,
        conversion: "19%",
        avgTime: "3m 30s",
        status: "Excellent",
      },
    ],

    callsChart: [
      { day: "Mon", calls: 120 },
      { day: "Tue", calls: 180 },
      { day: "Wed", calls: 150 },
      { day: "Thu", calls: 240 },
      { day: "Fri", calls: 210 },
      { day: "Sat", calls: 170 },
      { day: "Sun", calls: 110 },
    ],

    ordersChart: [
      { day: "Mon", orders: 18 },
      { day: "Tue", orders: 25 },
      { day: "Wed", orders: 20 },
      { day: "Thu", orders: 31 },
      { day: "Fri", orders: 28 },
      { day: "Sat", orders: 24 },
      { day: "Sun", orders: 16 },
    ],

    leads: [
      {
        state: "Texas",
        leads: 1240,
        assigned: 1190,
      },

      {
        state: "Florida",
        leads: 940,
        assigned: 910,
      },

      {
        state: "California",
        leads: 780,
        assigned: 720,
      },
    ],
  },

  "2026-05-11": {
    csr: [
      {
        name: "Michael Lee",
        calls: 190,
        orders: 48,
        conversion: "24%",
        avgTime: "4m 11s",
        status: "Excellent",
      },

      {
        name: "Emma Watson",
        calls: 170,
        orders: 34,
        conversion: "18%",
        avgTime: "3m 59s",
        status: "Good",
      },

      {
        name: "John Carter",
        calls: 144,
        orders: 29,
        conversion: "15%",
        avgTime: "5m 02s",
        status: "Average",
      },
    ],

    callsChart: [
      { day: "Mon", calls: 140 },
      { day: "Tue", calls: 160 },
      { day: "Wed", calls: 190 },
      { day: "Thu", calls: 220 },
      { day: "Fri", calls: 180 },
      { day: "Sat", calls: 130 },
      { day: "Sun", calls: 100 },
    ],

    ordersChart: [
      { day: "Mon", orders: 12 },
      { day: "Tue", orders: 18 },
      { day: "Wed", orders: 22 },
      { day: "Thu", orders: 28 },
      { day: "Fri", orders: 25 },
      { day: "Sat", orders: 17 },
      { day: "Sun", orders: 11 },
    ],

    leads: [
      {
        state: "Ohio",
        leads: 840,
        assigned: 790,
      },

      {
        state: "Nevada",
        leads: 620,
        assigned: 580,
      },

      {
        state: "Georgia",
        leads: 910,
        assigned: 870,
      },
    ],
  },
};

/* =========================================
   PAGE
========================================= */

export default function ReportsPage() {
  const [activeTab, setActiveTab] =
    useState("CSR Performance");

  const [search, setSearch] =
    useState("");

  const [selectedDate, setSelectedDate] =
    useState("2026-05-10");

  const currentData = useMemo(() => {
    return (
      reportDatabase[selectedDate] ||
      reportDatabase["2026-05-10"]
    );
  }, [selectedDate]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F6FA]">

      {/* SIDEBAR */}
      <DashboardSidebar />

      {/* MAIN */}
      <main
        className="
          flex-1
          overflow-y-auto
          overflow-x-hidden
          p-3
          sm:p-4
          md:p-6
          mt-[72px]
          lg:mt-0
        "
      >

        {/* NAVBAR */}
        <DashboardNavbar />

        {/* =========================================
            HEADER
        ========================================= */}

        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">

          <div>

            <div className="flex items-center gap-3">

              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#B8112D] text-white">

                <FileBarChart2 size={20} />

              </div>

              <div>

                <h1 className="text-[32px] font-bold text-[#111827]">
                  Reports & Analytics
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                  Analyze calls, orders,
                  CSR performance and lead
                  activity.
                </p>

              </div>

            </div>

          </div>

          {/* FILTERS */}
          <div className="flex flex-col gap-3 sm:flex-row">

            {/* SEARCH */}
            <div className="relative">

              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                placeholder="Search reports..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                className="
                  h-[50px]
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                  pl-11
                  pr-4
                  text-sm
                  outline-none
                  focus:border-[#B8112D]
                  sm:w-[250px]
                "
              />

            </div>

            {/* DATE */}
            <div className="relative">

              <CalendarDays
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <select
                value={selectedDate}
                onChange={(e) =>
                  setSelectedDate(
                    e.target.value
                  )
                }
                className="
                  h-[50px]
                  rounded-2xl
                  border
                  border-gray-200
                  bg-white
                  pl-11
                  pr-10
                  text-sm
                  outline-none
                  focus:border-[#B8112D]
                "
              >
                <option value="2026-05-10">
                  May 10, 2026
                </option>

                <option value="2026-05-11">
                  May 11, 2026
                </option>

              </select>

            </div>

            {/* EXPORT */}
            <button
              className="
                flex
                h-[50px]
                items-center
                justify-center
                gap-2

                rounded-2xl

                bg-[#B8112D]

                px-5

                text-sm
                font-semibold
                text-white

                transition-all
                duration-200

                hover:bg-[#a30f27]
              "
            >
              Export

              <ChevronDown size={18} />
            </button>

          </div>

        </div>

        {/* =========================================
            LIVE STATUS
        ========================================= */}

        <div className="mt-6 rounded-[28px] border border-red-100 bg-white p-5 shadow-sm">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex flex-wrap items-center gap-5">

              <div className="flex items-center gap-3">

                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100">

                  <Wifi
                    size={22}
                    className="text-green-600"
                  />

                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-green-500 animate-ping" />

                </div>

                <div>

                  <h3 className="font-semibold text-[#111827]">
                    Live Monitoring Active
                  </h3>

                  <p className="text-sm text-gray-500">
                    Real-time reporting is
                    connected
                  </p>

                </div>

              </div>

              <div className="h-12 w-[1px] bg-gray-200 hidden lg:block" />

              <div>

                <p className="text-sm text-gray-500">
                  Last Updated
                </p>

                <h4 className="mt-1 font-semibold text-[#111827]">
                  Just Now
                </h4>

              </div>

            </div>

            <div className="flex flex-wrap gap-3">

              <button className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100">
                Today
              </button>

              <button className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100">
                7 Days
              </button>

              <button className="rounded-2xl bg-[#B8112D] px-5 py-3 text-sm font-semibold text-white">
                30 Days
              </button>

            </div>

          </div>

        </div>

        {/* =========================================
            TABS
        ========================================= */}

        <div className="mt-6 flex flex-wrap gap-3">

          {reportTabs.map((tab, i) => (
            <button
              key={i}
              onClick={() =>
                setActiveTab(tab)
              }
              className={`
                rounded-2xl
                px-5
                py-3
                text-sm
                font-semibold
                transition-all

                ${
                  activeTab === tab
                    ? "bg-[#B8112D] text-white shadow-sm"
                    : "bg-white text-gray-500 hover:bg-gray-100"
                }
              `}
            >
              {tab}
            </button>
          ))}

        </div>

        {/* =========================================
            STATS
        ========================================= */}

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

          {/* CARD */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Total Calls
                </p>

                <h2 className="mt-2 text-3xl font-bold text-[#111827]">
                  2,438
                </h2>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#B8112D]">
                <PhoneCall size={28} />
              </div>

            </div>

            <div className="mt-5 flex items-center justify-between">

              <div className="flex items-center gap-1 text-sm font-medium text-green-600">

                <ArrowUpRight size={16} />

                +14%

              </div>

              <div className="flex items-end gap-[3px]">

                <div className="h-3 w-2 rounded-full bg-red-200" />

                <div className="h-5 w-2 rounded-full bg-red-300" />

                <div className="h-8 w-2 rounded-full bg-[#B8112D]" />

                <div className="h-6 w-2 rounded-full bg-red-300" />

                <div className="h-10 w-2 rounded-full bg-[#B8112D]" />

              </div>

            </div>

          </div>

          {/* CARD */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Orders Closed
                </p>

                <h2 className="mt-2 text-3xl font-bold text-[#111827]">
                  482
                </h2>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#B8112D]">
                <ShoppingCart size={28} />
              </div>

            </div>

            <div className="mt-5 flex items-center justify-between">

              <div className="flex items-center gap-1 text-sm font-medium text-green-600">

                <ArrowUpRight size={16} />

                +8%

              </div>

              <div className="flex items-end gap-[3px]">

                <div className="h-4 w-2 rounded-full bg-red-200" />

                <div className="h-6 w-2 rounded-full bg-red-300" />

                <div className="h-8 w-2 rounded-full bg-[#B8112D]" />

                <div className="h-5 w-2 rounded-full bg-red-300" />

                <div className="h-9 w-2 rounded-full bg-[#B8112D]" />

              </div>

            </div>

          </div>

          {/* CARD */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Active CSRs
                </p>

                <h2 className="mt-2 text-3xl font-bold text-[#111827]">
                  24
                </h2>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#B8112D]">
                <Users size={28} />
              </div>

            </div>

            <div className="mt-5 flex items-center justify-between">

              <div className="flex items-center gap-1 text-sm font-medium text-green-600">

                <Activity size={16} />

                Online

              </div>

              <div className="flex -space-x-2">

                <div className="h-8 w-8 rounded-full border-2 border-white bg-red-200" />

                <div className="h-8 w-8 rounded-full border-2 border-white bg-red-300" />

                <div className="h-8 w-8 rounded-full border-2 border-white bg-[#B8112D]" />

              </div>

            </div>

          </div>

          {/* CARD */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Avg Call Time
                </p>

                <h2 className="mt-2 text-3xl font-bold text-[#111827]">
                  4m 18s
                </h2>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#B8112D]">
                <Clock3 size={28} />
              </div>

            </div>

            <div className="mt-5 flex items-center justify-between">

              <div className="flex items-center gap-1 text-sm font-medium text-red-500">

                <ArrowDownRight size={16} />

                -2%

              </div>

              <div className="text-sm text-gray-500">
                Faster than yesterday
              </div>

            </div>

          </div>

        </div>

        {/* =========================================
            KPI SECTION
        ========================================= */}

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">

          {/* TOP CSR */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Top Performer
                </p>

                <h3 className="mt-2 text-2xl font-bold text-[#111827]">
                  John Carter
                </h3>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-600">
                <Trophy size={28} />
              </div>

            </div>

            <div className="mt-5 rounded-2xl bg-yellow-50 p-4">

              <div className="flex items-center justify-between">

                <p className="text-sm text-gray-600">
                  Conversion Rate
                </p>

                <p className="text-lg font-bold text-[#111827]">
                  28%
                </p>

              </div>

            </div>

          </div>

          {/* WARNING */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Attention Needed
                </p>

                <h3 className="mt-2 text-2xl font-bold text-[#111827]">
                  Low Orders
                </h3>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                <AlertTriangle size={28} />
              </div>

            </div>

            <div className="mt-5 rounded-2xl bg-red-50 p-4">

              <p className="text-sm text-gray-600">
                Thursday order conversion
                dropped by 11%.
              </p>

            </div>

          </div>

          {/* AI INSIGHT */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  AI Insight
                </p>

                <h3 className="mt-2 text-2xl font-bold text-[#111827]">
                  Smart Analysis
                </h3>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-100 text-purple-600">
                <Sparkles size={28} />
              </div>

            </div>

            <div className="mt-5 rounded-2xl bg-purple-50 p-4">

              <p className="text-sm text-gray-600 leading-relaxed">
                CSRs with call durations
                between 3-4 minutes show
                higher conversion rates.
              </p>

            </div>

          </div>

        </div>

        {/* =========================================
            CHARTS
        ========================================= */}

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">

          {/* LEFT */}
          <div className="xl:col-span-8 rounded-[28px] bg-white p-5 shadow-sm">

            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <h2 className="text-xl font-bold text-[#111827]">
                  {activeTab}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Advanced live analytics &
                  reporting
                </p>

              </div>

              <div className="flex items-center gap-3">

                <div className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-[#B8112D]">
                  {selectedDate}
                </div>

                <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 transition-all hover:bg-gray-100">
                  <Eye size={18} />
                </button>

              </div>

            </div>

            <div className="h-[340px]">

              {activeTab ===
              "CSR Performance" ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={currentData.callsChart}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="day" />

                    <Tooltip />

                    <Bar
                      dataKey="calls"
                      fill="#B8112D"
                      radius={[
                        10, 10, 0, 0,
                      ]}
                    />

                  </BarChart>
                </ResponsiveContainer>
              ) : activeTab ===
                "Orders Report" ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <LineChart
                    data={
                      currentData.ordersChart
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="day" />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="orders"
                      stroke="#B8112D"
                      strokeWidth={4}
                    />

                  </LineChart>
                </ResponsiveContainer>
              ) : activeTab ===
                "Calls Report" ? (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <AreaChart
                    data={
                      currentData.callsChart
                    }
                  >
                    <defs>

                      <linearGradient
                        id="color"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >

                        <stop
                          offset="5%"
                          stopColor="#B8112D"
                          stopOpacity={0.4}
                        />

                        <stop
                          offset="95%"
                          stopColor="#B8112D"
                          stopOpacity={0}
                        />

                      </linearGradient>

                    </defs>

                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="day" />

                    <Tooltip />

                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="#B8112D"
                      fill="url(#color)"
                      strokeWidth={4}
                    />

                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={currentData.leads}
                  >
                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="state" />

                    <Tooltip />

                    <Bar
                      dataKey="leads"
                      fill="#B8112D"
                      radius={[
                        10, 10, 0, 0,
                      ]}
                    />

                  </BarChart>
                </ResponsiveContainer>
              )}

            </div>

          </div>

          {/* RIGHT */}
          <div className="xl:col-span-4 rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold text-[#111827]">
                  Quick Insights
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  AI generated summaries
                </p>

              </div>

              <FileBarChart2 className="text-[#B8112D]" />

            </div>

            <div className="mt-7 space-y-5">

              <div className="flex items-center gap-4 rounded-2xl bg-red-50 p-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B8112D] text-white">
                  <TrendingUp size={22} />
                </div>

                <div>

                  <h3 className="font-semibold text-[#111827]">
                    Best Conversion
                  </h3>

                  <p className="text-sm text-gray-500">
                    Emma Watson - 28%
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] text-white">
                  <Target size={22} />
                </div>

                <div>

                  <h3 className="font-semibold text-[#111827]">
                    Most Orders
                  </h3>

                  <p className="text-sm text-gray-500">
                    52 Orders Closed
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-red-50 p-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#B8112D] text-white">
                  <UserCheck size={22} />
                </div>

                <div>

                  <h3 className="font-semibold text-[#111827]">
                    Top CSR
                  </h3>

                  <p className="text-sm text-gray-500">
                    John Carter
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] text-white">
                  <Database size={22} />
                </div>

                <div>

                  <h3 className="font-semibold text-[#111827]">
                    Leads Assigned
                  </h3>

                  <p className="text-sm text-gray-500">
                    3,820 Distributed
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* =========================================
            TABLE
        ========================================= */}

        <div className="mt-6 overflow-x-auto rounded-[28px] bg-white p-5 shadow-sm">

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-bold text-[#111827]">
                {activeTab} Details
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Complete analytics based
                on selected report filters.
              </p>

            </div>

            <button className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100">

              <FileText size={18} />

              Generate PDF

            </button>

          </div>

          {/* CSR TABLE */}
          {activeTab ===
            "CSR Performance" && (
            <table className="w-full min-w-[900px]">

              <thead>

                <tr className="border-b border-gray-100 text-left">

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    CSR
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Calls
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Orders
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Conversion
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Avg Time
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Status
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {(currentData.csr as {
                  name: string;
                  calls: number;
                  orders: number;
                  conversion: string;
                  avgTime: string;
                  status: string;
                }[])
                  .filter((item) =>
                    item.name
                      .toLowerCase()
                      .includes(
                        search.toLowerCase()
                      )
                  )
                  .map(
                    (
                      item,
                      i: number
                    ) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50"
                      >

                        <td className="py-5 font-semibold text-[#111827]">
                          {item.name}
                        </td>

                        <td className="py-5">
                          {item.calls}
                        </td>

                        <td className="py-5">
                          {item.orders}
                        </td>

                        <td className="py-5">

                          <span className="rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-[#B8112D]">
                            {
                              item.conversion
                            }
                          </span>

                        </td>

                        <td className="py-5">
                          {item.avgTime}
                        </td>

                        <td className="py-5">

                          <span className="rounded-full bg-green-100 px-4 py-2 text-xs font-semibold text-green-700">
                            {item.status}
                          </span>

                        </td>

                        <td className="py-5">

                          <button className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100">
                            View
                          </button>

                        </td>

                      </tr>
                    )
                  )}

              </tbody>

            </table>
          )}

        </div>

      </main>

    </div>
  );
}