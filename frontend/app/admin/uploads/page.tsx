"use client";

import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  UploadCloud, FileText, Trash2, CheckCircle2, Users,
  Database, FileSpreadsheet, FileImage, FileArchive, FileBadge,
  Loader2, X, Building2, ChevronDown, ChevronUp, RefreshCw, RotateCcw,
  PhoneCall, Star, Briefcase, Globe, Plus, History, AlertCircle, Pencil,
} from "lucide-react";

import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import UploadFilePreview, { type PreviewRow, type PreviewSummary } from "../components/uploads/UploadFilePreview";
import API from "@/lib/api";
import { CSR_THEAD } from "@/app/csr/components/shared/csrTableStyles";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

/* ── Types ── */
type UploadFile = {
  id: number; name: string; size: string; type: string;
  progress: number; leads: number; distributed: boolean;
  status: "Uploading" | "Processing" | "Distributed";
  companyName: string;
};

type CSRDistribution = { name: string; leads: number };
type CSR = { id: string; name: string; email: string; isActive: boolean; csrCode?: string | null };

type SourceStats = {
  total: number; pending: number; important: number; interested: number;
  notPicked: number; projectWon: number; notInterested: number;
};

type UploadSourceRow = {
  id: string; name: string; sudoName: string | null; createdAt: string;
  uploadCount: number; lastUpload: string | null; stats: SourceStats;
};

type RowResult = {
  row: number;
  name: string;
  phone: string;
  email: string;
  company: string;
  status: "new" | "duplicate" | "updated" | "empty";
  reason: string;
};

type UploadSummary = {
  new: number;
  duplicate: number;
  updated: number;
  empty: number;
  total?: number;
};

type HistoryUpload = {
  id: string;
  fileName: string;
  totalLeads: number;
  linkedLeads: number;
  companyName: string | null;
  uploadCategory: string | null;
  source: { id: string; name: string; sudoName: string | null } | null;
  createdAt: string;
};

type UploadCategoryKey =
  | "all"
  | "call-data"
  | "new-client"
  | "old-client"
  | "interested"
  | "important"
  | "active-projects";

const HISTORY_CATEGORIES: { key: UploadCategoryKey; label: string; color: string }[] = [
  { key: "all",             label: "All",             color: "text-gray-700" },
  { key: "call-data",       label: "Call Data",       color: "text-[#0B84F3]" },
  { key: "new-client",      label: "New Client",      color: "text-[#15803D]" },
  { key: "old-client",      label: "Old Client",      color: "text-[#B45309]" },
  { key: "interested",      label: "Interested",      color: "text-[#D97706]" },
  { key: "important",       label: "Important",       color: "text-[#B8112D]" },
  { key: "active-projects", label: "Active Projects", color: "text-indigo-600" },
];

const CATEGORY_LABEL_MAP = Object.fromEntries(
  HISTORY_CATEGORIES.map(c => [c.key, c.label])
) as Record<UploadCategoryKey, string>;

type ModalStep = "category" | "reset" | "company" | "source" | "pane" | "csrs";

const PRESET_COMPANIES = ["PS Estimating", "Devcon", "Other"];

const sourceAdminLabel = (s: { name: string; sudoName?: string | null }) =>
  s.sudoName ? `${s.name} · ${s.sudoName}` : s.name;
const PREVIEW_PAGE_SIZE = 30;
const RESULT_FILTER_OPTIONS = [
  { key: "all" as const, label: "All" },
  { key: "new" as const, label: "New" },
  { key: "duplicate" as const, label: "Duplicate" },
  { key: "updated" as const, label: "Updated" },
  { key: "empty" as const, label: "Skipped" },
];

