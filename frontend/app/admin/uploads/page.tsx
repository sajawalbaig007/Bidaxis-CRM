"use client";

import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  UploadCloud, FileText, Trash2, CheckCircle2, Search, Users,
  Database, FileSpreadsheet, FileImage, FileArchive, FileBadge,
  Loader2, X, Building2, ChevronDown, RefreshCw, RotateCcw,
  PhoneCall, Star, Briefcase,
} from "lucide-react";

import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import API from "@/lib/api";

/* ── Types ── */
type UploadFile = {
  id: number; name: string; size: string; type: string;
  progress: number; leads: number; distributed: boolean;
  status: "Uploading" | "Processing" | "Distributed";
  companyName: string;
};

type CSRDistribution = { name: string; leads: number };
type CSR = { id: string; name: string; email: string; isActive: boolean; csrCode?: string | null };

const PRESET_COMPANIES = ["PS Estimating", "Devcon", "Other"];

const getFileIcon = (type: string) => {
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv"))
    return <FileSpreadsheet size={22} className="text-green-600" />;
  if (type.includes("image"))
    return <FileImage size={22} className="text-blue-600" />;
  if (type.includes("zip") || type.includes("rar"))
    return <FileArchive size={22} className="text-yellow-600" />;
  return <FileBadge size={22} className="text-[#B8112D]" />;
};

