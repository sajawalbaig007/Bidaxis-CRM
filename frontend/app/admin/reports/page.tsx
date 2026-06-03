"use client";

import { useMemo, useState, useEffect } from "react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import API from "./../../../lib/api";
import DashboardNavbar  from "../components/Navbar";
import DashboardSidebar from "../components/Sidebar";

import {
  PhoneCall, ShoppingCart, CalendarDays, Search, Clock3,
  FileBarChart2, TrendingUp, Database, ChevronDown,
  AlertTriangle, Wifi, FileText,
} from "lucide-react";

import {
  ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, CartesianGrid,
} from "recharts";

/* ── jspdf-autotable type ── */
declare module "jspdf" {
  interface jsPDF { lastAutoTable: { finalY: number }; }
}

/* ── Types ── */
const reportTabs = ["CSR Performance"];

type CSRPerformance = {
  id: string;      // = csrId, used for /admin/csr-history/:id calls
  csrId: string;
  name: string;
  totalLeads: number;
  completed: number;
  pending: number;
  important: number;
};

type LeadHistory = {
  id: string; name?: string; company?: string; phone?: string;
  email?: string; status?: string; nextSchedule?: string;
  interestedService?: string; followUpNotes?: string;
  comments?: string;                                    // ← CSR comments
  uploadFile?: { companyName?: string | null };
  state?: string;
};

type ReportFile = {
  id: string; reportName: string; reportUrl: string;
  reportType: string; generatedBy: string; createdAt: string;
};

type ReportResponse = {
  period: string;
  totalLeads: number; completed: number; pending: number;
  important: number; interested: number;
  csrPerformance: CSRPerformance[];
  timeChart: { label: string; leads: number; completed: number }[];
  reports: ReportFile[];
};

/* ── Download helper ── */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/* ── Extract US state abbreviation from address/company strings ── */
const US_STATES: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",
  CO:"Colorado",CT:"Connecticut",DE:"Delaware",FL:"Florida",GA:"Georgia",
  HI:"Hawaii",ID:"Idaho",IL:"Illinois",IN:"Indiana",IA:"Iowa",KS:"Kansas",
  KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",MA:"Massachusetts",
  MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",
  NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",
  NY:"New York",NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",
  OR:"Oregon",PA:"Pennsylvania",RI:"Rhode Island",SC:"South Carolina",
  SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",VT:"Vermont",
  VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

function extractState(text?: string): string {
  if (!text) return "-";
  const upper = text.toUpperCase();
  for (const abbr of Object.keys(US_STATES)) {
    const pattern = new RegExp(`\\b${abbr}\\b`);
    if (pattern.test(upper)) return abbr;
  }
  return "-";
}