const STATUS_STYLE: Record<RowResult["status"], { bg: string; text: string; label: string }> = {
  new:       { bg: "bg-green-100",  text: "text-green-700",  label: "New" },
  duplicate: { bg: "bg-red-100",    text: "text-red-700",    label: "Duplicate" },
  updated:   { bg: "bg-blue-100",   text: "text-blue-700",   label: "Updated" },
  empty:     { bg: "bg-gray-100",   text: "text-gray-500",   label: "Skipped" },
};

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
  const [files,              setFiles]              = useState<UploadFile[]>([]);
  const [latestDistribution, setLatestDistribution] = useState<CSRDistribution[]>([]);
  const [latestTotalLeads,   setLatestTotalLeads]   = useState(0);

  const [showHistoryModal,   setShowHistoryModal]   = useState(false);
  const [uploadHistory,      setUploadHistory]      = useState<HistoryUpload[]>([]);
  const [historyCategory,    setHistoryCategory]    = useState<UploadCategoryKey>("all");
  const [historyCounts,      setHistoryCounts]      = useState<Record<string, number>>({});
  const [historyLoading,     setHistoryLoading]     = useState(false);
  const [deletingUploadId,   setDeletingUploadId]   = useState<string | null>(null);

  const [rowResults,         setRowResults]         = useState<RowResult[]>([]);
  const [uploadSummary,      setUploadSummary]      = useState<UploadSummary | null>(null);
  const [lastUploadName,     setLastUploadName]     = useState("");
  const [resultsFilter,      setResultsFilter]      = useState<"all" | RowResult["status"]>("all");
  const [resultsPage,        setResultsPage]        = useState(1);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [previewLoading,     setPreviewLoading]     = useState(false);
  const [previewLive,        setPreviewLive]        = useState(false);
  const [resultsExpanded,    setResultsExpanded]    = useState(true);

  const [showCSRModal,  setShowCSRModal]  = useState(false);
  const [selectedFile,  setSelectedFile]  = useState<File | null>(null);
  const [csrs,          setCsrs]          = useState<CSR[]>([]);
  const [selectedCSRs,  setSelectedCSRs]  = useState<string[]>([]);

  const [selectedCompany, setSelectedCompany] = useState("");
  const [customCompany,   setCustomCompany]   = useState("");
  const [modalStep, setModalStep] = useState<ModalStep>("category");
  const [resetMode, setResetMode] = useState<"keep" | "reset" | null>(null);

  const [selectedPane,     setSelectedPane]     = useState<"pending" | "lead">("pending");
  const [selectedLeadType, setSelectedLeadType] = useState<"new" | "old">("new");

  const [uploadSources,    setUploadSources]    = useState<UploadSourceRow[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [newSourceName,    setNewSourceName]    = useState("");
  const [newSourceSudoName, setNewSourceSudoName] = useState("");
  const [addingSource,     setAddingSource]     = useState(false);
  const [editingSourceId,  setEditingSourceId]  = useState<string | null>(null);
  const [editSourceName,   setEditSourceName]   = useState("");
  const [editSourceSudoName, setEditSourceSudoName] = useState("");
  const [savingSourceId,   setSavingSourceId]   = useState<string | null>(null);
  const [deletingSourceId, setDeletingSourceId] = useState<string | null>(null);
  const [assigningUploadId, setAssigningUploadId] = useState<string | null>(null);
  const [assignSourceId,   setAssignSourceId]   = useState("");
  const [assignNewSourceName, setAssignNewSourceName] = useState("");
  const [assignNewSourceSudoName, setAssignNewSourceSudoName] = useState("");
  const [savingAssignId,   setSavingAssignId]   = useState<string | null>(null);
  const [historySourceId,  setHistorySourceId]  = useState<string | "all">("all");
  const [sourceDetail,     setSourceDetail]     = useState<{
    stats: SourceStats;
    uploads: { id: string; fileName: string; totalLeads: number; createdAt: string }[];
  } | null>(null);

  const [filePreviewRows,    setFilePreviewRows]    = useState<PreviewRow[]>([]);
  const [filePreviewSummary, setFilePreviewSummary] = useState<PreviewSummary | null>(null);
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [hideDupInPreview,     setHideDupInPreview]     = useState(true);
  const [previewFilter,        setPreviewFilter]        = useState<"all" | PreviewRow["status"]>("all");

  const fetchUploadSources = async () => {
    try {
      const res = await API.get("/admin/upload-sources");
      setUploadSources(res.data.sources ?? []);
    } catch { /* non-blocking */ }
  };

  const fetchSourceDetail = async (sourceId: string) => {
    try {
      const res = await API.get(`/admin/upload-sources/${sourceId}`);
      setSourceDetail({ stats: res.data.stats, uploads: res.data.uploads ?? [] });
    } catch { setSourceDetail(null); }
  };

  const addNewSource = async () => {
    const name = newSourceName.trim();
    const sudoName = newSourceSudoName.trim();
    if (!name) { toast.error("Enter a source name"); return; }
    setAddingSource(true);
    try {
      const res = await API.post("/admin/upload-sources", { name, sudoName: sudoName || undefined });
      const src = res.data.source as { id: string; name: string };
      setSelectedSourceId(src.id);
      setNewSourceName("");
      setNewSourceSudoName("");
      toast.success(res.data.created ? `"${name}" added` : `"${name}" selected`);
      await fetchUploadSources();
    } catch {
      toast.error("Failed to add source");
    } finally {
      setAddingSource(false);
    }
  };

  const startEditSource = (src: UploadSourceRow) => {
    setEditingSourceId(src.id);
    setEditSourceName(src.name);
    setEditSourceSudoName(src.sudoName ?? "");
  };

  const cancelEditSource = () => {
    setEditingSourceId(null);
    setEditSourceName("");
    setEditSourceSudoName("");
  };

  const saveEditSource = async (id: string) => {
    const name = editSourceName.trim();
    if (!name) { toast.error("Source name required"); return; }
    setSavingSourceId(id);
    try {
      await API.patch(`/admin/upload-sources/${id}`, {
        name,
        sudoName: editSourceSudoName.trim() || null,
      });
      toast.success("Source updated");
      cancelEditSource();
      await fetchUploadSources();
    } catch {
      toast.error("Failed to update source");
    } finally {
      setSavingSourceId(null);
    }
  };

  const deleteSource = async (id: string, name: string) => {
    if (!confirm(`Delete source "${name}"?\n\nPast uploads will remain but lose their source link.`)) return;
    setDeletingSourceId(id);
    try {
      await API.delete(`/admin/upload-sources/${id}`);
      toast.success("Source deleted");
      if (historySourceId === id) setHistorySourceId("all");
      if (selectedSourceId === id) setSelectedSourceId("");
      await fetchUploadSources();
    } catch {
      toast.error("Failed to delete source");
    } finally {
      setDeletingSourceId(null);
    }
  };

  const cancelAssignSource = () => {
    setAssigningUploadId(null);
    setAssignSourceId("");
    setAssignNewSourceName("");
    setAssignNewSourceSudoName("");
  };

  const openAssignSource = (uploadId: string) => {
    setAssigningUploadId(uploadId);
    setAssignSourceId("");
    setAssignNewSourceName("");
    setAssignNewSourceSudoName("");
  };

  const saveAssignSource = async (uploadId: string) => {
    if (!assignSourceId && !assignNewSourceName.trim()) {
      toast.error("Select or create a source");
      return;
    }
    setSavingAssignId(uploadId);
    try {
      const body: Record<string, string> = assignSourceId
        ? { sourceId: assignSourceId }
        : {
            name: assignNewSourceName.trim(),
            ...(assignNewSourceSudoName.trim() ? { sudoName: assignNewSourceSudoName.trim() } : {}),
          };
      const res = await API.patch(`/uploads/${uploadId}/source`, body);
      const updated = res.data.upload as HistoryUpload;
      setUploadHistory(prev => prev.map(u => (u.id === uploadId ? { ...u, source: updated.source } : u)));
      toast.success("Source assigned");
      cancelAssignSource();
      void fetchUploadSources();
    } catch {
      toast.error("Failed to assign source");
    } finally {
      setSavingAssignId(null);
    }
  };

  const fetchCSRs = async () => {
    try {
      const res = await API.get("/admin/csrs");
      setCsrs(res.data.csrs);
    } catch { toast.error("Failed to fetch CSRs"); }
  };

  const fetchUploadHistory = async (category?: UploadCategoryKey) => {
    const cat = category ?? historyCategory;
    setHistoryLoading(true);
    try {
      const res = await API.get("/uploads/history", { params: { category: cat } });
      setUploadHistory(res.data.uploads ?? []);
      setHistoryCounts(res.data.counts ?? {});
    } catch {
      toast.error("Failed to load upload history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const deleteHistoryUpload = async (id: string, fileName: string) => {
    const linked = uploadHistory.find(u => u.id === id)?.linkedLeads ?? 0;
    if (!confirm(`Delete "${fileName}"?\n\n${linked} contact(s) will be permanently removed from the database and CSR dashboards.`)) return;
    setDeletingUploadId(id);
    try {
      const res = await API.delete(`/uploads/${id}`);
      toast.success(res.data.message ?? "Upload deleted from DB & CSR dashboards");
      void fetchUploadHistory(historyCategory);
      void fetchLatestUpload();
      void fetchUploadSources();
    } catch {
      toast.error("Failed to delete upload");
    } finally {
      setDeletingUploadId(null);
    }
  };

  const openHistoryModal = () => {
    setShowHistoryModal(true);
    void fetchUploadHistory(historyCategory);
    void fetchUploadSources();
  };

  const switchHistoryCategory = (cat: UploadCategoryKey) => {
    setHistoryCategory(cat);
    void fetchUploadHistory(cat);
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
    const load = async () => { await fetchLatestUpload(); await fetchCSRs(); await fetchUploadSources(); };
    load();
  }, []);

  useEffect(() => {
    if (historySourceId === "all") {
      setSourceDetail(null);
      return;
    }
    void fetchSourceDetail(historySourceId);
  }, [historySourceId]);

  const openCSRModal = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    setUploadMode("regular");
    setSelectedFile(selectedFiles[0]);
    setSelectedCompany("");
    setCustomCompany("");
    setResetMode(null);
    setSelectedPane("pending");
    setSelectedLeadType("new");
    setSelectedSourceId("");
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
    setSelectedSourceId("");
    setModalStep("source");
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
    setSelectedSourceId("");
    setModalStep("source");
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
    setSelectedSourceId("");
    setModalStep("source");
    setSelectedCSRs(csrs.filter(c => c.isActive).map(c => c.id));
    setShowCSRModal(true);
  };

  const finalCompany = selectedCompany === "Other" ? customCompany : selectedCompany;

  const buildUploadFormData = (forPreview = false) => {
    if (!selectedFile) return null;
    const formData = new FormData();
    formData.append("file", selectedFile);
    const csrIds = selectedCSRs.length > 0
      ? selectedCSRs
      : forPreview
        ? csrs.filter(c => c.isActive).map(c => c.id)
        : selectedCSRs;
    formData.append("selectedCSRs", JSON.stringify(csrIds));
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
    if (selectedSourceId) formData.append("sourceId", selectedSourceId);
    return formData;
  };

  const fetchFilePreview = async () => {
    const formData = buildUploadFormData(true);
    if (!formData) return;
    setFilePreviewLoading(true);
    try {
      const res = await API.post("/uploads/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setFilePreviewRows((res.data.preview ?? []) as PreviewRow[]);
      setFilePreviewSummary((res.data.summary ?? null) as PreviewSummary | null);
      setPreviewFilter("all");
    } catch {
      setFilePreviewRows([]);
      setFilePreviewSummary(null);
    } finally {
      setFilePreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!showCSRModal || modalStep !== "csrs" || !selectedFile) {
      if (!showCSRModal) {
        setFilePreviewRows([]);
        setFilePreviewSummary(null);
        setHideDupInPreview(true);
        setPreviewFilter("all");
      }
      return;
    }
    void fetchFilePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCSRModal, modalStep, selectedFile, selectedCSRs, uploadMode, selectedPane, selectedLeadType, selectedSourceId, finalCompany, resetMode]);

  const handleFiles = async () => {
    if (!selectedFile) return;
    /* company is optional for client uploads — comes from Excel rows */
    if (selectedPane !== "lead" && !finalCompany.trim()) { toast.error("Please enter company name"); return; }
    if (selectedCSRs.length === 0) { toast.error("Select at least one CSR"); return; }

    const formData = buildUploadFormData();
    if (!formData) return;
    const previewFormData = buildUploadFormData();
    if (!previewFormData) return;

    setShowCSRModal(false);
    setResultsExpanded(true);
    setPreviewLoading(true);
    setPreviewLive(true);
    setRowResults([]);
    setUploadSummary(null);
    setLastUploadName(selectedFile.name);
    setResultsFilter("all");
    setResultsPage(1);

    const tempId = Date.now();

    setFiles(prev => [{
      id: tempId, name: selectedFile.name,
      size: `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`,
      type: selectedFile.type, progress: 0, leads: 0,
      distributed: false, status: "Uploading",
      companyName: finalCompany.trim(),
    }, ...prev]);

    let processingInterval: ReturnType<typeof setInterval> | null = null;

    const previewPromise = API.post("/uploads/preview", previewFormData, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(res => {
      setRowResults((res.data.preview ?? []) as RowResult[]);
      setUploadSummary((res.data.summary ?? null) as UploadSummary | null);
      setPreviewLoading(false);
    }).catch(() => {
      setPreviewLoading(false);
    });

    try {
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

      await previewPromise;

      const created = res.data.totalLeads as number;
      const results = (res.data.rowResults ?? []) as RowResult[];
      const summary = (res.data.summary ?? null) as UploadSummary | null;
      setRowResults(results);
      setUploadSummary(summary);
      setPreviewLive(false);
      setPreviewLoading(false);
      setLastUploadName(selectedFile.name);
      setResultsFilter("all");
      setResultsPage(1);

      if (created === 0 && (summary?.duplicate ?? 0) > 0) {
        toast.error("No new leads added — all rows were duplicates or already in database.");
      } else if (created === 0) {
        toast.error("No leads were added from this file.");
      } else {
        const dupMsg = summary?.duplicate ? ` · ${summary.duplicate} duplicate(s) skipped` : "";
        toast.success(`${created} leads uploaded & distributed${dupMsg}`);
      }
      void fetchLatestUpload();
      void fetchUploadSources();
    } catch {
      if (processingInterval) clearInterval(processingInterval);
      setFiles(prev => prev.filter(f => f.id !== tempId));
      setPreviewLive(false);
      setPreviewLoading(false);
      toast.error("Upload failed");
    }
  };

  const removeFile = (id: number) => setFiles(prev => prev.filter(f => f.id !== id));

  const filteredResults = resultsFilter === "all"
    ? rowResults
    : rowResults.filter(r => r.status === resultsFilter);

  const previewTotalPages = Math.max(1, Math.ceil(filteredResults.length / PREVIEW_PAGE_SIZE));
  const safeResultsPage = Math.min(resultsPage, previewTotalPages);
  const paginatedResults = filteredResults.slice(
    (safeResultsPage - 1) * PREVIEW_PAGE_SIZE,
    safeResultsPage * PREVIEW_PAGE_SIZE,
  );
  const filterCount = (key: typeof resultsFilter) =>
    key === "all" ? rowResults.length : (uploadSummary?.[key] ?? rowResults.filter(r => r.status === key).length);
  const activeFilterLabel = RESULT_FILTER_OPTIONS.find(o => o.key === resultsFilter)?.label ?? "All";

  const sourceCompareChart = uploadSources.map(s => ({
    name: (() => {
      const label = sourceAdminLabel(s);
      return label.length > 10 ? `${label.slice(0, 10)}…` : label;
    })(),
    Pending: s.stats.pending,
    Interested: s.stats.interested,
    Important: s.stats.important,
    "Not Picked": s.stats.notPicked,
    Won: s.stats.projectWon,
  }));

  const selectedSourceStats = historySourceId === "all"
    ? null
    : uploadSources.find(s => s.id === historySourceId)?.stats ?? sourceDetail?.stats ?? null;

  const selectedSourceBreakdown = selectedSourceStats ? [
    { label: "Pending",      value: selectedSourceStats.pending,      color: "#0B84F3" },
    { label: "Interested",   value: selectedSourceStats.interested,   color: "#D97706" },
    { label: "Important",    value: selectedSourceStats.important,    color: "#B8112D" },
    { label: "Not Picked",   value: selectedSourceStats.notPicked,    color: "#B54708" },
    { label: "Project Won",  value: selectedSourceStats.projectWon, color: "#065F46" },
    { label: "Not Interested", value: selectedSourceStats.notInterested, color: "#94A3B8" },
  ] : [];

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
                   : modalStep === "source"  ? "Data Source"
                   : modalStep === "pane"    ? "Select CSR Pane"
                   : "Select CSRs"}
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5 sm:mt-1">
                  {modalStep === "category" ? "Where should this file's data go?"
                   : modalStep === "reset"   ? "What should happen to existing call data?"
                   : modalStep === "company" ? "Which company does this data belong to?"
                   : modalStep === "source"  ? "Source name is admin-only. Sudo name is what CSRs see on leads."
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
              const steps: readonly ModalStep[] = uploadMode !== "regular"
                ? ["source", "csrs"]
                : selectedPane === "lead"
                  ? ["category", "source", "csrs"]
                  : ["category", "reset", "company", "source", "csrs"];
              const labels = uploadMode !== "regular"
                ? ["Source", "CSRs"]
                : selectedPane === "lead"
                  ? ["Category", "Source", "CSRs"]
                  : ["Category", "Data Mode", "Company", "Source", "CSRs"];
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
                        setModalStep("source");
                      } else {
                        setResetMode(null);
                        setModalStep("reset");
                      }
                    }}
                    className="w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white font-semibold text-sm hover:bg-[#a30f27] transition-all"
                  >
                    Next — {selectedPane === "lead" ? "Select Source" : "Select Data Mode"}
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
                        setModalStep("source");
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

              {/* STEP — Upload Source (admin only) */}
              {modalStep === "source" && (
                <div className="space-y-3 sm:space-y-4">
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    Select where this data came from. Sudo name is shown to CSRs; source name is admin-only.
                  </p>

                  {uploadSources.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No sources yet — add your first one below.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-h-48 overflow-y-auto">
                      {uploadSources.map(src => {
                        const sel = selectedSourceId === src.id;
                        return (
                          <button
                            key={src.id}
                            onClick={() => setSelectedSourceId(src.id)}
                            className={`p-3 rounded-xl border-2 text-left transition-all ${
                              sel ? "border-[#B8112D] bg-[#FFF1F3]" : "border-gray-100 bg-[#FAFAFA] hover:border-gray-300"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Globe size={14} className={sel ? "text-[#B8112D]" : "text-gray-400"} />
                              <p className={`font-bold text-xs sm:text-sm truncate ${sel ? "text-[#B8112D]" : "text-gray-800"}`}>
                                {src.name}
                              </p>
                            </div>
                            {src.sudoName && (
                              <p className="text-[10px] text-gray-500 truncate mb-0.5">CSR: {src.sudoName}</p>
                            )}
                            <p className="text-[10px] text-gray-400">{src.stats.total} leads · {src.uploadCount} uploads</p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="border border-dashed border-gray-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-600">Add new source</p>
                    <input
                      type="text"
                      value={newSourceName}
                      onChange={e => setNewSourceName(e.target.value)}
                      placeholder="Source name (admin only)..."
                      className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#B8112D]"
                      onKeyDown={e => { if (e.key === "Enter") void addNewSource(); }}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSourceSudoName}
                        onChange={e => setNewSourceSudoName(e.target.value)}
                        placeholder="Sudo name (shown to CSRs)..."
                        className="flex-1 h-10 rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#B8112D]"
                        onKeyDown={e => { if (e.key === "Enter") void addNewSource(); }}
                      />
                      <button
                        onClick={() => void addNewSource()}
                        disabled={addingSource || !newSourceName.trim()}
                        className="h-10 px-4 rounded-xl bg-[#111827] text-white text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:gap-3">
                    <div className="flex gap-2 sm:gap-3">
                      <button
                        onClick={() => {
                          if (uploadMode !== "regular") { setShowCSRModal(false); return; }
                          setModalStep(selectedPane === "lead" ? "category" : "company");
                        }}
                        className="flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200 transition-all"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSourceId("");
                          setModalStep("csrs");
                        }}
                        className="h-10 sm:h-12 px-4 sm:px-5 rounded-xl sm:rounded-2xl border border-gray-200 text-gray-500 font-semibold text-sm hover:border-gray-300 hover:text-gray-700 transition-all"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedSourceId) { toast.error("Please select or add a source"); return; }
                          setModalStep("csrs");
                        }}
                        disabled={!selectedSourceId}
                        className={`flex-1 h-10 sm:h-12 rounded-xl sm:rounded-2xl font-semibold text-sm transition-all ${
                          selectedSourceId ? "bg-[#B8112D] text-white hover:bg-[#a30f27]" : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        Next — Select CSRs
                      </button>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-gray-400 text-center">
                      Skip if you don&apos;t want to assign a source or sudo name for this upload.
                    </p>
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

                  <UploadFilePreview
                    fileName={selectedFile?.name}
                    rows={filePreviewRows}
                    summary={filePreviewSummary}
                    loading={filePreviewLoading}
                    hideDuplicates={hideDupInPreview}
                    onToggleHideDuplicates={() => setHideDupInPreview(v => !v)}
                    filter={previewFilter}
                    onFilterChange={setPreviewFilter}
                  />

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
                      onClick={() => selectedPane === "lead" ? setModalStep("category") : setModalStep("source")}
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

      {/* ── UPLOAD HISTORY MODAL ── */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl lg:max-w-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between px-4 sm:px-6 pt-4 sm:pt-6 pb-3 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="text-lg sm:text-2xl font-semibold text-gray-800 flex items-center gap-2">
                  <History size={20} className="text-[#B8112D]" /> Upload History
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  Files grouped by type. Delete removes contacts from DB and CSR dashboards.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-all shrink-0"
              >
                <X size={15} />
              </button>
            </div>

            <div className="px-4 sm:px-6 pt-3 border-b border-gray-100 shrink-0">
              <div className="flex flex-wrap gap-1.5 sm:gap-2 pb-3">
                {HISTORY_CATEGORIES.map(cat => {
                  const count = historyCounts[cat.key] ?? 0;
                  const active = historyCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => switchHistoryCategory(cat.key)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all ${
                        active
                          ? "bg-[#B8112D] text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-4 sm:p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
                  <Loader2 size={20} className="animate-spin" /> Loading history...
                </div>
              ) : uploadHistory.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <History size={36} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">
                    {historyCategory === "all"
                      ? "No uploads yet"
                      : `No ${CATEGORY_LABEL_MAP[historyCategory]} uploads yet`}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadHistory.map(u => (
                    <div key={u.id} className="flex flex-col gap-3 p-3 sm:p-4 rounded-2xl border border-gray-100 bg-[#FAFAFA] hover:bg-white transition-all">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl bg-[#FFF1F3] flex items-center justify-center shrink-0">
                            <FileSpreadsheet size={18} className="text-[#B8112D]" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-gray-800 truncate">{u.fileName}</p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-gray-400">
                              {u.uploadCategory && (
                                <span className={`font-semibold ${HISTORY_CATEGORIES.find(c => c.key === u.uploadCategory)?.color ?? "text-gray-500"}`}>
                                  {CATEGORY_LABEL_MAP[u.uploadCategory as UploadCategoryKey] ?? u.uploadCategory}
                                </span>
                              )}
                              {u.source ? (
                                <span className="text-[#B8112D] font-medium">{sourceAdminLabel(u.source)}</span>
                              ) : (
                                <span className="text-amber-600 font-medium">No source</span>
                              )}
                              {u.companyName && <span>· {u.companyName}</span>}
                              <span>· {u.linkedLeads} contacts in DB</span>
                              <span>· {new Date(u.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {assigningUploadId !== u.id && (
                            <button
                              onClick={() => openAssignSource(u.id)}
                              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFF1F3] text-[#B8112D] hover:bg-[#FFE4E8] text-xs font-semibold transition-all"
                            >
                              {u.source ? "Change Source" : "Assign Source"}
                            </button>
                          )}
                          <button
                            onClick={() => void deleteHistoryUpload(u.id, u.fileName)}
                            disabled={deletingUploadId === u.id}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 text-xs font-semibold transition-all shrink-0 disabled:opacity-50"
                          >
                            {deletingUploadId === u.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />
                            }
                            Delete
                          </button>
                        </div>
                      </div>

                      {assigningUploadId === u.id && (
                        <div className="border border-[#B8112D]/20 bg-[#FFF6F8] rounded-xl p-3 sm:p-4 space-y-3">
                          <p className="text-xs font-semibold text-gray-600">
                            {u.source ? "Change source for this upload" : "Assign a source to this upload"}
                          </p>
                          {uploadSources.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {uploadSources.map(src => (
                                <button
                                  key={src.id}
                                  onClick={() => {
                                    setAssignSourceId(src.id);
                                    setAssignNewSourceName("");
                                    setAssignNewSourceSudoName("");
                                  }}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                                    assignSourceId === src.id
                                      ? "bg-[#B8112D] text-white"
                                      : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                                  }`}
                                >
                                  {sourceAdminLabel(src)}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={assignNewSourceName}
                              onChange={e => {
                                setAssignNewSourceName(e.target.value);
                                setAssignSourceId("");
                              }}
                              placeholder="Or new source name (admin)..."
                              className="h-9 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:border-[#B8112D]"
                            />
                            <input
                              type="text"
                              value={assignNewSourceSudoName}
                              onChange={e => setAssignNewSourceSudoName(e.target.value)}
                              placeholder="Sudo name (CSR)..."
                              className="h-9 rounded-xl border border-gray-200 px-3 text-xs outline-none focus:border-[#B8112D]"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={cancelAssignSource}
                              className="flex-1 h-9 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => void saveAssignSource(u.id)}
                              disabled={savingAssignId === u.id || (!assignSourceId && !assignNewSourceName.trim())}
                              className="flex-1 h-9 rounded-xl bg-[#B8112D] text-white text-xs font-semibold hover:bg-[#a30f27] disabled:opacity-40 flex items-center justify-center gap-1.5"
                            >
                              {savingAssignId === u.id ? <Loader2 size={14} className="animate-spin" /> : null}
                              Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
          <button
            onClick={openHistoryModal}
            className="inline-flex items-center justify-center gap-2 h-10 sm:h-12 px-4 sm:px-5 rounded-xl sm:rounded-2xl bg-[#B8112D] text-white font-semibold text-sm hover:bg-[#a30f27] transition-all shrink-0"
          >
            <History size={16} />
            Upload History
          </button>
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

        {/* ── SOURCE HISTORY (admin only — CSRs never see this) ── */}
        <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 p-4 sm:p-5 lg:p-6 shadow-sm mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base sm:text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Globe size={18} className="text-[#B8112D]" /> Source History & Analytics
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                Track performance by data source. Hidden from all CSR views.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setHistorySourceId("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                historySourceId === "all" ? "bg-[#B8112D] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All Sources
            </button>
            {uploadSources.map(s => (
              <button
                key={s.id}
                onClick={() => setHistorySourceId(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  historySourceId === s.id ? "bg-[#B8112D] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {sourceAdminLabel(s)} ({s.stats.total})
              </button>
            ))}
          </div>

          {uploadSources.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Upload with a source to see analytics here.</p>
          ) : historySourceId === "all" ? (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceCompareChart} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Pending"    fill="#0B84F3" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Interested" fill="#D97706" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Important"  fill="#B8112D" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Not Picked" fill="#B54708" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Won"        fill="#065F46" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {selectedSourceBreakdown.map(item => (
                  <div key={item.label} className="bg-[#FAFAFA] rounded-xl p-3 text-center">
                    <p className="text-[10px] text-gray-400 font-medium">{item.label}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: item.color }}>{item.value}</p>
                  </div>
                ))}
              </div>
              {sourceDetail && sourceDetail.uploads.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Upload history</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {sourceDetail.uploads.map(u => (
                      <div key={u.id} className="flex items-center justify-between text-xs bg-[#FAFAFA] rounded-xl px-3 py-2">
                        <span className="font-medium text-gray-700 truncate flex-1">{u.fileName}</span>
                        <span className="text-gray-400 shrink-0 ml-2">{u.totalLeads} leads</span>
                        <span className="text-gray-300 shrink-0 ml-2">{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {uploadSources.length > 0 && (
            <div className="border-t border-gray-100 pt-4 mt-4">
              <p className="text-xs font-semibold text-gray-500 mb-3">Manage Sources</p>
              <div className="space-y-2">
                {uploadSources.map(src => (
                  <div key={src.id} className="bg-[#FAFAFA] rounded-xl px-3 py-2.5">
                    {editingSourceId === src.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={editSourceName}
                            onChange={e => setEditSourceName(e.target.value)}
                            placeholder="Source name (admin)..."
                            className="h-9 rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-[#B8112D]"
                          />
                          <input
                            type="text"
                            value={editSourceSudoName}
                            onChange={e => setEditSourceSudoName(e.target.value)}
                            placeholder="Sudo name (CSR)..."
                            className="h-9 rounded-lg border border-gray-200 px-3 text-xs outline-none focus:border-[#B8112D]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={cancelEditSource}
                            className="flex-1 h-8 rounded-lg bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void saveEditSource(src.id)}
                            disabled={savingSourceId === src.id || !editSourceName.trim()}
                            className="flex-1 h-8 rounded-lg bg-[#B8112D] text-white text-xs font-semibold hover:bg-[#a30f27] disabled:opacity-40 flex items-center justify-center gap-1"
                          >
                            {savingSourceId === src.id ? <Loader2 size={12} className="animate-spin" /> : null}
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{sourceAdminLabel(src)}</p>
                          <p className="text-[10px] text-gray-400">{src.stats.total} leads · {src.uploadCount} uploads</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => startEditSource(src)}
                            className="w-8 h-8 rounded-lg bg-white border border-gray-200 text-gray-600 hover:border-gray-300 flex items-center justify-center"
                            title="Edit source"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => void deleteSource(src.id, src.name)}
                            disabled={deletingSourceId === src.id}
                            className="w-8 h-8 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center disabled:opacity-50"
                            title="Delete source"
                          >
                            {deletingSourceId === src.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />
                            }
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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

          {files.length === 0 && (
            <div className="p-10 sm:p-12 lg:p-14 text-center">
              <UploadCloud size={36} className="mx-auto text-[#B8112D] lg:w-[42px] lg:h-[42px]" />
              <p className="mt-3 sm:mt-4 text-gray-500 text-sm">No files uploaded yet</p>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {files.map(file => (
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

        {/* ── UPLOAD RESULTS — per-contact duplicate check ── */}
        {(rowResults.length > 0 || previewLoading || previewLive) && (
          <div className="bg-white rounded-2xl lg:rounded-3xl border border-gray-100 overflow-hidden shadow-sm mt-4 sm:mt-6">
            <div
              className="px-4 sm:px-5 py-3 sm:py-4 lg:p-5 border-b border-gray-100 cursor-pointer select-none"
              onClick={() => setResultsExpanded(v => !v)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  {resultsExpanded
                    ? <ChevronUp size={18} className="text-gray-400 shrink-0 mt-0.5" />
                    : <ChevronDown size={18} className="text-gray-400 shrink-0 mt-0.5" />
                  }
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 flex items-center gap-2">
                      {previewLive ? "Live Preview" : "Upload Results"} — {lastUploadName}
                      {previewLoading && <Loader2 size={16} className="animate-spin text-[#B8112D]" />}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                      {previewLoading
                        ? "Analyzing rows while upload processes..."
                        : "Each row checked against the database before import."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                  <div className="relative">
                    <button
                      onClick={() => setFilterDropdownOpen(v => !v)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-all"
                    >
                      {activeFilterLabel} ({filterCount(resultsFilter)})
                      <ChevronDown size={14} className={`transition-transform ${filterDropdownOpen ? "rotate-180" : ""}`} />
                    </button>
                    {filterDropdownOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setFilterDropdownOpen(false)} />
                        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-[150px]">
                          {RESULT_FILTER_OPTIONS.map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => {
                                setResultsFilter(opt.key);
                                setResultsPage(1);
                                setFilterDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50 ${
                                resultsFilter === opt.key ? "text-[#B8112D]" : "text-gray-600"
                              }`}
                            >
                              {opt.label} ({filterCount(opt.key)})
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!resultsExpanded && uploadSummary && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {RESULT_FILTER_OPTIONS.filter(o => o.key !== "all").map(opt => {
                    const count = filterCount(opt.key);
                    if (count === 0) return null;
                    const st = STATUS_STYLE[opt.key];
                    return (
                      <span
                        key={opt.key}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${st.bg} ${st.text}`}
                      >
                        {opt.label}: {count}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {resultsExpanded && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className={CSR_THEAD}>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                        <th className="px-4 py-3 font-semibold w-12">#</th>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold hidden sm:table-cell">Phone</th>
                        <th className="px-4 py-3 font-semibold hidden md:table-cell">Email</th>
                        <th className="px-4 py-3 font-semibold hidden lg:table-cell">Company</th>
                        <th className="px-4 py-3 font-semibold w-28">Status</th>
                        <th className="px-4 py-3 font-semibold hidden sm:table-cell">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {paginatedResults.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                            {previewLoading ? "Loading preview..." : "No rows match this filter."}
                          </td>
                        </tr>
                      ) : paginatedResults.map(row => {
                        const st = STATUS_STYLE[row.status];
                        return (
                          <tr key={row.row} className={`hover:bg-gray-50/80 ${row.status === "duplicate" ? "bg-red-50/40" : ""}`}>
                            <td className="px-4 py-2.5 text-gray-400 text-xs">{row.row}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-800">{row.name}</td>
                            <td className="px-4 py-2.5 text-gray-600 hidden sm:table-cell">{row.phone}</td>
                            <td className="px-4 py-2.5 text-gray-600 hidden md:table-cell truncate max-w-[180px]">{row.email}</td>
                            <td className="px-4 py-2.5 text-gray-600 hidden lg:table-cell">{row.company}</td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.text}`}>
                                {row.status === "duplicate" && <AlertCircle size={10} />}
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 hidden sm:table-cell">{row.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredResults.length > PREVIEW_PAGE_SIZE && (
                  <div className="px-4 sm:px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">
                      Showing {(safeResultsPage - 1) * PREVIEW_PAGE_SIZE + 1}–{Math.min(safeResultsPage * PREVIEW_PAGE_SIZE, filteredResults.length)} of {filteredResults.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setResultsPage(p => Math.max(1, p - 1))}
                        disabled={safeResultsPage <= 1}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                      >
                        Prev
                      </button>
                      <span className="text-xs text-gray-500 font-medium">
                        {safeResultsPage} / {previewTotalPages}
                      </span>
                      <button
                        onClick={() => setResultsPage(p => Math.min(previewTotalPages, p + 1))}
                        disabled={safeResultsPage >= previewTotalPages}
                        className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold text-gray-600 hover:bg-gray-200 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {uploadSummary && uploadSummary.duplicate > 0 && !previewLive && (
                  <div className="px-4 sm:px-5 py-3 bg-[#FFF7ED] border-t border-[#FED7AA]/50 flex items-start gap-2">
                    <AlertCircle size={14} className="text-[#B45309] mt-0.5 shrink-0" />
                    <p className="text-xs text-[#92400E]">
                      <strong>{uploadSummary.duplicate} duplicate contact(s)</strong> were skipped — they already exist in the database (matched by phone or email). Only new contacts were added.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}