export default function UploadPage() {
  const inputRef             = useRef<HTMLInputElement | null>(null);
  const inputRefImportant    = useRef<HTMLInputElement | null>(null);
  const inputRefInterested   = useRef<HTMLInputElement | null>(null);
  const inputRefActive       = useRef<HTMLInputElement | null>(null);

  const [dragging,            setDragging]            = useState(false);
  const [draggingImportant,   setDraggingImportant]   = useState(false);
  const [draggingInterested,  setDraggingInterested]  = useState(false);
  const [draggingActive,      setDraggingActive]      = useState(false);
  const [uploadMode,          setUploadMode]          = useState<"regular" | "important" | "interested" | "active">("regular");
  const [search,             setSearch]             = useState("");
  const [files,              setFiles]              = useState<UploadFile[]>([]);
  const [latestDistribution, setLatestDistribution] = useState<CSRDistribution[]>([]);
  const [latestTotalLeads,   setLatestTotalLeads]   = useState(0);

  const [showCSRModal,  setShowCSRModal]  = useState(false);
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [csrs,          setCsrs]          = useState<CSR[]>([]);
  const [selectedCSRs,  setSelectedCSRs]  = useState<string[]>([]);

  const [selectedCompany, setSelectedCompany] = useState("");
  const [customCompany,   setCustomCompany]   = useState("");
  const [modalStep, setModalStep] = useState<"category" | "reset" | "company" | "pane" | "csrs">("category");
  const [resetMode, setResetMode] = useState<"keep" | "reset" | null>(null);

  const [selectedPane,     setSelectedPane]     = useState<"pending" | "lead">("pending");
  const [selectedLeadType, setSelectedLeadType] = useState<"new" | "old">("new");

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
    const load = async () => { await fetchLatestUpload(); await fetchCSRs(); };
    load();
  }, []);

  const openCSRModal = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    setUploadMode("regular");
    setSelectedFile(selectedFiles[0]);
    setSelectedCompany("");
    setCustomCompany("");
    setResetMode(null);
    setSelectedPane("pending");
    setSelectedLeadType("new");
    setModalStep("category");
    setSelectedCSRs(csrs.filter(c => c.isActive).map(c => c.id));
    setShowCSRModal(true);
  };

  const openImportantModal = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    setUploadMode("important");
    setSelectedFile(selectedFiles[0]);
    setSelectedCompany("");
    setCustomCompany("");
    setResetMode("keep");
    setSelectedPane("pending");
    setSelectedLeadType("old");
    setModalStep("csrs");
    setSelectedCSRs(csrs.filter(c => c.isActive).map(c => c.id));
    setShowCSRModal(true);
  };

  const openInterestedModal = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    setUploadMode("interested");
    setSelectedFile(selectedFiles[0]);
    setSelectedCompany("");
    setCustomCompany("");
    setResetMode("keep");
    setSelectedPane("lead");
    setSelectedLeadType("new");
    setModalStep("csrs");
    setSelectedCSRs(csrs.filter(c => c.isActive).map(c => c.id));
    setShowCSRModal(true);
  };

  const openActiveModal = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    setUploadMode("active");
    setSelectedFile(selectedFiles[0]);
    setSelectedCompany("");
    setCustomCompany("");
    setResetMode("keep");
    setSelectedPane("lead");
    setSelectedLeadType("old");
    setModalStep("csrs");
    setSelectedCSRs(csrs.filter(c => c.isActive).map(c => c.id));
    setShowCSRModal(true);
  };

  const finalCompany = selectedCompany === "Other" ? customCompany : selectedCompany;

  const handleFiles = async () => {
    if (!selectedFile) return;
    /* company is optional for client uploads — comes from Excel rows */
    if (selectedPane !== "lead" && !finalCompany.trim()) { toast.error("Please enter company name"); return; }
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

    let processingInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("selectedCSRs", JSON.stringify(selectedCSRs));
      formData.append("companyName", finalCompany.trim());
      formData.append("resetMode", resetMode ?? "keep");
      formData.append("initialStatuses", JSON.stringify(
        uploadMode === "important"  ? ["important"]    :
        uploadMode === "interested" ? ["interested"]   :
        uploadMode === "active"     ? ["Close Client"] :
        selectedPane === "lead"     ? ["Close Client"] :
        ["pending"]
      ));
      formData.append("leadType",
        uploadMode === "important"  ? "old"    :
        uploadMode === "interested" ? "new"    :
        uploadMode === "active"     ? "active" :
        selectedLeadType
      );

      const res = await API.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          const pct = Math.min(50, Math.round((event.loaded / event.total) * 50));
          setFiles(prev => prev.map(f =>
            f.id === tempId ? { ...f, progress: pct, status: "Uploading" } : f
          ));
          if (event.loaded >= event.total && !processingInterval) {
            let processing = 50;
            setFiles(prev => prev.map(f =>
              f.id === tempId ? { ...f, progress: processing, status: "Processing" } : f
            ));
            processingInterval = setInterval(() => {
              processing = Math.min(92, processing + 1);
              setFiles(prev => prev.map(f =>
                f.id === tempId ? { ...f, progress: processing, status: "Processing" } : f
              ));
            }, 350);
          }
        },
      });

      if (processingInterval) clearInterval(processingInterval);
      setFiles(prev => prev.map(f =>
        f.id === tempId
          ? { ...f, progress: 100, leads: res.data.totalLeads, distributed: true, status: "Distributed" }
          : f
      ));

      const created = res.data.totalLeads as number;
      if (created === 0) {
        toast.error("No new leads added — all rows were duplicates.");
      } else {
        toast.success(`${created} leads uploaded & distributed for ${finalCompany.trim()}`);
      }
      void fetchLatestUpload();
    } catch {
      if (processingInterval) clearInterval(processingInterval);
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
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-xl lg:max-w-2xl shadow-2xl overflow-hidden max-h-[96vh] sm:max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-start justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-gray-100 shrink-0">
              <div className="pr-3 min-w-0">
                <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">
                  {modalStep === "category" ? "Upload Category"
                   : modalStep === "reset"   ? "Data Mode"
                   : modalStep === "company" ? "Select Company"
                   : modalStep === "pane"    ? "Select CSR Pane"
                   : "Select CSRs"}
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                  {modalStep === "category" ? "Where should this file's data go?"
                   : modalStep === "reset"   ? "What should happen to existing call data?"
                   : modalStep === "company" ? "Which company does this data belong to?"
                   : modalStep === "pane"    ? "Which section should these leads appear in?"
                   : "Choose which CSRs should receive leads."}
                </p>
              </div>
              <button
                onClick={() => setShowCSRModal(false)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all shrink-0"
              >
                <X size={15} className="sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>

            {/* Step indicators — scrollable on very small screens */}
            {(() => {
              const steps  = (selectedPane === "lead"
                ? ["category", "csrs"]
                : ["category", "reset", "company", "csrs"]) as readonly string[];
              const labels = selectedPane === "lead"
                ? ["Category", "CSRs"]
                : ["Category", "Data Mode", "Company", "CSRs"];
              const currentIdx = steps.indexOf(modalStep);
              return (
                <div className="flex items-center px-4 sm:px-6 pt-3 sm:pt-4 overflow-x-auto shrink-0">
                  <div className="flex items-center min-w-max w-full">
                    {steps.map((step, i) => {
                      const done   = i < currentIdx;
                      const active = i === currentIdx;
                      return (
                        <div key={step} className="flex items-center flex-1 last:flex-none">
                          <div className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold whitespace-nowrap ${
                            active ? "text-[#B8112D]" : done ? "text-[#027A48]" : "text-gray-400"
                          }`}>
                            <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold shrink-0 ${
                              active ? "bg-[#B8112D] text-white" : done ? "bg-[#ECFDF3] text-[#027A48]" : "bg-gray-100 text-gray-400"
                            }`}>
                              {done ? "✓" : i + 1}
                            </span>
                            {labels[i]}
                          </div>
                          {i < steps.length - 1 && (
                            <div className={`flex-1 h-0.5 mx-1.5 sm:mx-2 ${i < currentIdx ? "bg-[#027A48]" : "bg-gray-200"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Modal body — scroll */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1">

              {/* STEP — Category (Call Data or Leads) */}
              {modalStep === "category" && (
                <div className="space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">What type of data are you uploading?</p>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {([
                      { pane: "pending" as const, label: "Call Data", sub: "Today's daily call leads for CSRs", Icon: PhoneCall, border: "border-[#0B84F3]", bg: "bg-[#EAF5FF]", iconBg: "bg-[#0B84F3]", text: "text-[#0B84F3]" },
                      { pane: "lead"    as const, label: "Clients",     sub: "Previous clients & project history", Icon: Users,    border: "border-[#7A3FFD]", bg: "bg-[#F4ECFF]", iconBg: "bg-[#7A3FFD]", text: "text-[#7A3FFD]" },
                    ]).map(opt => {
                      const sel = selectedPane === opt.pane;
                      return (
                        <button
                          key={opt.pane}
                          onClick={() => setSelectedPane(opt.pane)}
                          className={`relative p-3 sm:p-5 rounded-2xl border-2 flex flex-col items-center gap-2 sm:gap-3 transition-all text-center ${
                            sel ? `${opt.border} ${opt.bg}` : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${
                            sel ? `${opt.iconBg} text-white` : "bg-white shadow-sm"
                          }`}>
                            <opt.Icon size={18} className={`sm:w-[22px] sm:h-[22px] ${sel ? "text-white" : "text-gray-400"}`} />
                          </div>
                          <div>
                            <p className={`font-bold text-xs sm:text-sm ${sel ? opt.text : "text-gray-800"}`}>{opt.label}</p>
                            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 leading-snug">{opt.sub}</p>
                          </div>
                          {sel && (
                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${opt.iconBg} flex items-center justify-center absolute top-2 right-2`}>
                              <CheckCircle2 size={10} className="text-white sm:w-3 sm:h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPane === "lead" && (
                    <div className="border border-[#7A3FFD]/20 bg-[#FDFBFF] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2 sm:space-y-3">
                      <p className="text-xs sm:text-sm font-semibold text-[#7A3FFD]">Upload as which client type?</p>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {([
                          { value: "new" as const, label: "New Client",  sub: "First-time clients",         border: "border-[#15803D]", bg: "bg-[#F0FDF4]", text: "text-[#15803D]", dot: "bg-[#15803D]" },
                          { value: "old" as const, label: "Old Client",  sub: "Returning / repeat clients", border: "border-[#B45309]", bg: "bg-[#FFFBEB]", text: "text-[#B45309]", dot: "bg-[#B45309]" },
                        ]).map(opt => {
                          const sel = selectedLeadType === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setSelectedLeadType(opt.value)}
                              className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 flex flex-col gap-1.5 sm:gap-2 transition-all text-left ${
                                sel ? `${opt.border} ${opt.bg}` : "border-gray-100 bg-white hover:border-gray-300"
                              }`}
                            >
                              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${sel ? opt.dot : "bg-gray-200"}`} />
                              <p className={`font-bold text-xs sm:text-sm ${sel ? opt.text : "text-gray-700"}`}>{opt.label}</p>
                              <p className="text-[10px] sm:text-[11px] text-gray-400 leading-snug">{opt.sub}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      if (selectedPane === "lead") {
                        setResetMode("keep");
                        setModalStep("csrs");
                      } else {
                        setResetMode(null);
                        setModalStep("reset");
                      }
                    }}
                    className="w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white font-semibold text-sm hover:bg-[#a30f27] transition-all"
                  >
                    Next — {selectedPane === "lead" ? "Select CSRs" : "Select Data Mode"}
                  </button>
                </div>
              )}

              {/* STEP 0 — Keep or Reset */}
              {modalStep === "reset" && (
                <div className="space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    What should happen to existing lead data?
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {[
                      {
                        value: "keep" as const,
                        Icon: Database,
                        label: "Keep Existing",
                        sub: "New links added alongside existing data",
                        activeBorder: "border-[#027A48]", activeBg: "bg-[#ECFDF3]",
                        activeIcon: "bg-[#027A48]", activeText: "text-[#027A48]",
                      },
                      {
                        value: "reset" as const,
                        Icon: RefreshCw,
                        label: "Reset Data",
                        sub: "Old call data deleted, new links added",
                        activeBorder: "border-[#B8112D]", activeBg: "bg-[#FFF1F3]",
                        activeIcon: "bg-[#B8112D]", activeText: "text-[#B8112D]",
                      },
                    ].map(opt => {
                      const sel = resetMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setResetMode(opt.value)}
                          className={`p-3 sm:p-5 rounded-2xl border-2 flex flex-col items-center gap-2 sm:gap-3 transition-all text-left ${
                            sel ? `${opt.activeBorder} ${opt.activeBg}` : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${
                            sel ? `${opt.activeIcon} text-white` : "bg-white shadow-sm text-gray-500"
                          }`}>
                            <opt.Icon size={18} className="sm:w-[22px] sm:h-[22px]" />
                          </div>
                          <div>
                            <h4 className={`font-bold text-xs sm:text-sm ${sel ? opt.activeText : "text-gray-800"}`}>
                              {opt.label}
                            </h4>
                            <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1 leading-snug">{opt.sub}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {resetMode === "reset" && (
                    <div className="bg-[#FFF7E6] border border-[#F59E0B]/30 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3">
                      <RotateCcw size={14} className="text-[#B45309] mt-0.5 shrink-0 sm:w-4 sm:h-4" />
                      <p className="text-xs sm:text-sm text-[#92400E]">
                        <strong>Note:</strong> Only call data (pending leads) will be deleted.
                        Important, interested, clients, and projects will stay untouched.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => setModalStep("category")}
                      className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => { if (!resetMode) { toast.error("Please select an option"); return; } setModalStep("company"); }}
                      disabled={!resetMode}
                      className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm transition-all ${
                        resetMode ? "bg-[#B8112D] text-white hover:bg-[#a30f27]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Next — Select Company
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 1 — Company */}
              {modalStep === "company" && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {PRESET_COMPANIES.map(company => {
                      const sel = selectedCompany === company;
                      return (
                        <button
                          key={company}
                          onClick={() => setSelectedCompany(company)}
                          className={`p-3 sm:p-4 rounded-2xl border-2 flex flex-col items-center gap-2 sm:gap-3 transition-all ${
                            sel ? "border-[#B8112D] bg-[#FFF1F3]" : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${
                            sel ? "bg-[#B8112D] text-white" : "bg-white shadow-sm text-gray-500"
                          }`}>
                            <Building2 size={18} className="sm:w-[22px] sm:h-[22px]" />
                          </div>
                          <span className={`font-semibold text-xs sm:text-sm text-center ${sel ? "text-[#B8112D]" : "text-gray-700"}`}>
                            {company}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedCompany === "Other" && (
                    <div>
                      <label className="text-xs sm:text-sm font-semibold text-gray-700 block mb-1.5 sm:mb-2">Company Name</label>
                      <input
                        type="text"
                        value={customCompany}
                        onChange={e => setCustomCompany(e.target.value)}
                        placeholder="Enter company name..."
                        className="w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl border border-gray-200 px-3 sm:px-4 outline-none focus:border-[#B8112D] text-sm"
                      />
                    </div>
                  )}

                  {selectedFile && (
                    <div className="bg-[#FAFAFA] rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                        <FileSpreadsheet size={16} className="text-green-600 sm:w-[18px] sm:h-[18px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#111827] text-xs sm:text-sm truncate">{selectedFile.name}</p>
                        <p className="text-gray-400 text-[10px] sm:text-xs">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => selectedPane === "lead" ? setModalStep("category") : setModalStep("reset")}
                      className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => {
                        if (!finalCompany.trim()) { toast.error("Please select or enter a company name"); return; }
                        setModalStep("csrs");
                      }}
                      disabled={!selectedCompany || (selectedCompany === "Other" && !customCompany.trim())}
                      className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm transition-all ${
                        selectedCompany && (selectedCompany !== "Other" || customCompany.trim())
                          ? "bg-[#B8112D] text-white hover:bg-[#a30f27]"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Next
                      <ChevronDown size={14} className="inline ml-1 rotate-[-90deg] sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2 — Pane */}
              {modalStep === "pane" && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center gap-2 bg-[#FFF1F3] text-[#B8112D] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl w-fit text-xs sm:text-sm font-semibold">
                    <Building2 size={13} className="sm:w-[15px] sm:h-[15px]" />{finalCompany}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {([
                      { value: "pending" as const, label: "Call data",  sub: "Today Links (daily call list)",     Icon: PhoneCall, border: "border-[#0B84F3]", bg: "bg-[#EAF5FF]", iconBg: "bg-[#0B84F3]", text: "text-[#0B84F3]" },
                      { value: "lead"    as const, label: "Leads",  sub: "Previous clients & project history", Icon: Users,    border: "border-[#7A3FFD]", bg: "bg-[#F4ECFF]", iconBg: "bg-[#7A3FFD]", text: "text-[#7A3FFD]" },
                    ]).map(opt => {
                      const sel = selectedPane === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setSelectedPane(opt.value)}
                          className={`relative p-3 sm:p-5 rounded-2xl border-2 flex flex-col items-center gap-2 sm:gap-3 transition-all text-center ${
                            sel ? `${opt.border} ${opt.bg}` : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center ${
                            sel ? `${opt.iconBg} text-white` : "bg-white shadow-sm"
                          }`}>
                            <opt.Icon size={18} className={`sm:w-[22px] sm:h-[22px] ${sel ? "text-white" : "text-gray-400"}`} />
                          </div>
                          <div>
                            <p className={`font-bold text-xs sm:text-sm ${sel ? opt.text : "text-gray-800"}`}>{opt.label}</p>
                            <p className="text-[10px] sm:text-[11px] text-gray-400 mt-0.5 sm:mt-1 leading-snug">{opt.sub}</p>
                          </div>
                          {sel && (
                            <span className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full ${opt.iconBg} flex items-center justify-center absolute top-2 right-2`}>
                              <CheckCircle2 size={10} className="text-white sm:w-3 sm:h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedPane === "lead" && (
                    <div className="border border-[#7A3FFD]/20 bg-[#FDFBFF] rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2 sm:space-y-3">
                      <p className="text-xs sm:text-sm font-semibold text-[#7A3FFD]">Upload as which client type?</p>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        {([
                          { value: "new" as const, label: "New Client",  sub: "First-time clients",        border: "border-[#15803D]", bg: "bg-[#F0FDF4]", text: "text-[#15803D]", dot: "bg-[#15803D]" },
                          { value: "old" as const, label: "Old Client",  sub: "Returning / repeat clients", border: "border-[#B45309]", bg: "bg-[#FFFBEB]", text: "text-[#B45309]", dot: "bg-[#B45309]" },
                        ]).map(opt => {
                          const sel = selectedLeadType === opt.value;
                          return (
                            <button
                              key={opt.value}
                              onClick={() => setSelectedLeadType(opt.value)}
                              className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 flex flex-col gap-1.5 sm:gap-2 transition-all text-left ${
                                sel ? `${opt.border} ${opt.bg}` : "border-gray-100 bg-white hover:border-gray-300"
                              }`}
                            >
                              <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${sel ? opt.dot : "bg-gray-200"}`} />
                              <p className={`font-bold text-xs sm:text-sm ${sel ? opt.text : "text-gray-700"}`}>{opt.label}</p>
                              <p className="text-[10px] sm:text-[11px] text-gray-400 leading-snug">{opt.sub}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => setModalStep("company")}
                      className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => setModalStep("csrs")}
                      className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white font-semibold text-sm hover:bg-[#a30f27] transition-all"
                    >
                      Next — CSRs
                      <ChevronDown size={14} className="inline ml-1 rotate-[-90deg] sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 — CSRs */}
              {modalStep === "csrs" && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {finalCompany && (
                      <div className="flex items-center gap-1.5 sm:gap-2 bg-[#FFF1F3] text-[#B8112D] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold">
                        <Building2 size={12} className="sm:w-[15px] sm:h-[15px]" />{finalCompany}
                      </div>
                    )}
                    {selectedPane === "pending" ? (
                      <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold bg-[#EAF5FF] text-[#0B84F3]">
                        Call Data
                      </span>
                    ) : (
                      <span className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-semibold bg-[#F4ECFF] text-[#7A3FFD]">
                        Leads — {selectedLeadType === "new" ? "New Client" : "Old Client"}
                      </span>
                    )}
                  </div>

                  {/* Select All / Deselect All */}
                  {(() => {
                    const activeCSRs = csrs.filter(c => c.isActive);
                    const allSelected = activeCSRs.length > 0 && activeCSRs.every(c => selectedCSRs.includes(c.id));
                    return (
                      <div className="flex items-center justify-between pb-1">
                        <p className="text-[11px] sm:text-xs text-gray-400">
                          <span className="font-semibold text-gray-600">{selectedCSRs.length}</span> of {activeCSRs.length} selected
                        </p>
                        <button
                          onClick={() => allSelected
                            ? setSelectedCSRs([])
                            : setSelectedCSRs(activeCSRs.map(c => c.id))
                          }
                          className="text-[11px] sm:text-xs font-semibold text-[#B8112D] hover:underline"
                        >
                          {allSelected ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                    );
                  })()}

                  <div className="space-y-2 sm:space-y-3 max-h-[240px] sm:max-h-[300px] overflow-y-auto">
                    {csrs.map(csr => {
                      const checked = selectedCSRs.includes(csr.id);
                      const toggle = () => {
                        if (!csr.isActive) return;
                        setSelectedCSRs(prev =>
                          checked ? prev.filter(id => id !== csr.id) : [...prev, csr.id]
                        );
                      };
                      return (
                        <div
                          key={csr.id}
                          onClick={toggle}
                          className={`border rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between transition-all select-none ${
                            csr.isActive ? "cursor-pointer hover:border-gray-300" : "cursor-not-allowed opacity-60"
                          } ${
                            checked ? "border-[#B8112D] bg-[#FFF6F8]" : "border-gray-200"
                          }`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 ${
                              csr.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
                            }`}>
                              {csr.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                {csr.csrCode && (
                                  <span className="bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0">{csr.csrCode}</span>
                                )}
                                <h3 className="font-semibold text-gray-800 text-xs sm:text-sm truncate">{csr.name}</h3>
                              </div>
                              <p className="text-[10px] sm:text-xs text-gray-400 truncate">{csr.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                            <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                              csr.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>
                              {csr.isActive ? "Active" : "Inactive"}
                            </span>
                            <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                              checked
                                ? "bg-[#B8112D] border-[#B8112D]"
                                : "border-gray-300 bg-white"
                            }`}>
                              {checked && (
                                <svg viewBox="0 0 10 8" className="w-2.5 h-2 text-white fill-none stroke-current stroke-[2]">
                                  <polyline points="1,4 4,7 9,1" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => selectedPane === "lead" ? setModalStep("category") : setModalStep("company")}
                      className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleFiles}
                      disabled={selectedCSRs.length === 0}
                      className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-xs sm:text-sm transition-all ${
                        selectedCSRs.length > 0
                          ? "bg-[#B8112D] text-white hover:bg-[#a30f27]"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      Upload & Distribute ({selectedCSRs.length})
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <DashboardSidebar />

      <main className="flex-1 min-w-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7 2xl:p-8 overflow-x-hidden mt-[64px]">
        <DashboardNavbar />

        {/* ── HEADER ── */}
        <div className="mb-4 sm:mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-800">
              Upload & Distribute Leads
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
              Upload Excel or CSV files and auto distribute leads equally among active CSRs.
            </p>
          </div>
          <div className="relative w-full lg:w-[280px] xl:w-[320px]">
            <Search size={15} className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search uploaded files..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl border border-gray-200 bg-white pl-10 sm:pl-11 pr-4 text-sm outline-none focus:border-[#B8112D]"
            />
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        {/* 2-col mobile → 2-col sm → 4-col xl */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-4 sm:mb-6">
          {[
            { label: "Uploaded Files",    value: files.length,                                    bg: "bg-[#F8ECEF]",  color: "text-[#B8112D]",  icon: <FileText size={20} className="sm:w-6 sm:h-6 lg:w-[26px] lg:h-[26px]" /> },
            { label: "Distributed",       value: files.filter(f => f.status === "Distributed").length, bg: "bg-green-100", color: "text-green-600",  icon: <CheckCircle2 size={20} className="sm:w-6 sm:h-6 lg:w-[26px] lg:h-[26px]" /> },
            { label: "Total Leads",       value: latestTotalLeads,                                bg: "bg-blue-100",   color: "text-blue-600",   icon: <Database size={20} className="sm:w-6 sm:h-6 lg:w-[26px] lg:h-[26px]" /> },
            { label: "Active CSRs",       value: latestDistribution.length,                      bg: "bg-yellow-100", color: "text-yellow-600", icon: <Users size={20} className="sm:w-6 sm:h-6 lg:w-[26px] lg:h-[26px]" /> },
          ].map((c, i) => (
            <div key={i} className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-3 sm:p-4 lg:p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-sm text-gray-400 truncate">{c.label}</p>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-1 sm:mt-2">{c.value}</h2>
                </div>
                <div className={`w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl ${c.bg} ${c.color} flex items-center justify-center shrink-0`}>
                  {c.icon}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── LATEST DISTRIBUTION ── */}
        <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-4 sm:p-5 lg:p-6 shadow-sm mb-4 sm:mb-6">
          <div className="mb-3 sm:mb-5">
            <h3 className="text-base sm:text-xl font-semibold text-gray-800">Latest CSR Distribution</h3>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">Latest uploaded leads distribution.</p>
          </div>
          {/* 2-col mobile → 2-col sm → 4-col md+ */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {latestDistribution.map((csr, i) => (
              <div key={i} className="bg-[#F8F9FC] border border-gray-100 rounded-xl sm:rounded-2xl p-3 sm:p-4">
                <p className="text-xs sm:text-sm font-semibold text-gray-700 truncate">{csr.name}</p>
                <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">Assigned Leads</p>
                <h4 className="text-xl sm:text-2xl font-bold text-[#B8112D] mt-1 sm:mt-2">{csr.leads}</h4>
              </div>
            ))}
          </div>
        </div>

        {/* ── UPLOAD BOXES — two columns on md+ ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">

          {/* Regular leads upload */}
          <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); openCSRModal(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-2xl lg:rounded-3xl p-6 sm:p-8 transition-all cursor-pointer group ${
                dragging ? "border-[#B8112D] bg-[#FFF6F8]" : "border-gray-200 hover:border-[#B8112D]"
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#F8ECEF] flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-all">
                  <UploadCloud size={28} className="text-[#B8112D] sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800">Upload New Leads</h3>
                <p className="text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2 max-w-xs leading-relaxed">
                  Upload lead sheets — select company and CSRs. Leads are distributed equally.
                </p>
                <button className="mt-4 bg-[#B8112D] hover:bg-[#a30f27] transition-all text-white px-5 py-2.5 rounded-xl sm:rounded-2xl text-sm font-medium">
                  Browse Files
                </button>
              </div>
              <input ref={inputRef} type="file" hidden accept=".xlsx,.xls,.csv"
                onChange={e => openCSRModal(e.target.files)} />
            </div>
          </div>

          {/* Importants / previous clients upload */}
          <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <div
              onClick={() => inputRefImportant.current?.click()}
              onDragOver={e => { e.preventDefault(); setDraggingImportant(true); }}
              onDragLeave={() => setDraggingImportant(false)}
              onDrop={e => { e.preventDefault(); setDraggingImportant(false); openImportantModal(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-2xl lg:rounded-3xl p-6 sm:p-8 transition-all cursor-pointer group ${
                draggingImportant ? "border-amber-500 bg-amber-50" : "border-amber-200 hover:border-amber-400"
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-50 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-all">
                  <PhoneCall size={26} className="text-amber-600 sm:w-7 sm:h-7" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800">Previous Important Clients</h3>
                <p className="text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2 max-w-xs leading-relaxed">
                  Previously known important clients — added as old clients with <span className="font-semibold text-amber-600">Important</span> status.
                </p>
                <button className="mt-4 bg-amber-500 hover:bg-amber-600 transition-all text-white px-5 py-2.5 rounded-xl sm:rounded-2xl text-sm font-medium">
                  Browse Files
                </button>
              </div>
              <input ref={inputRefImportant} type="file" hidden accept=".xlsx,.xls,.csv"
                onChange={e => openImportantModal(e.target.files)} />
            </div>
          </div>
         

          {/* Interested clients uploads */}
          <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <div
              onClick={() => inputRefInterested.current?.click()}
              onDragOver={e => { e.preventDefault(); setDraggingInterested(true); }}
              onDragLeave={() => setDraggingInterested(false)}
              onDrop={e => { e.preventDefault(); setDraggingInterested(false); openInterestedModal(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-2xl lg:rounded-3xl p-6 sm:p-8 transition-all cursor-pointer group ${
                draggingInterested ? "border-emerald-500 bg-emerald-50" : "border-emerald-200 hover:border-emerald-400"
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-all">
                  <Star size={26} className="text-emerald-600 sm:w-7 sm:h-7" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800">Interested Clients</h3>
                <p className="text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2 max-w-xs leading-relaxed">
                  Upload clients who showed interest — added as new clients with <span className="font-semibold text-emerald-600">Interested</span> status.
                </p>
                <button className="mt-4 bg-emerald-500 hover:bg-emerald-600 transition-all text-white px-5 py-2.5 rounded-xl sm:rounded-2xl text-sm font-medium">
                  Browse Files
                </button>
              </div>
              <input ref={inputRefInterested} type="file" hidden accept=".xlsx,.xls,.csv"
                onChange={e => openInterestedModal(e.target.files)} />
            </div>
          </div>

          {/* Active projects uploads */}
          <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-4 sm:p-5 shadow-sm">
            <div
              onClick={() => inputRefActive.current?.click()}
              onDragOver={e => { e.preventDefault(); setDraggingActive(true); }}
              onDragLeave={() => setDraggingActive(false)}
              onDrop={e => { e.preventDefault(); setDraggingActive(false); openActiveModal(e.dataTransfer.files); }}
              className={`border-2 border-dashed rounded-2xl lg:rounded-3xl p-6 sm:p-8 transition-all cursor-pointer group ${
                draggingActive ? "border-indigo-500 bg-indigo-50" : "border-indigo-200 hover:border-indigo-400"
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-indigo-50 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-105 transition-all">
                  <Briefcase size={26} className="text-indigo-600 sm:w-7 sm:h-7" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800">Active Projects</h3>
                <p className="text-xs sm:text-sm text-gray-400 mt-1.5 sm:mt-2 max-w-xs leading-relaxed">
                  Upload clients with ongoing projects — added as old clients with <span className="font-semibold text-indigo-600">Active</span> status.
                </p>
                <button className="mt-4 bg-indigo-500 hover:bg-indigo-600 transition-all text-white px-5 py-2.5 rounded-xl sm:rounded-2xl text-sm font-medium">
                  Browse Files
                </button>
              </div>
              <input ref={inputRefActive} type="file" hidden accept=".xlsx,.xls,.csv"
                onChange={e => openActiveModal(e.target.files)} />
            </div>
          </div>
         
        </div>

        {/* ── FILES LISTs ── */}
        <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 py-3 sm:py-4 lg:p-5 border-b border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-800">Uploaded Lead Sheets</h3>
          </div>

          {filteredFiles.length === 0 && (
            <div className="p-10 sm:p-12 lg:p-14 text-center">
              <UploadCloud size={36} className="mx-auto text-[#B8112D] lg:w-[42px] lg:h-[42px]" />
              <p className="mt-3 sm:mt-4 text-gray-500 text-sm">No files uploaded yet</p>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {filteredFiles.map(file => (
              <div key={file.id} className="p-4 sm:p-5">
                {/* File info + actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-5">
                  {/* Left: icon + name */}
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-xl sm:rounded-2xl bg-[#F8F9FC] flex items-center justify-center shrink-0">
                      {getFileIcon(file.type)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-gray-800 text-sm truncate">{file.name}</h4>
                      {file.companyName && (
                        <span className="inline-flex items-center gap-1 bg-[#FFF1F3] text-[#B8112D] px-2 sm:px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-semibold mt-0.5 sm:mt-1">
                          <Building2 size={9} className="sm:w-[11px] sm:h-[11px]" />{file.companyName}
                        </span>
                      )}
                      <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                        {file.size} · {file.leads} Leads
                      </p>
                    </div>
                  </div>

                  {/* Rights: status + deletes */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-1.5 sm:gap-2 ${
                      file.status === "Distributed" ? "bg-green-100 text-green-700" :
                      file.status === "Processing"  ? "bg-blue-100 text-blue-700"  :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {file.status === "Uploading" || file.status === "Processing"
                        ? <Loader2 size={12} className="animate-spin sm:w-[14px] sm:h-[14px]" />
                        : <CheckCircle2 size={12} className="sm:w-[14px] sm:h-[14px]" />
                      }
                      {file.status}
                    </span>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                    >
                      <Trash2 size={15} className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 sm:mt-5">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <p className="text-[10px] sm:text-xs text-gray-400">Upload Progress</p>
                    <p className="text-[10px] sm:text-xs font-medium text-gray-600">{file.progress}%</p>
                  </div>
                  <div className="w-full h-1.5 sm:h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#B8112D] transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
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