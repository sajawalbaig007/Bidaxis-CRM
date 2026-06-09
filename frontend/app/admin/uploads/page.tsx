"use client";

import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  UploadCloud, FileText, Trash2, CheckCircle2, Search, Users,
  Database, FileSpreadsheet, FileImage, FileArchive, FileBadge,
  Loader2, X, Building2, ChevronDown, RefreshCw, RotateCcw,
  PhoneCall,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar  from "../components/Navbar";
import API from "@/lib/api";

/* ── Types ── */
type UploadFile = {
  id: number; name: string; size: string; type: string;
  progress: number; leads: number; distributed: boolean;
  status: "Uploading" | "Processing" | "Distributed";
  companyName: string;
};

type CSRDistribution = { name: string; leads: number };

type CSR = { id: string; name: string; email: string; isActive: boolean };

/* ── Predefined companies (admin can add more) ── */
const PRESET_COMPANIES = ["PS Estimating", "Devcon", "Other"];

const getFileIcon = (type: string) => {
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv"))
    return <FileSpreadsheet size={24} className="text-green-600"/>;
  if (type.includes("image"))
    return <FileImage size={24} className="text-blue-600"/>;
  if (type.includes("zip") || type.includes("rar"))
    return <FileArchive size={24} className="text-yellow-600"/>;
  return <FileBadge size={24} className="text-[#B8112D]"/>;
};

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [dragging,             setDragging]             = useState(false);
  const [search,               setSearch]               = useState("");
  const [files,                setFiles]                = useState<UploadFile[]>([]);
  const [latestDistribution,   setLatestDistribution]   = useState<CSRDistribution[]>([]);
  const [latestTotalLeads,     setLatestTotalLeads]     = useState(0);

  /* Modal state */
  const [showCSRModal,   setShowCSRModal]   = useState(false);
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [csrs,           setCsrs]           = useState<CSR[]>([]);
  const [selectedCSRs,   setSelectedCSRs]   = useState<string[]>([]);

  /* Company state */
  const [selectedCompany, setSelectedCompany] = useState("");
  const [customCompany,   setCustomCompany]   = useState("");
  const [modalStep,       setModalStep]       = useState<"reset" | "company" | "pane" | "csrs">("reset");
  const [resetMode,       setResetMode]       = useState<"keep" | "reset" | null>(null);

  /* Pane selection */
  const [selectedPane,     setSelectedPane]     = useState<"pending" | "lead">("pending");
  const [selectedLeadType, setSelectedLeadType] = useState<"new" | "old">("new");

  /* FETCH */
  const fetchCSRs = async () => {
    try {
      const res = await API.get("/admin/csrs");
      setCsrs(res.data.csrs);
    } catch { toast.error("Failed to fetch CSRs"); }
  };

  const fetchLatestUpload = async () => {
    try {
      const res = await API.get("/uploads/latest");
      if (res.data.file) {
        setLatestDistribution(res.data.file.distribution);
        setLatestTotalLeads(res.data.file.totalLeads);
      }
    } catch (err) { console.log(err); }
  };

  useEffect(() => {
    const load = async () => {
      await fetchLatestUpload();
      await fetchCSRs();
    };
    load();
  }, []);

  /* Open modal */
  const openCSRModal = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    setSelectedFile(selectedFiles[0]);
    setSelectedCompany("");
    setCustomCompany("");
    setResetMode(null);
    setSelectedPane("pending");
    setSelectedLeadType("new");
    setModalStep("reset");
    const activeCSRIds = csrs.filter(c => c.isActive).map(c => c.id);
    setSelectedCSRs(activeCSRIds);
    setShowCSRModal(true);
  };

  const finalCompany = selectedCompany === "Other" ? customCompany : selectedCompany;

  /* UPLOAD */
  const handleFiles = async () => {
    if (!selectedFile) return;
    if (!finalCompany.trim()) { toast.error("Please enter company name"); return; }
    if (selectedCSRs.length === 0) { toast.error("Select at least one CSR"); return; }

    setShowCSRModal(false);
    const tempId = Date.now();

    setFiles(prev => [{
      id: tempId, name: selectedFile.name,
      size: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
      type: selectedFile.type, progress: 0, leads: 0,
      distributed: false, status: "Uploading",
      companyName: finalCompany.trim(),
    }, ...prev]);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("selectedCSRs", JSON.stringify(selectedCSRs));
      formData.append("companyName", finalCompany.trim());
      formData.append("resetMode",       resetMode ?? "keep");
      formData.append("initialStatuses", JSON.stringify([selectedPane]));
      formData.append("leadType",        selectedLeadType);

      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setFiles(prev => prev.map(f =>
          f.id === tempId ? { ...f, progress: progress >= 90 ? 90 : progress } : f
        ));
      }, 200);

      const res = await API.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(interval);
      setFiles(prev => prev.map(f =>
        f.id === tempId
          ? { ...f, progress: 100, leads: res.data.totalLeads, distributed: true, status: "Distributed" }
          : f
      ));

      const created = res.data.totalLeads as number;
      if (created === 0) {
        toast.error(`No new leads added — all rows were duplicates already in the system.`);
      } else {
        toast.success(`${created} leads uploaded & distributed to CSRs for ${finalCompany.trim()}`);
      }
      fetchLatestUpload();
    } catch {
      setFiles(prev => prev.filter(f => f.id !== tempId));
      toast.error("Upload failed");
    }
  };

  const removeFile = (id: number) => setFiles(prev => prev.filter(f => f.id !== id));
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      {/* ── MODAL ── */}
      {showCSRModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-2xl font-semibold text-gray-800">
                  {modalStep === "reset"   ? "Data Mode"
                  : modalStep === "company" ? "Select Company"
                  : modalStep === "pane"    ? "Select CSR Pane"
                  : "Select CSRs"}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {modalStep === "reset"   ? "What should happen to existing lead data?"
                  : modalStep === "company" ? "Which company does this data belong to?"
                  : modalStep === "pane"    ? "Which section of the CSR dashboard should these leads appear in?"
                  : "Choose which CSRs should receive leads."}
                </p>
              </div>
              <button onClick={() => setShowCSRModal(false)}
                className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all">
                <X size={18}/>
              </button>
            </div>

            {/* Step indicators */}
            {(() => {
              const steps = ["reset","company","pane","csrs"] as const;
              const currentIdx = steps.indexOf(modalStep);
              const labels = ["Data Mode","Company","CSR Pane","CSRs"];
              return (
                <div className="flex items-center px-6 pt-4">
                  {steps.map((step, i) => {
                    const done   = i < currentIdx;
                    const active = i === currentIdx;
                    return (
                      <div key={step} className="flex items-center flex-1 last:flex-none">
                        <div className={`flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${active ? "text-[#B8112D]" : done ? "text-[#027A48]" : "text-gray-400"}`}>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            active ? "bg-[#B8112D] text-white" : done ? "bg-[#ECFDF3] text-[#027A48]" : "bg-gray-100 text-gray-400"
                          }`}>{done ? "✓" : i + 1}</span>
                          {labels[i]}
                        </div>
                        {i < steps.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-2 ${i < currentIdx ? "bg-[#027A48]" : "bg-gray-200"}`}/>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="px-6 py-5">

              {/* STEP 0 — Keep or Reset */}
              {modalStep === "reset" && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 font-medium">What should happen to existing lead data?</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setResetMode("keep")}
                      className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all text-left ${
                        resetMode === "keep"
                          ? "border-[#027A48] bg-[#ECFDF3]"
                          : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                      }`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${resetMode === "keep" ? "bg-[#027A48] text-white" : "bg-white shadow-sm text-gray-500"}`}>
                        <Database size={22}/>
                      </div>
                      <div>
                        <h4 className={`font-bold text-sm ${resetMode === "keep" ? "text-[#027A48]" : "text-gray-800"}`}>Keep Existing</h4>
                        <p className="text-xs text-gray-400 mt-1">New links will be added alongside existing data</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setResetMode("reset")}
                      className={`p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all text-left ${
                        resetMode === "reset"
                          ? "border-[#B8112D] bg-[#FFF1F3]"
                          : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                      }`}>
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${resetMode === "reset" ? "bg-[#B8112D] text-white" : "bg-white shadow-sm text-gray-500"}`}>
                        <RefreshCw size={22}/>
                      </div>
                      <div>
                        <h4 className={`font-bold text-sm ${resetMode === "reset" ? "text-[#B8112D]" : "text-gray-800"}`}>Reset Data</h4>
                        <p className="text-xs text-gray-400 mt-1">All old links will be deleted, only new ones remain</p>
                      </div>
                    </button>
                  </div>

                  {resetMode === "reset" && (
                    <div className="bg-[#FFF7E6] border border-[#F59E0B]/30 rounded-2xl p-4 flex items-start gap-3">
                      <RotateCcw size={16} className="text-[#B45309] mt-0.5 shrink-0"/>
                      <p className="text-sm text-[#92400E]"><strong>Warning:</strong> All previous lead data will be permanently deleted and replaced with new data.</p>
                    </div>
                  )}

                  <button
                    onClick={() => { if (!resetMode) { toast.error("Please select an option"); return; } setModalStep("company"); }}
                    disabled={!resetMode}
                    className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all ${
                      resetMode ? "bg-[#B8112D] text-white hover:bg-[#a30f27]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}>
                    Next — Select Company
                  </button>
                </div>
              )}

              {/* STEP 1 — Company */}
              {modalStep === "company" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {PRESET_COMPANIES.map(company => (
                      <button key={company} onClick={() => setSelectedCompany(company)}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all ${
                          selectedCompany === company
                            ? "border-[#B8112D] bg-[#FFF1F3]"
                            : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                        }`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          selectedCompany === company ? "bg-[#B8112D] text-white" : "bg-white shadow-sm text-gray-500"
                        }`}>
                          <Building2 size={22}/>
                        </div>
                        <span className={`font-semibold text-sm ${selectedCompany === company ? "text-[#B8112D]" : "text-gray-700"}`}>
                          {company}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Custom company input */}
                  {selectedCompany === "Other" && (
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-2">Company Name</label>
                      <input type="text" value={customCompany}
                        onChange={e => setCustomCompany(e.target.value)}
                        placeholder="Enter company name..."
                        className="w-full h-12 rounded-2xl border border-gray-200 px-4 outline-none focus:border-[#B8112D] text-sm"/>
                    </div>
                  )}

                  {/* Selected file info */}
                  {selectedFile && (
                    <div className="bg-[#FAFAFA] rounded-2xl p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                        <FileSpreadsheet size={18} className="text-green-600"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#111827] text-sm truncate">{selectedFile.name}</p>
                        <p className="text-gray-400 text-xs">{(selectedFile.size / (1024*1024)).toFixed(2)} MB</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setModalStep("reset")} className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all">Back</button>
                    <button
                      onClick={() => {
                        if (!finalCompany.trim()) { toast.error("Please select or enter a company name"); return; }
                        setModalStep("pane");
                      }}
                      disabled={!selectedCompany || (selectedCompany === "Other" && !customCompany.trim())}
                      className={`w-full h-12 rounded-2xl font-semibold text-sm transition-all ${
                        selectedCompany && (selectedCompany !== "Other" || customCompany.trim())
                          ? "bg-[#B8112D] text-white hover:bg-[#a30f27]"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}>
                      Next — Select Pane <ChevronDown size={16} className="inline ml-1 rotate-[-90deg]"/>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 — Pane */}
              {modalStep === "pane" && (
                <div className="space-y-4">
                  {/* Company badge */}
                  <div className="flex items-center gap-2 bg-[#FFF1F3] text-[#B8112D] px-4 py-2 rounded-xl w-fit text-sm font-semibold">
                    <Building2 size={15}/>{finalCompany}
                  </div>

                  {/* ── My Links / My Leads selector ── */}
                  <div className="grid grid-cols-2 gap-4">
                    {([
                      { value: "pending" as const, label: "My Links", sub: "Leads go to Today Links (daily call list)", Icon: PhoneCall, border: "border-[#0B84F3]", bg: "bg-[#EAF5FF]", iconBg: "bg-[#0B84F3]", text: "text-[#0B84F3]" },
                      { value: "lead"    as const, label: "My Leads", sub: "Previous clients & project history",       Icon: Users,    border: "border-[#7A3FFD]", bg: "bg-[#F4ECFF]", iconBg: "bg-[#7A3FFD]", text: "text-[#7A3FFD]" },
                    ]).map(opt => {
                      const sel = selectedPane === opt.value;
                      return (
                        <button key={opt.value} onClick={() => setSelectedPane(opt.value)}
                          className={`relative p-5 rounded-2xl border-2 flex flex-col items-center gap-3 transition-all text-center ${
                            sel ? `${opt.border} ${opt.bg}` : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                          }`}>
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white ${sel ? opt.iconBg : "bg-white shadow-sm"}`}>
                            <opt.Icon size={22} className={sel ? "text-white" : "text-gray-400"}/>
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${sel ? opt.text : "text-gray-800"}`}>{opt.label}</p>
                            <p className="text-[11px] text-gray-400 mt-1 leading-snug">{opt.sub}</p>
                          </div>
                          {sel && (
                            <span className={`w-5 h-5 rounded-full ${opt.iconBg} flex items-center justify-center absolute top-2.5 right-2.5`}>
                              <CheckCircle2 size={12} className="text-white"/>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* ── New / Old client sub-option (only for My Leads) ── */}
                  {selectedPane === "lead" && (
                    <div className="border border-[#7A3FFD]/20 bg-[#FDFBFF] rounded-2xl p-4 space-y-3">
                      <p className="text-sm font-semibold text-[#7A3FFD]">Upload as which client type?</p>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { value: "new" as const, label: "New Client",  sub: "First-time clients",        border: "border-[#15803D]", bg: "bg-[#F0FDF4]", text: "text-[#15803D]", dot: "bg-[#15803D]" },
                          { value: "old" as const, label: "Old Client",  sub: "Returning / repeat clients", border: "border-[#B45309]", bg: "bg-[#FFFBEB]", text: "text-[#B45309]", dot: "bg-[#B45309]" },
                        ]).map(opt => {
                          const sel = selectedLeadType === opt.value;
                          return (
                            <button key={opt.value} onClick={() => setSelectedLeadType(opt.value)}
                              className={`p-4 rounded-2xl border-2 flex flex-col gap-2 transition-all text-left ${
                                sel ? `${opt.border} ${opt.bg}` : "border-gray-100 bg-white hover:border-gray-300"
                              }`}>
                              <div className={`w-3 h-3 rounded-full ${sel ? opt.dot : "bg-gray-200"}`}/>
                              <p className={`font-bold text-sm ${sel ? opt.text : "text-gray-700"}`}>{opt.label}</p>
                              <p className="text-[11px] text-gray-400 leading-snug">{opt.sub}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setModalStep("company")}
                      className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all">Back</button>
                    <button
                      onClick={() => {
                        setModalStep("csrs");
                      }}
                      className="flex-1 h-12 rounded-2xl bg-[#B8112D] text-white font-semibold text-sm hover:bg-[#a30f27] transition-all">
                      Next — Select CSRs <ChevronDown size={16} className="inline ml-1 rotate-[-90deg]"/>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 — CSRs */}
              {modalStep === "csrs" && (
                <div className="space-y-4">
                  {/* Company + pane badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-[#FFF1F3] text-[#B8112D] px-4 py-2 rounded-xl w-fit text-sm font-semibold">
                      <Building2 size={15}/>{finalCompany}
                    </div>
                    {selectedPane === "pending" ? (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#EAF5FF] text-[#0B84F3]">My Links</span>
                    ) : (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#F4ECFF] text-[#7A3FFD]">
                        My Leads — {selectedLeadType === "new" ? "New Client" : "Old Client"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 max-h-[320px] overflow-y-auto">
                    {csrs.map(csr => (
                      <div key={csr.id}
                        className="border border-gray-200 rounded-2xl p-4 flex items-center justify-between hover:border-gray-300 transition-all">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                            csr.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                          }`}>{csr.name.charAt(0)}</div>
                          <div>
                            <h3 className="font-semibold text-gray-800 text-sm">{csr.name}</h3>
                            <p className="text-xs text-gray-400">{csr.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            csr.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>{csr.isActive ? "Active" : "Inactive"}</span>
                          <input type="checkbox"
                            checked={selectedCSRs.includes(csr.id)}
                            disabled={!csr.isActive}
                            onChange={e => {
                              if (e.target.checked) setSelectedCSRs(prev => [...prev, csr.id]);
                              else setSelectedCSRs(prev => prev.filter(id => id !== csr.id));
                            }}
                            className="w-5 h-5 accent-[#B8112D]"/>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setModalStep("pane")}
                      className="flex-1 h-12 rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all">
                      Back
                    </button>
                    <button onClick={handleFiles} disabled={selectedCSRs.length === 0}
                      className={`flex-1 h-12 rounded-2xl font-semibold text-sm transition-all ${
                        selectedCSRs.length > 0
                          ? "bg-[#B8112D] text-white hover:bg-[#a30f27]"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}>
                      Upload & Distribute ({selectedCSRs.length} CSRs)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DashboardSidebar/>

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
        <DashboardNavbar/>

        {/* HEADER */}
        <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-gray-800">Upload & Distribute Leads</h1>
            <p className="text-sm text-gray-400 mt-1">Upload Excel or CSV files and auto distribute leads equally among active CSRs.</p>
          </div>
          <div className="relative w-full lg:w-[320px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search uploaded files..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-12 rounded-2xl border border-gray-200 bg-white pl-11 pr-4 text-sm outline-none focus:border-[#B8112D]"/>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          {[
            { label:"Uploaded Files",    value: files.length,                                   bg:"bg-[#F8ECEF]", color:"text-[#B8112D]", icon:<FileText size={26}/> },
            { label:"Distributed Files", value: files.filter(f=>f.status==="Distributed").length, bg:"bg-green-100", color:"text-green-600",  icon:<CheckCircle2 size={26}/> },
            { label:"Total Leads",       value: latestTotalLeads,                               bg:"bg-blue-100",  color:"text-blue-600",   icon:<Database size={26}/> },
            { label:"Active CSRs",       value: latestDistribution.length,                      bg:"bg-yellow-100",color:"text-yellow-600", icon:<Users size={26}/> },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">{c.label}</p>
                  <h2 className="text-3xl font-semibold text-gray-800 mt-2">{c.value}</h2>
                </div>
                <div className={`w-14 h-14 rounded-2xl ${c.bg} ${c.color} flex items-center justify-center`}>{c.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* LATEST DISTRIBUTION */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm mb-6">
          <div className="mb-5">
            <h3 className="text-xl font-semibold text-gray-800">Latest CSR Distribution</h3>
            <p className="text-sm text-gray-400 mt-1">Latest uploaded leads distribution.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {latestDistribution.map((csr, i) => (
              <div key={i} className="bg-[#F8F9FC] border border-gray-100 rounded-2xl p-4">
                <p className="text-sm font-semibold text-gray-700">{csr.name}</p>
                <p className="text-xs text-gray-400 mt-1">Assigned Leads</p>
                <h4 className="text-2xl font-bold text-[#B8112D] mt-2">{csr.leads}</h4>
              </div>
            ))}
          </div>
        </div>

        {/* UPLOAD BOX */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm mb-6">
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); openCSRModal(e.dataTransfer.files); }}
            className={`border-2 border-dashed rounded-3xl p-8 md:p-10 transition-all cursor-pointer group ${
              dragging ? "border-[#B8112D] bg-[#FFF6F8]" : "border-gray-200 hover:border-[#B8112D]"
            }`}>
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#F8ECEF] flex items-center justify-center mb-5 group-hover:scale-105 transition-all">
                <UploadCloud size={38} className="text-[#B8112D]"/>
              </div>
              <h3 className="text-2xl font-semibold text-gray-800">Upload Excel or CSV Files</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-xl leading-relaxed">
                Upload lead sheets — select company and CSRs. Leads will be automatically distributed equally.
              </p>
              <button className="mt-6 bg-[#B8112D] hover:bg-[#a30f27] transition-all text-white px-7 py-3 rounded-2xl text-sm font-medium">
                Browse Files
              </button>
            </div>
            <input ref={inputRef} type="file" hidden accept=".xlsx,.xls,.csv"
              onChange={e => openCSRModal(e.target.files)}/>
          </div>
        </div>

        {/* FILES LIST */}
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">Uploaded Lead Sheets</h3>
          </div>

          {filteredFiles.length === 0 && (
            <div className="p-14 text-center">
              <UploadCloud size={42} className="mx-auto text-[#B8112D]"/>
              <p className="mt-4 text-gray-500">No files uploaded yet</p>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {filteredFiles.map(file => (
              <div key={file.id} className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#F8F9FC] flex items-center justify-center">
                      {getFileIcon(file.type)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{file.name}</h4>
                      {/* Company badge */}
                      {file.companyName && (
                        <span className="inline-flex items-center gap-1 bg-[#FFF1F3] text-[#B8112D] px-2.5 py-0.5 rounded-lg text-[11px] font-semibold mt-1">
                          <Building2 size={11}/>{file.companyName}
                        </span>
                      )}
                      <p className="text-sm text-gray-400 mt-1">{file.size} · {file.leads} Leads</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2 ${
                      file.status === "Distributed" ? "bg-green-100 text-green-700" :
                      file.status === "Processing"  ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {file.status === "Uploading"
                        ? <Loader2 size={14} className="animate-spin"/>
                        : <CheckCircle2 size={14}/>}
                      {file.status}
                    </span>
                    <button onClick={() => removeFile(file.id)}
                      className="w-10 h-10 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all">
                      <Trash2 size={18}/>
                    </button>
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-400">Upload Progress</p>
                    <p className="text-xs font-medium text-gray-600">{file.progress}%</p>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-[#B8112D] transition-all duration-300"
                      style={{ width: `${file.progress}%` }}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}