export default function ReportsPage() {
  const [activeTab,    setActiveTab]    = useState("CSR Performance");
  const [search,       setSearch]       = useState("");
 
  const [reportData,   setReportData]   = useState<ReportResponse | null>(null);
  const [downloading,  setDownloading]  = useState<string | null>(null);
  const [activePeriod, setActivePeriod] = useState<"today" | "week" | "month" | "all">("today");
  const [loadingReport,setLoadingReport]= useState(false);
  const [fromDate, setFromDate] = useState("");
const [toDate, setToDate] = useState("");
  /* FETCH — ESLint-safe: async defined inside effect */
  const fetchReports = async (
  period: string = "today",
  customFromDate?: string,
  customToDate?: string
) => {
  try {
    setLoadingReport(true);

    let url = `/reports?period=${period}`;

    if (customFromDate && customToDate) {
      url = `/reports?fromDate=${customFromDate}&toDate=${customToDate}`;
    }

    const res = await API.get(url);
    setReportData(res.data);
  } catch (err) {
    console.log(err);
  } finally {
    setLoadingReport(false);
  }
};

  useEffect(() => {
    const load = async () => { await fetchReports("today"); };
    load();
  }, []);

  /* GENERATE MASTER PDF */
  const generatePDF = async () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text("CSR Performance Report", 14, 20);
      doc.setFontSize(11);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

      autoTable(doc, {
        startY: 40,
        head: [["CSR","Total Leads","Completed","Pending","Important"]],
        body: (reportData?.csrPerformance || []).map(i => [
          i.name, i.totalLeads, i.completed, i.pending, i.important,
        ]),
        headStyles: { fillColor: [184,17,45] },
      });

      downloadBlob(doc.output("blob"), `CSR-Performance-${Date.now()}.pdf`);

      /* Upload silently */
      const formData = new FormData();
      formData.append("file", doc.output("blob"), `report-${Date.now()}.pdf`);
      API.post("/report-uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
        .then(() => API.get("/reports"))
        .then(r => setReportData(r.data))
        .catch(err => console.log("Upload skipped:", err));
    } catch (err) { console.log(err); }
  };

  /* GENERATE CSR PDF — beautiful format */
  const generateCSRPDF = async (item: CSRPerformance) => {
    if (downloading) return;
    setDownloading(item.id);
    try {
      const doc = new jsPDF("landscape");
      const pageW = doc.internal.pageSize.getWidth();

      /* ── COVER HEADER ── */
      // Red header bar
      doc.setFillColor(184, 17, 45);
      doc.rect(0, 0, pageW, 38, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("CSR Performance Report", 14, 16);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`CSR: ${item.name}`, 14, 26);
      doc.text(`Period: ${activePeriod === "today" ? "Today" : activePeriod === "week" ? "Last 7 Days" : activePeriod === "month" ? "Last 30 Days" : "All Time"}`, 14, 33);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40);

      // Right side — company branding
      doc.setFontSize(9);
      doc.text("CRM Dashboard", pageW - 14, 22, { align: "right" });
      doc.text("Confidential Report", pageW - 14, 29, { align: "right" });

      /* ── SUMMARY STATS BAR ── */
      doc.setFillColor(245, 246, 250);
      doc.rect(0, 42, pageW, 22, "F");

      const stats = [
        { label: "Total Leads", value: String(item.totalLeads), color: [184, 17, 45] as [number,number,number] },
        { label: "Completed",   value: String(item.completed),  color: [2, 122, 72]  as [number,number,number] },
        { label: "Pending",     value: String(item.pending),    color: [181, 71, 8]  as [number,number,number] },
        { label: "Important",   value: String(item.important),  color: [180, 35, 24] as [number,number,number] },
      ];

      const colW = pageW / stats.length;
      stats.forEach((s, i) => {
        const x = colW * i + colW / 2;
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...s.color);
        doc.text(s.value, x, 52, { align: "center" });
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(s.label, x, 59, { align: "center" });
      });

      /* ── LEADS TABLE — exclude pending & not completed ── */
      let leads: LeadHistory[] = [];
      try {
        const res = await API.get(`/admin/csr-history/${item.id}`);
        const allLeads: LeadHistory[] = Array.isArray(res.data)
          ? res.data
          : (res.data?.leads ?? []);

        /* Show only actionable statuses */
        leads = allLeads.filter(l => {
          const s = (l.status ?? "").toLowerCase();
          return s !== "pending" && s !== "not completed" && s !== "";
        });
      } catch {
        console.log("Lead history not available");
      }

      if (leads.length > 0) {
        doc.setTextColor(17, 24, 39);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Lead Details", 14, 74);

        autoTable(doc, {
          startY: 78,
          head: [[
            "#",
            "Client / Address",
            "Company",
            "Phone",
            "Email",
            "Status",
            "Schedule",
            "Comments",
            "State",
          ]],
          body: leads.map((l, idx) => [
            idx + 1,
            `${l.name || "-"}\n${l.company || ""}`.trim(),
            l.uploadFile?.companyName || "-",
            l.phone || "-",
            l.email || "-",
            (l.status || "-").toUpperCase(),
            l.nextSchedule || "-",
            l.comments || "-",                          // ← CSR comment
            l.state || extractState(l.company) || "-",
          ]),
          styles: {
            fontSize: 8,
            cellPadding: 4,
            overflow: "linebreak",
            textColor: [30, 30, 30],
          },
          headStyles: {
            fillColor: [17, 24, 39],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8,
            cellPadding: 5,
          },
          alternateRowStyles: {
            fillColor: [248, 249, 252],
          },
          columnStyles: {
            0: { cellWidth: 7,  halign: "center" },
            1: { cellWidth: 42 },   /* Client / Address */
            2: { cellWidth: 24 },   /* Company */
            3: { cellWidth: 24 },   /* Phone */
            4: { cellWidth: 38 },   /* Email */
            5: { cellWidth: 24, halign: "center" },   /* Status */
            6: { cellWidth: 22, halign: "center" },   /* Schedule */
            7: { cellWidth: 38 },   /* Comments */
            8: { cellWidth: 16, halign: "center" },   /* State */
          },
          /* FIX: use didParseCell — sets color BEFORE drawing, no double text */
          didParseCell: (data) => {
            if (data.column.index === 5 && data.section === "body") {
              const status = String(data.cell.raw || "").toLowerCase();
              const colors: Record<string, [number,number,number]> = {
                "completed":      [2,   122, 72],
                "pending":        [181, 71,  8],
                "important":      [184, 17,  45],
                "interested":     [217, 119, 6],
                "project won":    [6,   95,  70],
                "not completed":  [181, 71,  8],
                "closed":         [80,  80,  80],
              };
              const color = colors[status] ?? [80, 80, 80];
              data.cell.styles.textColor  = color;
              data.cell.styles.fontStyle  = "bold";
            }
          },
        });
      } else {
        doc.setTextColor(100, 100, 100);
        doc.setFontSize(10);
        doc.text("No lead history available for this CSR.", 14, 80);
      }

      /* ── FOOTER on every page ── */
      const pages = doc.getNumberOfPages();
      for (let p = 1; p <= pages; p++) {
        doc.setPage(p);
        const pageH = doc.internal.pageSize.getHeight();

        doc.setFillColor(245, 246, 250);
        doc.rect(0, pageH - 12, pageW, 12, "F");

        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${p} of ${pages}`, pageW / 2, pageH - 4.5, { align: "center" });
        doc.text("Confidential — CRM Dashboard", 14, pageH - 4.5);
        doc.text(new Date().toLocaleDateString(), pageW - 14, pageH - 4.5, { align: "right" });
      }

      downloadBlob(
        doc.output("blob"),
        `${item.name.replace(/\s+/g, "-")}-report.pdf`
      );
    } catch (err) {
      console.log(err);
    } finally {
      setDownloading(null);
    }
  };

  /* DELETE REPORT */
  /* CHART DATA */
  const isFiltered = activePeriod !== "all";

  const callsChart = useMemo(() => {
    if (isFiltered && reportData?.timeChart?.length) {
      return reportData.timeChart.map(t => ({ day: t.label, calls: t.leads }));
    }
    return (reportData?.csrPerformance || []).map(i => ({ day: i.name, calls: i.totalLeads }));
  }, [reportData, isFiltered]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F5F6FA]">
      <DashboardSidebar/>

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6 mt-18 lg:mt-0">
        <DashboardNavbar/>

        {/* HEADER */}
        <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#B8112D] text-white">
              <FileBarChart2 size={20}/>
            </div>
            <div>
              <h1 className="text-[32px] font-bold text-[#111827]">Reports & Analytics</h1>
              <p className="mt-1 text-sm text-gray-500">Analyze calls, orders, CSR performance and lead activity.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap">
 

  <input
    type="date"
    value={fromDate}
    onChange={(e) => setFromDate(e.target.value)}
    className="h-12.5 rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D]"
  />

  <input
    type="date"
    value={toDate}
    onChange={(e) => setToDate(e.target.value)}
    className="h-12.5 rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-[#B8112D]"
  />

  <button
    onClick={() => {
      if (!fromDate || !toDate) return alert("Please select both dates");
      setActivePeriod("all");
      fetchReports("all", fromDate, toDate);
    }}
    className="h-12.5 rounded-2xl bg-[#B8112D] px-6 text-sm font-semibold text-white hover:bg-[#a30f27]"
  >
    Filter
  </button>

  <button
    onClick={() => {
      setFromDate("");
      setToDate("");
      setActivePeriod("today");
      fetchReports("today");
    }}
    className="h-12.5 rounded-2xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-600 hover:bg-gray-100"
  >
    Reset
  </button>
</div>
        </div>

        {/* LIVE STATUS */}
        <div className="mt-6 rounded-[28px] border border-red-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-3">
                <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100">
                  <Wifi size={22} className="text-green-600"/>
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-green-500 animate-ping"/>
                </div>
                <div>
                  <h3 className="font-semibold text-[#111827]">Live Stats — Current Links</h3>
                  <p className="text-sm text-gray-500">Stats above reflect active links only · Historical reports saved below ↓</p>
                </div>
              </div>
              <div className="h-12 w-px bg-gray-200 hidden lg:block"/>
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <h4 className="mt-1 font-semibold text-[#111827]">Just Now</h4>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {([
                { key:"today", label:"Today"   },
                { key:"week",  label:"7 Days"  },
                { key:"month", label:"30 Days" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setActivePeriod(key);
                    fetchReports(key);
                  }}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition-all ${
                    activePeriod === key
                      ? "bg-[#B8112D] text-white shadow-sm"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-100"
                  }`}>
                  {loadingReport && activePeriod === key ? "Loading..." : label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TABS */}
        <div className="mt-6 flex flex-wrap gap-3">
          {reportTabs.map((tab, i) => (
            <button key={i} onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-5 py-3 text-sm font-semibold transition-all ${
                activeTab === tab ? "bg-[#B8112D] text-white shadow-sm" : "bg-white text-gray-500 hover:bg-gray-100"
              }`}>
              {tab}
            </button>
          ))}
        </div>

        {/* STATS */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label:"Total Leads", value: reportData?.totalLeads || 0, icon:<PhoneCall size={28}/>,    bg:"bg-red-50",    color:"text-[#B8112D]" },
            { label:"Completed",   value: reportData?.completed   || 0, icon:<ShoppingCart size={28}/>, bg:"bg-green-50",  color:"text-green-600" },
            { label:"Pending",     value: reportData?.pending     || 0, icon:<Clock3 size={28}/>,       bg:"bg-yellow-50", color:"text-yellow-600" },
            { label:"Important",   value: reportData?.important   || 0, icon:<AlertTriangle size={28}/>,bg:"bg-red-50",    color:"text-red-600"  },
          ].map((c, i) => (
            <div key={i} className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{c.label}</p>
                  <h2 className="mt-2 text-3xl font-bold text-[#111827]">{c.value}</h2>
                </div>
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${c.bg} ${c.color}`}>{c.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CHARTS */}
        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="xl:col-span-8 rounded-[28px] bg-white p-5 shadow-sm">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#111827]">{activeTab}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {activePeriod === "today" ? "Today's breakdown by hour" :
                   activePeriod === "week"  ? "Last 7 days — daily breakdown" :
                   activePeriod === "month" ? "Last 30 days — weekly breakdown" :
                   "All time — by CSR"}
                </p>
              </div>
              {loadingReport && (
                <div className="w-5 h-5 border-2 border-[#B8112D] border-t-transparent rounded-full animate-spin mt-1"/>
              )}
            </div>
            <div className="h-85">
              {callsChart.length === 0 || callsChart.every(d => d.calls === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Database size={40} className="text-gray-200 mb-3"/>
                  <h3 className="font-semibold text-gray-400">No data for this period</h3>
                  <p className="text-sm text-gray-300 mt-1">
                    {activePeriod === "today"  ? "No leads were created today yet." :
                     activePeriod === "week"   ? "No leads in the last 7 days." :
                     activePeriod === "month"  ? "No leads in the last 30 days." :
                     "No leads found."}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callsChart}>
                    <CartesianGrid strokeDasharray="3 3"/>
                    <XAxis dataKey="day" tick={{ fontSize: 11 }}/>
                    <Tooltip formatter={(v) => [`${v} leads`, "Leads"]}/>
                    <Bar dataKey="calls" fill="#B8112D" radius={[8,8,0,0]} name="Leads"/>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="xl:col-span-4 rounded-[28px] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#111827]">Quick Insights</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {activePeriod === "today" ? "Today" : activePeriod === "week" ? "Last 7 days" : activePeriod === "month" ? "Last 30 days" : "All time"}
                </p>
              </div>
              <FileBarChart2 className="text-[#B8112D]"/>
            </div>

            {reportData?.totalLeads === 0 ? (
              <div className="mt-10 text-center">
                <Database size={36} className="text-gray-200 mx-auto mb-3"/>
                <p className="text-sm text-gray-400 font-medium">No data for this period</p>
                <p className="text-xs text-gray-300 mt-1">Try selecting a different time range</p>
              </div>
            ) : (
              <div className="mt-7 space-y-4">
                {[
                  { label:"Total Leads",   value: reportData?.totalLeads || 0, bg:"bg-red-50",    color:"text-[#B8112D]", icon:<TrendingUp size={18}/> },
                  { label:"Completed",     value: reportData?.completed   || 0, bg:"bg-green-50",  color:"text-green-600", icon:<ShoppingCart size={18}/> },
                  { label:"Interested",    value: reportData?.interested  || 0, bg:"bg-orange-50", color:"text-orange-600",icon:<Database size={18}/> },
                  { label:"Important",     value: reportData?.important   || 0, bg:"bg-red-50",    color:"text-red-600",  icon:<AlertTriangle size={18}/> },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} ${s.color} shrink-0`}>{s.icon}</div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">{s.label}</p>
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CSR PERFORMANCE TABLE */}
        <div className="mt-6 overflow-x-auto rounded-[28px] bg-white p-5 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#111827]">CSR Performance Details</h2>
              <p className="mt-1 text-sm text-gray-500">Download individual CSR reports with full lead details.</p>
            </div>
            <button onClick={generatePDF}
              className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-all">
              <FileText size={18}/>Generate PDF
            </button>
          </div>

          <table className="w-full min-w-175">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                {["CSR","Total Leads","Completed","Pending","Important","Action"].map(h => (
                  <th key={h} className="pb-4 text-sm font-semibold text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(reportData?.csrPerformance || [])
                .filter(item => item.name.toLowerCase().includes(search.toLowerCase()))
                .map(item => (
                  <tr key={item.id} className="border-b border-gray-50 hover:bg-[#FAFAFA] transition-all">
                    <td className="py-5 font-semibold text-[#111827]">{item.name}</td>
                    <td className="py-5 text-[#111827]">{item.totalLeads}</td>
                    <td className="py-5 text-[#111827]">{item.completed}</td>
                    <td className="py-5 text-[#111827]">{item.pending}</td>
                    <td className="py-5 text-[#111827]">{item.important}</td>
                    <td className="py-5">
                      <button
                        onClick={() => generateCSRPDF(item)}
                        disabled={downloading === item.id}
                        className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all ${
                          downloading === item.id ? "bg-gray-300 cursor-not-allowed" : "bg-[#111827] hover:bg-black"
                        }`}>
                        {downloading === item.id ? (
                          <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"/>Generating...</>
                        ) : "Download PDF"}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>


      </main>
    </div>
  );
}