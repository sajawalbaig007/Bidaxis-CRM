"use client";

import {
  useMemo,
  useState,
  useEffect,
} from "react";

import jsPDF from "jspdf";

import autoTable from "jspdf-autotable";

import API from "./../../../lib/api";

import DashboardNavbar from "../components/Navbar";
import DashboardSidebar from "../components/Sidebar";

import {
  PhoneCall,
  ShoppingCart,
  CalendarDays,
  Search,
  Clock3,
  FileBarChart2,
  TrendingUp,
  Target,
  Database,
  ChevronDown,
  Activity,
  Trophy,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
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
   TYPES
========================================= */

type CSRPerformance = {
  name: string;
  totalLeads: number;
  completed: number;
  pending: number;
  important: number;
};

type ReportFile = {
  id: string;
  reportName: string;
  reportUrl: string;
  reportType: string;
  generatedBy: string;
  createdAt: string;
};

type ReportResponse = {
  totalLeads: number;
  completed: number;
  pending: number;
  important: number;
  interested: number;
  csrPerformance: CSRPerformance[];
  reports: ReportFile[];
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

  const [reportData, setReportData] =
    useState<ReportResponse | null>(
      null
    );

  /* FETCH REPORTS */

  useEffect(() => {

    const fetchReports =
      async () => {

        try {

          const res =
            await API.get(
              "/reports"
            );

          setReportData(
            res.data
          );

        } catch (error) {

          console.log(error);
        }
      };

    fetchReports();

  }, []);

  /* =========================================
     GENERATE PDF
     FIX: Build the PDF entirely in memory
     first, then open a local blob URL
     synchronously (never blocked by popup
     blockers). Upload to backend in the
     background after the tab is already open.
  ========================================= */

  const generatePDF =
    async () => {

      try {

        /* BUILD PDF */

        const doc =
          new jsPDF();

        doc.setFontSize(20);

        doc.text(
          "CSR Performance Report",
          14,
          20
        );

        autoTable(doc, {

          startY: 35,

          head: [[
            "CSR",
            "Total Leads",
            "Completed",
            "Pending",
            "Important",
          ]],

          body:
            (
              reportData
                ?.csrPerformance ||
              []
            ).map(
              (item) => [
                item.name,
                item.totalLeads,
                item.completed,
                item.pending,
                item.important,
              ]
            ),
        });

        /* ===============================
           OPEN LOCAL BLOB IN NEW TAB
           This is synchronous — no await
           before it — so browsers never
           treat it as a blocked popup.
           The user sees the PDF instantly
           without waiting for the upload.
        =============================== */

        const pdfBlob =
          doc.output("blob");

        const localUrl =
          URL.createObjectURL(pdfBlob);

        window.open(localUrl, "_blank");

        /* ===============================
           UPLOAD TO BACKEND IN BACKGROUND
        =============================== */

        const file =
          new Blob(
            [pdfBlob],
            { type: "application/pdf" }
          );

        const formData =
          new FormData();

        formData.append(
          "file",
          file,
          `report-${Date.now()}.pdf`
        );

        await API.post(
          "/report-uploads",
          formData,
          {
            headers: {
              "Content-Type":
                "multipart/form-data",
            },
          }
        );

        /* REFRESH REPORTS */

        const updated =
          await API.get("/reports");

        setReportData(updated.data);

        /* RELEASE LOCAL BLOB URL */

        URL.revokeObjectURL(localUrl);

        alert("PDF generated successfully");

      } catch (error) {

        console.log(error);

        alert("Failed to generate PDF");
      }
    };

  /* =========================================
     HANDLE DELETE REPORT
  ========================================= */

  const handleDeleteReport =
    async (id: string) => {

      if (
        !window.confirm(
          "Are you sure you want to delete this report?"
        )
      )
        return;

      try {

        await API.delete(
          `/report-uploads/${id}`
        );

        setReportData((prev) => {

          if (!prev) return prev;

          return {
            ...prev,
            reports:
              prev.reports.filter(
                (r) => r.id !== id
              ),
          };
        });

      } catch (error) {

        console.log(error);

        alert("Failed to delete report");
      }
    };

  /* CHART DATA */

  const callsChart =
    useMemo(() => {

      if (
        !reportData?.csrPerformance
      )
        return [];

      return reportData.csrPerformance.map(
        (item) => ({
          day: item.name,
          calls:
            item.totalLeads,
        })
      );

    }, [reportData]);

  const ordersChart =
    useMemo(() => {

      if (
        !reportData?.csrPerformance
      )
        return [];

      return reportData.csrPerformance.map(
        (item) => ({
          day: item.name,
          orders:
            item.completed,
        })
      );

    }, [reportData]);

  const leadsChart =
    useMemo(() => {

      if (
        !reportData?.csrPerformance
      )
        return [];

      return reportData.csrPerformance.map(
        (item) => ({
          state: item.name,
          leads:
            item.totalLeads,
        })
      );

    }, [reportData]);

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
                  setSearch(
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

                ${activeTab === tab
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

          {/* TOTAL LEADS */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Total Leads
                </p>

                <h2 className="mt-2 text-3xl font-bold text-[#111827]">
                  {reportData?.totalLeads || 0}
                </h2>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#B8112D]">
                <PhoneCall size={28} />
              </div>

            </div>

          </div>

          {/* COMPLETED */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Completed
                </p>

                <h2 className="mt-2 text-3xl font-bold text-[#111827]">
                  {reportData?.completed || 0}
                </h2>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-600">
                <ShoppingCart size={28} />
              </div>

            </div>

          </div>

          {/* PENDING */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Pending
                </p>

                <h2 className="mt-2 text-3xl font-bold text-[#111827]">
                  {reportData?.pending || 0}
                </h2>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-50 text-yellow-600">
                <Clock3 size={28} />
              </div>

            </div>

          </div>

          {/* IMPORTANT */}
          <div className="rounded-[28px] bg-white p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-500">
                  Important
                </p>

                <h2 className="mt-2 text-3xl font-bold text-[#111827]">
                  {reportData?.important || 0}
                </h2>

              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <AlertTriangle size={28} />
              </div>

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

            </div>

            <div className="h-[340px]">

              {activeTab ===
                "CSR Performance" ? (

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <BarChart
                    data={callsChart}
                  >

                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="day" />

                    <Tooltip />

                    <Bar
                      dataKey="calls"
                      fill="#B8112D"
                      radius={[
                        10,
                        10,
                        0,
                        0,
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
                    data={ordersChart}
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

              ) : (

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <AreaChart
                    data={leadsChart}
                  >

                    <CartesianGrid strokeDasharray="3 3" />

                    <XAxis dataKey="state" />

                    <Tooltip />

                    <Area
                      type="monotone"
                      dataKey="leads"
                      stroke="#B8112D"
                      fill="#FEE2E2"
                      strokeWidth={4}
                    />

                  </AreaChart>

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
                    Interested Leads
                  </h3>

                  <p className="text-sm text-gray-500">
                    {reportData?.interested || 0}
                    {" "}Interested
                  </p>

                </div>

              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4">

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] text-white">
                  <Database size={22} />
                </div>

                <div>

                  <h3 className="font-semibold text-[#111827]">
                    Total Leads
                  </h3>

                  <p className="text-sm text-gray-500">
                    {reportData?.totalLeads || 0}
                    {" "}Distributed
                  </p>

                </div>

              </div>

            </div>

          </div>

        </div>

        {/* =========================================
            CSR PERFORMANCE TABLE
        ========================================= */}

        <div className="mt-6 overflow-x-auto rounded-[28px] bg-white p-5 shadow-sm">

          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-xl font-bold text-[#111827]">
                CSR Performance Details
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Complete analytics based
                on selected report filters.
              </p>

            </div>

            <button
              onClick={generatePDF}
              className="
                flex
                items-center
                gap-2
                rounded-2xl
                border
                border-gray-200
                bg-white
                px-5
                py-3
                text-sm
                font-medium
                text-gray-600
                transition-all
                hover:bg-gray-100
              "
            >

              <FileText size={18} />

              Generate PDF

            </button>

          </div>

          <table className="w-full min-w-[900px]">

            <thead>

              <tr className="border-b border-gray-100 text-left">

                <th className="pb-4 text-sm font-semibold text-gray-500">
                  CSR
                </th>

                <th className="pb-4 text-sm font-semibold text-gray-500">
                  Total Leads
                </th>

                <th className="pb-4 text-sm font-semibold text-gray-500">
                  Completed
                </th>

                <th className="pb-4 text-sm font-semibold text-gray-500">
                  Pending
                </th>

                <th className="pb-4 text-sm font-semibold text-gray-500">
                  Important
                </th>

              </tr>

            </thead>

            <tbody>

              {(reportData?.csrPerformance || [])
                .filter((item) =>
                  item.name
                    .toLowerCase()
                    .includes(
                      search.toLowerCase()
                    )
                )
                .map(
                  (item, i) => (

                    <tr
                      key={i}
                      className="border-b border-gray-50"
                    >

                      <td className="py-5 font-semibold text-[#111827]">
                        {item.name}
                      </td>

                      <td className="py-5">
                        {item.totalLeads}
                      </td>

                      <td className="py-5">
                        {item.completed}
                      </td>

                      <td className="py-5">
                        {item.pending}
                      </td>

                      <td className="py-5">
                        {item.important}
                      </td>

                    </tr>
                  )
                )}

            </tbody>

          </table>

        </div>

        {/* =========================================
            GENERATED REPORTS TABLE
        ========================================= */}

        <div className="mt-6 rounded-[28px] bg-white p-5 shadow-sm">

          <div className="mb-6">

            <h2 className="text-xl font-bold text-[#111827]">
              Generated Reports
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Uploaded PDF & Excel reports
            </p>

          </div>

          <div className="overflow-x-auto">

            <table className="w-full min-w-[900px]">

              <thead>

                <tr className="border-b border-gray-100 text-left">

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Report Name
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Type
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Generated By
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Date
                  </th>

                  <th className="pb-4 text-sm font-semibold text-gray-500">
                    Action
                  </th>

                </tr>

              </thead>

              <tbody>

                {(reportData?.reports || [])
                  .map((report) => (

                    <tr
                      key={report.id}
                      className="border-b border-gray-50"
                    >

                      <td className="py-5 font-semibold text-[#111827]">
                        {report.reportName}
                      </td>

                      <td className="py-5">
                        {report.reportType}
                      </td>

                      <td className="py-5">
                        {report.generatedBy}
                      </td>

                      <td className="py-5">

                        {new Date(
                          report.createdAt
                        ).toLocaleDateString()}

                      </td>

                      <td className="py-5">

  <div className="flex items-center gap-3">

    {/* VIEW PDF */}

    <button
      onClick={async () => {

  try {

    const response =
      await fetch(
        report.reportUrl
      );

    const blob =
      await response.blob();

    /* FORCE PDF MIME TYPE */

    const pdfBlob =
      new Blob(
        [blob],
        {
          type:
            "application/pdf",
        }
      );

    const url =
      URL.createObjectURL(
        pdfBlob
      );

    /* OPEN PDF */

    window.open(
      url,
      "_blank"
    );

  } catch (error) {

    console.log(error);

    alert(
      "Failed to open PDF"
    );
  }
}}
      className="
        rounded-xl
        bg-[#B8112D]
        px-4
        py-2
        text-sm
        font-medium
        text-white
      "
    >
      View
    </button>

    {/* DELETE */}

    <button
      onClick={() =>
        handleDeleteReport(
          report.id
        )
      }
      className="
        rounded-xl
        bg-red-100
        px-4
        py-2
        text-sm
        font-medium
        text-[#B8112D]
        transition-all
        hover:bg-[#B8112D]
        hover:text-white
      "
    >
      Delete
    </button>

  </div>

</td>

                    </tr>
                  ))}

              </tbody>

            </table>

          </div>

        </div>

      </main>

    </div>
  );
}