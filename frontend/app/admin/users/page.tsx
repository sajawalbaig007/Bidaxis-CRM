"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, Plus, Users, Pencil, Trash2, Ban,
  MoreVertical, Eye, EyeOff, Wifi, WifiOff,
  Globe, RotateCcw, User2, KeyRound, ChevronDown,
} from "lucide-react";

import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import API, { getApiBase } from "@/lib/api";
import { invalidateAuthMeCache } from "@/lib/authMeCache";
import { CSR_THEAD } from "@/app/csr/components/shared/csrTableStyles";
import RequiredMark, { ReqLabel } from "@/app/components/form/RequiredMark";
import { PdfPreview } from "@/app/components/chat/MessageExtras";
import { FilterableTh, textColumnMatch, useColumnFilters } from "@/app/components/table/columnFilters";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import RechartsBox from "@/app/components/charts/RechartsBox";
import {
  ALL_CSR_RESET_SCOPE_IDS,
  CSR_RESET_GROUPS,
  scopeLabel,
  type CsrResetScopeId,
} from "@/lib/csrResetPages";
import { broadcastAdminSummaryStale } from "@/lib/adminSummaryCache";

type UserRole = "CSR" | "Admin" | "Manager" | "Technical Manager";

type User = {
  id: string; name: string; email: string; password: string;
  status: "Active" | "Inactive"; role: UserRole;
  csrCode:    string | null;
  cnic:       string | null;
  cnicPdfUrl: string | null;
  profilePic: string | null;
  isOnline: boolean; lastActive: string | null;
  browser:     string | null;
  tabId:       string | null;
  openedAt:    string | null;
  tabVisible:  boolean | null;
  hiddenAt:    string | null;
  allowedIps: string[];
  allowedMacAddress: string | null;
  temporaryAccessIp: string | null;
  temporaryAccessMac: string | null;
  temporaryAccessUntil: string | null;
};

type AccessHistoryRow = {
  id: string;
  event: string;
  ip: string | null;
  deviceId: string | null;
  browser: string | null;
  createdAt: string;
};

const apiBase = () => getApiBase();

const roleColor = (role: UserRole) => {
  if (role === "Admin") return "bg-blue-100 text-blue-600";
  if (role === "Manager") return "bg-violet-100 text-violet-600";
  if (role === "Technical Manager") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-600";
};

const formatLastActive = (iso: string | null): string => {
  if (!iso) return "Never";
  const diff  = Date.now() - new Date(iso).getTime();
  const secs  = Math.floor(diff / 1000);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  if (secs  < 30) return "Just now";
  if (mins  < 1)  return `${secs}s ago`;
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
};

const formatOpenedAt = (iso: string | null): string => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs  = Math.floor(diff / 3600000);
  if (mins < 1)  return "just opened";
  if (mins < 60) return `${mins}m ago`;
  return `${hrs}h ago`;
};


/* Browser badge */
function BrowserBadge({ browser }: { browser: string | null }) {
  if (!browser) return null;
  const colors: Record<string, string> = {
    Chrome:  "bg-yellow-50 text-yellow-700 border-yellow-200",
    Firefox: "bg-orange-50 text-orange-700 border-orange-200",
    Safari:  "bg-blue-50 text-blue-700 border-blue-200",
    Edge:    "bg-indigo-50 text-indigo-700 border-indigo-200",
    Opera:   "bg-red-50 text-red-700 border-red-200",
  };
  const cls = colors[browser] ?? "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${cls}`}>
      <Globe size={10}/>{browser}
    </span>
  );
}

const actionBtnBase =
  "rounded-xl flex items-center justify-center transition-all shrink-0";

const actionBtnStyles = {
  details: `${actionBtnBase} px-4 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-crm-muted dark:text-crm-text dark:hover:bg-crm-nav-pill`,
  edit:    `${actionBtnBase} w-9 h-9 bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60`,
  block:   `${actionBtnBase} w-9 h-9 bg-yellow-100 text-yellow-600 hover:bg-yellow-200 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-900/60`,
  unblock: `${actionBtnBase} w-9 h-9 bg-green-100 text-green-600 hover:bg-green-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60`,
  reset:   `${actionBtnBase} w-9 h-9 bg-orange-100 text-orange-600 hover:bg-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:hover:bg-orange-900/60`,
  password:`${actionBtnBase} w-9 h-9 bg-violet-100 text-violet-600 hover:bg-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-900/60`,
  delete:  `${actionBtnBase} w-9 h-9 bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-900/60`,
};

function ActionTip({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className: string;
  children: ReactNode;
}) {
  return (
    <div className="relative group shrink-0">
      <button type="button" onClick={onClick} aria-label={label} title={label} className={className}>
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute right-full top-1/2 -translate-y-1/2 mr-2 px-2 py-1 rounded-lg bg-[#111827] text-white text-[10px] font-semibold whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-opacity z-[200] shadow-lg dark:bg-[#eef0f4] dark:text-[#111827]"
      >
        {label}
      </span>
    </div>
  );
}

/* Tab status — On Dashboard vs Away */
/* ── Render elapsed seconds as human string ── */
function formatElapsed(totalSecs: number): string {
  if (totalSecs < 60)  return `${totalSecs}s`;
  const mins = Math.floor(totalSecs / 60);
  const s    = totalSecs % 60;
  if (mins < 60) return s > 0 ? `${mins}m ${s}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const m   = mins % 60;
  return m > 0 ? `${hrs}h ${m}m` : `${hrs}h`;
}

/* ── Away timer badge — live counting ── */
function AwayTimer({ hiddenAt, browser, now }: { hiddenAt: string | null; browser: string | null; now: number }) {
  const secs = hiddenAt ? Math.floor((now - new Date(hiddenAt).getTime()) / 1000) : 0;
  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[#FFF7E6] text-[#B45309]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]"/>
        Away · {formatElapsed(secs)}
      </span>
      <div className="flex items-center gap-1">
        {browser && <BrowserBadge browser={browser}/>}
        <span className="text-[10px] text-gray-400">not on dashboard</span>
      </div>
    </div>
  );
}

/* ── Tab status — On Dashboard or Away ── */
function TabStatusBadge({ tabVisible, hiddenAt, openedAt, browser, now }: {
  tabVisible: boolean | null; hiddenAt: string | null;
  openedAt: string | null; browser: string | null; now: number;
}) {
  if (tabVisible === null) return <span className="text-gray-300 text-xs">—</span>;

  if (tabVisible) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[#ECFDF3] text-[#027A48]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] animate-pulse"/>
          On Dashboard
        </span>
        <div className="flex items-center gap-1 flex-wrap">
          {browser && <BrowserBadge browser={browser}/>}
          {openedAt && <span className="text-[10px] text-gray-400">· {formatOpenedAt(openedAt)}</span>}
        </div>
      </div>
    );
  }

  return <AwayTimer hiddenAt={hiddenAt} browser={browser} now={now}/>;
}

/* ── Online/Offline badge — 5min offline → Inactive label ── */
function OnlineBadge({ isOnline, lastActive, now }: { isOnline: boolean; lastActive: string | null; now: number }) {
  const offlineSecs = !isOnline && lastActive ? Math.floor((now - new Date(lastActive).getTime()) / 1000) : 0;
  const isLongOffline = !isOnline && offlineSecs > 5 * 60; // > 5 minutes

  if (isOnline) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[#ECFDF3] text-[#027A48]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] animate-pulse"/>
        Online
      </div>
    );
  }

  if (isLongOffline) {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-red-100 text-red-600">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400"/>
          Inactive
        </div>
        <span className="text-[10px] text-gray-400 pl-1">offline {formatElapsed(offlineSecs)}</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[#F4F4F5] text-[#52525B]">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"/>
      {formatLastActive(lastActive)}
    </div>
  );
}

const PAGE_SIZE = 30;

export default function UsersPage() {
  const [now, setNow] = useState(() => Date.now());

  const [users,        setUsers]        = useState<User[]>([]);
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [roleFilter,   setRoleFilter]   = useState<"All" | UserRole>("All");
  const [showModal,    setShowModal]    = useState(false);
  const [editingUser,  setEditingUser]  = useState<User | null>(null);
  const [detailUser,   setDetailUser]   = useState<User | null>(null);
  const [openMenu,     setOpenMenu]     = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [pwUser, setPwUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [accessHistory, setAccessHistory] = useState<AccessHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editIpOpen, setEditIpOpen] = useState(false);
  const [detailIpOpen, setDetailIpOpen] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "CSR" as UserRole, csrCode: "", cnic: "", cnicPdfUrl: "", profilePic: "",
    allowedIps: [""], allowedMacAddress: "", temporaryAccessIp: "", temporaryAccessMac: "", temporaryAccessHours: "9",
  });
  const [uploadingPic, setUploadingPic] = useState(false);
  const [uploadingCnic, setUploadingCnic] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetScopes, setResetScopes] = useState<CsrResetScopeId[]>([...ALL_CSR_RESET_SCOPE_IDS]);
  const [resettingCsr, setResettingCsr] = useState(false);

  /* Single 1s tick — replaces per-row useLiveSeconds intervals */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchUsers = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res  = await fetch(`${apiBase()}/users`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { if (!silent) toast.error("Failed to fetch users."); return; }

      const formatted: User[] = (Array.isArray(data) ? data : []).map((u: {
        id: string; name: string; email: string; role: string; csrCode?: string;
        cnic?: string; cnicPdfUrl?: string; profilePic?: string;
        isActive?: boolean; isOnline?: boolean; lastActive?: string;
        browser?: string; tabId?: string; openedAt?: string;
        tabVisible?: boolean; hiddenAt?: string;
        allowedIps?: string[];
        allowedMacAddress?: string | null;
        temporaryAccessIp?: string | null;
        temporaryAccessMac?: string | null;
        temporaryAccessUntil?: string | null;
      }) => ({
        id:         u.id,
        name:       u.name,
        email:      u.email,
        role:       u.role === "csr" ? "CSR"
                  : u.role === "manager" ? "Manager"
                  : u.role === "technical_manager" ? "Technical Manager"
                  : "Admin",
        csrCode:    u.csrCode    ?? null,
        cnic:       u.cnic       ?? null,
        cnicPdfUrl: u.cnicPdfUrl ?? null,
        profilePic: u.profilePic ?? null,
        status:     u.isActive === false ? "Inactive" : "Active",
        isOnline:   u.isOnline   ?? false,
        lastActive: u.lastActive ?? null,
        password:   "",
        browser:    u.browser    ?? null,
        tabId:      u.tabId      ?? null,
        openedAt:   u.openedAt   ?? null,
        tabVisible: u.tabVisible ?? null,
        hiddenAt:   u.hiddenAt   ?? null,
        allowedIps: Array.isArray(u.allowedIps) && u.allowedIps.length > 0 ? u.allowedIps : [""],
        allowedMacAddress: u.allowedMacAddress ?? null,
        temporaryAccessIp: u.temporaryAccessIp ?? null,
        temporaryAccessMac: u.temporaryAccessMac ?? null,
        temporaryAccessUntil: u.temporaryAccessUntil ?? null,
      }));

      setUsers(formatted);
    } catch {
      if (!silent) toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => { await fetchUsers(); };
    load();
  }, [fetchUsers]);

  useEffect(() => {
    const target = detailUser ?? editingUser;
    if (!target) {
      setAccessHistory([]);
      return;
    }
    setLoadingHistory(true);
    API.get(`/admin/access-history/${target.id}?limit=30`)
      .then(res => setAccessHistory(res.data.history ?? []))
      .catch(() => setAccessHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [detailUser, editingUser]);

  useEffect(() => {
    if (!detailUser) setDetailIpOpen(false);
  }, [detailUser]);

  const totalUsers   = users.length;
  const onlineNow    = users.filter(u => u.isOnline).length;
  const activeCSR    = users.filter(u => u.role === "CSR"   && u.isOnline).length;
  const activeAdmins = users.filter(u => u.role === "Admin" && u.isOnline).length;
  const activeManagers = users.filter(u => u.role === "Manager" && u.isOnline).length;
  const activeTechManagers = users.filter(u => u.role === "Technical Manager" && u.isOnline).length;
  const countByRole = {
    All: users.length,
    CSR: users.filter(u => u.role === "CSR").length,
    Admin: users.filter(u => u.role === "Admin").length,
    Manager: users.filter(u => u.role === "Manager").length,
    "Technical Manager": users.filter(u => u.role === "Technical Manager").length,
  };

  const filteredUsers = users.filter(u => {
    if (roleFilter !== "All" && u.role !== roleFilter) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const userColPredicates = useMemo(() => ({
    user:    (u: User, v: string) => textColumnMatch(u.name, v) || textColumnMatch(u.email, v),
    role:    (u: User, v: string) => textColumnMatch(u.role, v),
    online:  (u: User, v: string) => textColumnMatch(u.isOnline ? "online" : "offline", v),
    browser: (u: User, v: string) => textColumnMatch(u.browser, v),
    account: (u: User, v: string) => textColumnMatch(u.status, v),
  }), []);

  const { filters: userColFilters, setFilter: setUserColFilter, filtered: colFilteredUsers } =
    useColumnFilters(filteredUsers, userColPredicates);

  const totalPagesUsers = Math.max(1, Math.ceil(colFilteredUsers.length / PAGE_SIZE));
  const paginatedUsers  = colFilteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePicUpload = async (file: File) => {
    setUploadingPic(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(`${apiBase()}/users/upload-pic`, { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error("Image upload failed."); return; }
      setForm(f => ({ ...f, profilePic: data.url }));
    } catch { toast.error("Upload failed."); } finally { setUploadingPic(false); }
  };

  const handleCnicUpload = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed for CNIC.");
      return;
    }
    setUploadingCnic(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(`${apiBase()}/users/upload-cnic`, { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "CNIC PDF upload failed."); return; }
      setForm(f => ({ ...f, cnicPdfUrl: data.url }));
      toast.success("CNIC PDF uploaded.");
    } catch { toast.error("Upload failed."); } finally { setUploadingCnic(false); }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.email || (!editingUser && !form.password)) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (form.role === "CSR" && !form.csrCode.trim()) {
      toast.error("CSR Code is required for CSR accounts.");
      return;
    }
    try {
      const role =
        form.role === "CSR" ? "csr"
        : form.role === "Manager" ? "manager"
        : form.role === "Technical Manager" ? "technical_manager"
        : "admin";
      const url    = editingUser ? `${apiBase()}/users/${editingUser.id}` : `${apiBase()}/auth/register`;
      const method = editingUser ? "PUT" : "POST";
      const shared = {
        name: form.name, email: form.email, role,
        csrCode:    role === "csr" ? form.csrCode.trim() : null,
        cnic:       form.cnic.trim() || null,
        cnicPdfUrl: form.cnicPdfUrl || null,
        profilePic: form.profilePic  || null,
        allowedIps: form.allowedIps.map(v => v.trim()).filter(Boolean).slice(0, 5),
        allowedMacAddress: null,
        temporaryAccessIp: form.temporaryAccessIp.trim() || null,
        temporaryAccessMac: null,
        temporaryAccessHours: Number(form.temporaryAccessHours || "9"),
      };
      const body = editingUser ? shared : { ...shared, password: form.password };

      const res  = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Operation failed."); return; }

      toast.success(editingUser ? "User updated." : "User created.");
      invalidateAuthMeCache();
      fetchUsers();
      setShowModal(false); setEditingUser(null);
      setForm({ name: "", email: "", password: "", role: "CSR", csrCode: "", cnic: "", cnicPdfUrl: "", profilePic: "", allowedIps: [""], allowedMacAddress: "", temporaryAccessIp: "", temporaryAccessMac: "", temporaryAccessHours: "9" });
      setShowPassword(false);
    } catch {
      toast.error("Something went wrong.");
    }
  };

  const handleDelete = async (id: string) => {
    toast(t => (
      <div className="flex flex-col gap-3 min-w-[200px]">
        <p className="font-semibold text-[#111827]">Delete this user?</p>
        <div className="flex gap-2">
          <button onClick={async () => {
            toast.dismiss(t.id);
            const tid = toast.loading("Deleting...");
            try {
              const res  = await fetch(`${apiBase()}/users/${id}`, { method: "DELETE", credentials: "include" });
              const data = await res.json();
              if (!res.ok) { toast.error(data.message || "Delete failed.", { id: tid }); return; }
              toast.success("User deleted.", { id: tid });
              broadcastAdminSummaryStale();
              fetchUsers();
            } catch { toast.error("Something went wrong.", { id: tid }); }
          }} className="flex-1 rounded-xl bg-[#B8112D] py-2 text-sm font-semibold text-white">Delete</button>
          <button onClick={() => toast.dismiss(t.id)} className="flex-1 rounded-xl bg-gray-100 py-2 text-sm font-semibold text-gray-600">Cancel</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const openResetModal = (user: User) => {
    setResetScopes([...ALL_CSR_RESET_SCOPE_IDS]);
    setResetUser(user);
  };

  const toggleResetScope = (scopeId: CsrResetScopeId) => {
    setResetScopes(prev =>
      prev.includes(scopeId)
        ? prev.filter(id => id !== scopeId)
        : [...prev, scopeId],
    );
  };

  const isGroupFullySelected = (groupId: string) => {
    const group = CSR_RESET_GROUPS.find(g => g.id === groupId);
    if (!group) return false;
    return group.children.every(c => resetScopes.includes(c.id));
  };

  const isGroupPartiallySelected = (groupId: string) => {
    const group = CSR_RESET_GROUPS.find(g => g.id === groupId);
    if (!group) return false;
    const selected = group.children.filter(c => resetScopes.includes(c.id)).length;
    return selected > 0 && selected < group.children.length;
  };

  const toggleResetGroup = (groupId: string) => {
    const group = CSR_RESET_GROUPS.find(g => g.id === groupId);
    if (!group) return;
    const childIds = group.children.map(c => c.id);
    if (isGroupFullySelected(groupId)) {
      setResetScopes(prev => prev.filter(id => !childIds.includes(id)));
    } else {
      setResetScopes(prev => [...new Set([...prev, ...childIds])]);
    }
  };

  const allResetScopesSelected = resetScopes.length === ALL_CSR_RESET_SCOPE_IDS.length;

  const toggleAllResetScopes = () => {
    setResetScopes(allResetScopesSelected ? [] : [...ALL_CSR_RESET_SCOPE_IDS]);
  };

  const runCsrReset = async () => {
    if (!resetUser || resetScopes.length === 0) {
      toast.error("Select at least one page or sub-page to reset.");
      return;
    }

    setResettingCsr(true);
    const tid = toast.loading(`Resetting ${resetUser.name}'s data (${resetScopes.length} selected)...`);
    try {
      const res = await fetch(`${apiBase()}/admin/csr-leads/${resetUser.id}/reset`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages: resetScopes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Reset failed.", { id: tid });
        return;
      }
      if (data.warning) {
        toast.error(data.warning, { id: tid, duration: 8000 });
        return;
      }
      const labels = (data.scopes as string[] | undefined ?? data.pages as string[] | undefined)
        ?.slice(0, 4)
        .map(scopeLabel)
        .join(", ");
      const more = resetScopes.length > 4 ? ` +${resetScopes.length - 4} more` : "";
      toast.success(
        `Reset complete for ${resetUser.name}: ${data.deleted ?? 0} leads removed${labels ? ` (${labels}${more})` : ""}.`,
        { id: tid, duration: 6000 },
      );
      broadcastAdminSummaryStale();
      setResetUser(null);
    } catch {
      toast.error("Reset timed out or failed. Try fewer sections and retry.", { id: tid });
    } finally {
      setResettingCsr(false);
    }
  };

  const handleResetCSR = (user: User) => {
    openResetModal(user);
  };

  const toggleStatus = async (user: User) => {
    const newActive = user.status !== "Active";
    try {
      const res = await fetch(`${apiBase()}/users/${user.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newActive }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Status update failed."); return; }
      toast.success(newActive ? "User activated." : "User blocked.");
      fetchUsers();
    } catch { toast.error("Something went wrong."); }
  };

  const openPasswordModal = (user: User) => {
    setPwUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
  };

  const closePasswordModal = () => {
    setPwUser(null);
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
  };

  const handlePasswordSubmit = async () => {
    if (!pwUser) return;
    if (!newPassword || !confirmPassword) {
      toast.error("Enter and confirm the new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`${apiBase()}/users/${pwUser.id}/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to update password.");
        return;
      }
      toast.success(`Password updated for ${pwUser.name}. They must sign in again.`);
      closePasswordModal();
      fetchUsers(true);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius:"16px", fontFamily:"inherit", fontSize:"14px" },
        success: { iconTheme:{ primary:"#027A48", secondary:"#fff" } },
        error:   { iconTheme:{ primary:"#B8112D", secondary:"#fff" } },
      }}/>

      <DashboardSidebar/>

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[64px]">
        <DashboardNavbar/>

        {/* USER ACTIVITY CHART */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-[#111827] text-base">User Activity Overview</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                User presence overview
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#12B76A] inline-block"/>Online</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#E5E7EB] inline-block"/>Offline</span>
            </div>
          </div>
          {loading ? (
            <div className="h-[150px] bg-gray-50 rounded-2xl animate-pulse" />
          ) : (
            <RechartsBox height={150}>
              <BarChart
                data={[
                  { name: "CSR",   online: activeCSR,      offline: countByRole.CSR - activeCSR },
                  { name: "Admin", online: activeAdmins,   offline: countByRole.Admin - activeAdmins },
                  { name: "Manager", online: activeManagers, offline: countByRole.Manager - activeManagers },
                  { name: "Tech Mgr", online: activeTechManagers, offline: countByRole["Technical Manager"] - activeTechManagers },
                ]}
                barGap={8} barSize={52}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false}/>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize:13, fontWeight:700, fill:"#374151" }}/>
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize:11, fill:"#9CA3AF" }} width={28}/>
                <Tooltip contentStyle={{ borderRadius:"14px", border:"1px solid #e5e7eb", fontSize:"12px", boxShadow:"0 4px 20px rgba(0,0,0,0.08)" }}/>
                <Bar dataKey="online"  fill="#12B76A" radius={[7,7,0,0]} name="Online"/>
                <Bar dataKey="offline" fill="#E5E7EB" radius={[7,7,0,0]} name="Offline"/>
              </BarChart>
            </RechartsBox>
          )}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
            {[
              { label:"Total Users",    value: totalUsers,   color:"text-[#111827]" },
              { label:"Online Now",     value: onlineNow,    color:"text-green-600" },
              { label:"CSR Online",     value: activeCSR,    color:"text-[#B8112D]" },
              { label:"Admins Online",  value: activeAdmins, color:"text-blue-600"  },
            ].map(s => (
              <div key={s.label} className="text-center">
                {loading
                  ? <div className="h-7 w-8 bg-gray-100 rounded-lg animate-pulse mx-auto mb-1"/>
                  : <p className={`text-xl sm:text-2xl font-bold ${s.color}`}>{s.value}</p>
                }
                <p className="text-[11px] text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SEARCH + CREATE */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="relative w-full sm:w-[300px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search users..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"/>
          </div>
          <button onClick={() => { setEditingUser(null); setForm({ name:"", email:"", password:"", role:"CSR", csrCode:"", cnic:"", cnicPdfUrl:"", profilePic:"", allowedIps:[""], allowedMacAddress:"", temporaryAccessIp:"", temporaryAccessMac:"", temporaryAccessHours:"9" }); setShowModal(true); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all">
            <Plus size={16}/>Create User
          </button>
        </div>

        {/* ROLE TABS — view CSR / Admin / Manager separately */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {([
            { id: "All" as const, label: "All Users" },
            { id: "CSR" as const, label: "CSR" },
            { id: "Admin" as const, label: "Admin" },
            { id: "Manager" as const, label: "Manager" },
            { id: "Technical Manager" as const, label: "Technical Manager" },
          ]).map(tab => {
            const active = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setRoleFilter(tab.id); setPage(1); }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  active
                    ? "bg-[#B8112D] text-white border-[#B8112D] shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-[#B8112D]/40 hover:text-[#B8112D]"
                }`}
              >
                {tab.label}
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                  active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {countByRole[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* TABLE */}
        <div className="bg-white border border-gray-100 rounded-3xl overflow-x-auto">
          <div className="min-w-[700px]">
            <table className="w-full">
              <thead className={CSR_THEAD}>
                <tr className="text-left text-sm text-crm-text-faint">
                  <FilterableTh title="User" filter={userColFilters.user ?? ""} onFilter={v => { setUserColFilter("user", v); setPage(1); }} className="px-6 py-4 font-medium" placeholder="Name/email…" />
                  <FilterableTh title="Role" filter={userColFilters.role ?? ""} onFilter={v => { setUserColFilter("role", v); setPage(1); }} className="px-6 py-4 font-medium" placeholder="Role…" />
                  <FilterableTh title="Online Status" filter={userColFilters.online ?? ""} onFilter={v => { setUserColFilter("online", v); setPage(1); }} className="px-6 py-4 font-medium" placeholder="Online…" />
                  <FilterableTh title="Browser / Tab" filter={userColFilters.browser ?? ""} onFilter={v => { setUserColFilter("browser", v); setPage(1); }} className="px-6 py-4 font-medium" placeholder="Browser…" />
                  <FilterableTh title="Account" filter={userColFilters.account ?? ""} onFilter={v => { setUserColFilter("account", v); setPage(1); }} className="px-6 py-4 font-medium" placeholder="Status…" />
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [1,2,3,4].map(i => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-gray-100 animate-pulse"/>
                          <div className="space-y-1.5">
                            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse"/>
                            <div className="h-3 w-24 bg-gray-100 rounded animate-pulse"/>
                          </div>
                        </div>
                      </td>
                      {[1,2,3,4,5].map(j => (
                        <td key={j} className="px-6 py-5"><div className="h-6 w-20 bg-gray-100 rounded-xl animate-pulse"/></td>
                      ))}
                    </tr>
                  ))
                ) : paginatedUsers.length > 0 ? paginatedUsers.map(u => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-[#FAFAFB] transition-all">

                    {/* USER */}
                    <td className="px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm relative overflow-hidden ${u.profilePic ? "" : roleColor(u.role)}`}>
                          {u.profilePic
                            ? <img src={u.profilePic} alt={u.name} className="w-full h-full object-cover" />
                            : u.name.charAt(0).toUpperCase()
                          }
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${u.isOnline ? "bg-[#12B76A]" : "bg-gray-300"}`}/>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-700">{u.name}</h3>
                            {u.role === "CSR" && u.csrCode && (
                              <span className="inline-flex items-center bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-2 py-0.5 rounded-lg tracking-wider">
                                {u.csrCode}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{u.email}</p>
                          {u.cnic && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{u.cnic}</p>}
                        </div>
                      </div>
                    </td>

                    {/* ROLE */}
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${roleColor(u.role)}`}>{u.role}</span>
                    </td>

                    {/* ONLINE STATUS */}
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <OnlineBadge isOnline={u.isOnline} lastActive={u.lastActive} now={now}/>
                    </td>

                    {/* BROWSER / TAB STATUS */}
                    <td className="px-4 sm:px-6 py-4">
                      {u.isOnline ? (
                        <TabStatusBadge
                          tabVisible={u.tabVisible}
                          hiddenAt={u.hiddenAt}
                          openedAt={u.openedAt}
                          browser={u.browser}
                          now={now}
                        />
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* ACCOUNT STATUS */}
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        u.status === "Active"
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}>{u.status}</span>
                    </td>

                    {/* ACTIONS */}
                    <td className="px-4 sm:px-6 py-4 overflow-visible">
                      <div className="hidden md:flex items-center justify-end gap-2">
                        <ActionTip label="View Details" onClick={() => setDetailUser(u)} className={actionBtnStyles.details}>
                          Details
                        </ActionTip>
                        <ActionTip
                          label="Edit User"
                          onClick={() => { setEditingUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role, csrCode: u.csrCode ?? "", cnic: u.cnic ?? "", cnicPdfUrl: u.cnicPdfUrl ?? "", profilePic: u.profilePic ?? "", allowedIps: u.allowedIps?.length ? u.allowedIps : [""], allowedMacAddress: u.allowedMacAddress ?? "", temporaryAccessIp: u.temporaryAccessIp ?? "", temporaryAccessMac: u.temporaryAccessMac ?? "", temporaryAccessHours: "9" }); setShowModal(true); }}
                          className={actionBtnStyles.edit}
                        >
                          <Pencil size={16}/>
                        </ActionTip>
                        <ActionTip
                          label="Change Password"
                          onClick={() => openPasswordModal(u)}
                          className={actionBtnStyles.password}
                        >
                          <KeyRound size={16}/>
                        </ActionTip>
                        <ActionTip
                          label={u.status === "Active" ? "Block User" : "Unblock User"}
                          onClick={() => toggleStatus(u)}
                          className={u.status === "Active" ? actionBtnStyles.block : actionBtnStyles.unblock}
                        >
                          <Ban size={16}/>
                        </ActionTip>
                        {u.role === "CSR" && (
                          <ActionTip
                            label="Reset CSR Data"
                            onClick={() => handleResetCSR(u)}
                            className={actionBtnStyles.reset}
                          >
                            <RotateCcw size={16}/>
                          </ActionTip>
                        )}
                        <ActionTip
                          label="Delete User"
                          onClick={() => handleDelete(u.id)}
                          className={actionBtnStyles.delete}
                        >
                          <Trash2 size={16}/>
                        </ActionTip>
                      </div>
                      <div className="relative md:hidden flex justify-end">
                        <button onClick={() => setOpenMenu(openMenu === u.id ? null : u.id)}
                          className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center bg-white">
                          <MoreVertical size={18}/>
                        </button>
                        {openMenu === u.id && (
                          <div className="absolute right-0 top-11 w-48 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden z-50">
                            {[
                              { label:"View Details", action:() => { setDetailUser(u); setOpenMenu(null); }},
                              { label:"Edit User",    action:() => { setEditingUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role, csrCode: u.csrCode ?? "", cnic: u.cnic ?? "", cnicPdfUrl: u.cnicPdfUrl ?? "", profilePic: u.profilePic ?? "", allowedIps: u.allowedIps?.length ? u.allowedIps : [""], allowedMacAddress: u.allowedMacAddress ?? "", temporaryAccessIp: u.temporaryAccessIp ?? "", temporaryAccessMac: u.temporaryAccessMac ?? "", temporaryAccessHours: "9" }); setShowModal(true); setOpenMenu(null); }},
                              { label:"Change Password", action:() => { openPasswordModal(u); setOpenMenu(null); }},
                              { label: u.status==="Active" ? "Block User" : "Unblock User", action:() => { toggleStatus(u); setOpenMenu(null); }},
                            ].map(({ label, action }) => (
                              <button key={label} onClick={action} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-all">{label}</button>
                            ))}
                            {u.role === "CSR" && (
                              <button onClick={() => { handleResetCSR(u); setOpenMenu(null); }}
                                className="w-full text-left px-4 py-3 text-sm text-orange-600 hover:bg-orange-50 transition-all">Reset Data</button>
                            )}
                            <button onClick={() => { handleDelete(u.id); setOpenMenu(null); }}
                              className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all">Delete User</button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan={6} className="py-16 text-center text-gray-400">No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPagesUsers > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, colFilteredUsers.length)} of {colFilteredUsers.length}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">‹</button>
                <span className="text-sm font-semibold text-gray-700 min-w-[60px] text-center">{page} / {totalPagesUsers}</span>
                <button onClick={() => setPage(p => Math.min(totalPagesUsers, p + 1))} disabled={page === totalPagesUsers}
                  className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center text-lg transition-all">›</button>
              </div>
            </div>
          )}
        </div>

        {/* DETAIL MODAL */}
        {detailUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <div className="bg-white w-full rounded-3xl max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-4">
              <div className="p-6 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                <div className={`relative w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${roleColor(detailUser.role)}`}>
                  {detailUser.name.charAt(0).toUpperCase()}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${detailUser.isOnline ? "bg-[#12B76A]" : "bg-gray-300"}`}/>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{detailUser.name}</h2>
                  <p className="text-sm text-gray-400">{detailUser.role}</p>
                </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-3">
                {[
                  { label:"Email",          value: detailUser.email  },
                  { label:"Role",           value: detailUser.role   },
                  { label:"Account Status", value: detailUser.status },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F8F9FC] rounded-2xl p-4">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <h3 className="text-sm font-medium text-gray-700">{value}</h3>
                  </div>
                ))}

                {(detailUser.cnic || detailUser.cnicPdfUrl) && (
                  <div className="bg-[#F8F9FC] rounded-2xl p-4">
                    <p className="text-xs text-gray-400 mb-1">CNIC</p>
                    {detailUser.cnic && (
                      <p className="text-sm font-mono font-medium text-gray-700">{detailUser.cnic}</p>
                    )}
                    {detailUser.cnicPdfUrl && (
                      <div className="mt-3">
                        {/\.(png|jpe?g|webp|gif)(\?|$)/i.test(detailUser.cnicPdfUrl) ? (
                          <img
                            src={detailUser.cnicPdfUrl}
                            alt="CNIC"
                            className="w-full max-h-44 object-contain rounded-xl border border-gray-200 bg-white"
                          />
                        ) : (
                          <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
                            <iframe
                              src={detailUser.cnicPdfUrl}
                              title="CNIC document"
                              className="w-full h-44"
                            />
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <PdfPreview url={detailUser.cnicPdfUrl} fileName="CNIC document" />
                          <a
                            href={detailUser.cnicPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-[#B8112D] hover:underline"
                          >
                            Open in new tab
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-[#F8F9FC] rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Access Policy</p>
                  <p className="text-xs text-gray-600">
                    In-house IPs: {detailUser.allowedIps.filter(Boolean).length > 0 ? detailUser.allowedIps.filter(Boolean).join(", ") : "Any"}
                  </p>
                  {detailUser.temporaryAccessIp && (
                    <p className="text-xs text-amber-700 mt-2">
                      Temporary IP: {detailUser.temporaryAccessIp}{" "}
                      {detailUser.temporaryAccessUntil ? `(expires ${new Date(detailUser.temporaryAccessUntil).toLocaleString()})` : ""}
                    </p>
                  )}
                </div>

                <div className="bg-[#F8F9FC] rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Password</p>
                  <h3 className="text-sm font-medium text-gray-700">Encrypted (bcrypt hash in database)</h3>
                </div>

                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDetailIpOpen(v => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#F8F9FC] text-left"
                  >
                    <div>
                      <span className="text-sm font-semibold text-gray-700">IP Access History</span>
                      {!detailIpOpen && accessHistory.length > 0 && (
                        <span className="ml-2 text-[10px] font-semibold text-gray-400">
                          ({accessHistory.length} record{accessHistory.length === 1 ? "" : "s"})
                        </span>
                      )}
                    </div>
                    <ChevronDown size={16} className={`text-gray-400 transition-transform shrink-0 ${detailIpOpen ? "rotate-180" : ""}`} />
                  </button>
                  {detailIpOpen && (
                    <div className="p-4">
                      {loadingHistory ? (
                        <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                      ) : accessHistory.length === 0 ? (
                        <p className="text-xs text-gray-400">No access records yet.</p>
                      ) : (
                        <div className="overflow-x-auto -mx-1 max-h-52 overflow-y-auto">
                          <table className="w-full text-[11px]">
                            <thead className="sticky top-0 bg-[#F8F9FC]">
                              <tr className="text-left text-gray-400 border-b border-gray-200">
                                <th className="pb-2 pr-2 font-medium">When</th>
                                <th className="pb-2 pr-2 font-medium">Event</th>
                                <th className="pb-2 pr-2 font-medium">IP</th>
                                <th className="pb-2 font-medium">Browser</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accessHistory.map(row => (
                                <tr key={row.id} className="border-b border-gray-100 last:border-0">
                                  <td className="py-2 pr-2 text-gray-600 whitespace-nowrap">
                                    {new Date(row.createdAt).toLocaleString("en-GB", {
                                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                                    })}
                                  </td>
                                  <td className="py-2 pr-2 font-medium text-gray-700 capitalize">{row.event}</td>
                                  <td className="py-2 pr-2 font-mono text-gray-600">{row.ip ?? "—"}</td>
                                  <td className="py-2 text-gray-500">{row.browser ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ONLINE + BROWSER */}
                <div className={`rounded-2xl p-4 ${detailUser.isOnline ? "bg-[#ECFDF3]" : "bg-[#F4F4F5]"}`}>
                  <p className="text-xs text-gray-400 mb-2">Online Status</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {detailUser.isOnline
                        ? <><Wifi size={16} className="text-[#027A48]"/><span className="text-sm font-semibold text-[#027A48]">Online Now</span></>
                        : <><WifiOff size={16} className="text-gray-400"/><span className="text-sm font-semibold text-gray-500">Offline</span></>
                      }
                    </div>
                    {!detailUser.isOnline && detailUser.lastActive && (
                      <span className="text-xs text-gray-400">Last seen {formatLastActive(detailUser.lastActive)}</span>
                    )}
                  </div>
                  {detailUser.isOnline && detailUser.browser && (
                    <div className="mt-3 pt-3 border-t border-gray-100/50">
                      <TabStatusBadge
                        tabVisible={detailUser.tabVisible}
                        hiddenAt={detailUser.hiddenAt}
                        openedAt={detailUser.openedAt}
                        browser={detailUser.browser}
                        now={now}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 pt-4 shrink-0 border-t border-gray-100">
              <button onClick={() => setDetailUser(null)}
                className="w-full bg-[#B8112D] text-white py-3 rounded-2xl font-medium">
                Close
              </button>
              </div>
            </div>
          </div>
        )}

        {/* CHANGE PASSWORD MODAL */}
        {pwUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <div className="bg-white dark:bg-crm-surface w-full rounded-3xl max-w-md max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-crm-border-subtle my-4">
              <div className="p-6 pb-4 shrink-0">
                <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/50 text-violet-600 dark:text-violet-300 flex items-center justify-center">
                  <KeyRound size={18}/>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-crm-text">Change Password</h2>
                  <p className="text-xs text-gray-400 dark:text-crm-text-muted">{pwUser.name} · {pwUser.email}</p>
                </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-500 dark:text-crm-text-muted block mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 8 chars, upper, lower, number"
                      className="w-full border border-gray-200 dark:border-crm-border rounded-2xl px-4 py-3 pr-12 outline-none focus:border-[#B8112D] text-sm bg-white dark:bg-crm-input dark:text-crm-text"
                    />
                    <button type="button" onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-crm-text">
                      {showNewPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-500 dark:text-crm-text-muted block mb-2">Confirm Password</label>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full border border-gray-200 dark:border-crm-border rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] text-sm bg-white dark:bg-crm-input dark:text-crm-text"
                  />
                </div>
                <p className="text-[11px] text-gray-400 dark:text-crm-text-faint">
                  User will be signed out on all devices and must log in with the new password.
                </p>
              </div>
              </div>

              <div className="p-6 pt-4 shrink-0 border-t border-gray-100 dark:border-crm-border-subtle flex gap-3">
                <button type="button" onClick={closePasswordModal}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 dark:bg-crm-muted text-gray-600 dark:text-crm-text-secondary font-medium text-sm">
                  Cancel
                </button>
                <button type="button" onClick={handlePasswordSubmit} disabled={savingPassword}
                  className="flex-1 py-3 rounded-2xl bg-[#B8112D] text-white font-medium text-sm disabled:opacity-60">
                  {savingPassword ? "Saving…" : "Update Password"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE / EDIT MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="px-4 sm:px-6 pt-5 pb-3 shrink-0 border-b border-gray-100">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                  {editingUser ? "Edit User" : "Create User"}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Scroll down for access policy &amp; more fields</p>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-y-contain min-h-0 px-4 sm:px-6 py-4">
              <div className="space-y-4 pb-2">
                {[
                  { label:"Full Name",     key:"name",  type:"text",  placeholder:"Enter full name", req: true },
                  { label:"Email Address", key:"email", type:"email", placeholder:"Enter email",      req: true },
                ].map(({ label, key, type, placeholder, req }) => (
                  <div key={key}>
                    <label className="text-sm text-gray-500 block mb-2">{label}{req && <RequiredMark />}</label>
                    <input type={type} value={form[key as "name"|"email"]}
                      onChange={e => setForm({ ...form, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] text-sm"/>
                  </div>
                ))}
                {!editingUser && (
                  <div>
                    <label className="text-sm text-gray-500 block mb-2">Password<RequiredMark /></label>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} value={form.password}
                        onChange={e => setForm({ ...form, password: e.target.value })}
                        placeholder="Enter password"
                        className="w-full border border-gray-200 rounded-2xl px-4 py-3 pr-12 outline-none focus:border-[#B8112D] text-sm"/>
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                      </button>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-500 block mb-2">Role</label>
                  <select value={form.role}
                    onChange={e => setForm({ ...form, role: e.target.value as UserRole, csrCode: "" })}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] bg-white text-sm">
                    <option value="CSR">CSR (Customer Support)</option>
                    <option value="Manager">Manager</option>
                    <option value="Technical Manager">Technical Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                {form.role === "CSR" && (
                  <div>
                    <label className="text-sm text-gray-500 block mb-2">
                      CSR Code <span className="text-[#B8112D] font-semibold">*</span>
                      <span className="text-xs text-gray-400 ml-2">e.g. 1000, 1001, 1002…</span>
                    </label>
                    <input
                      type="text"
                      value={form.csrCode}
                      onChange={e => setForm({ ...form, csrCode: e.target.value })}
                      placeholder="e.g. 1000"
                      maxLength={10}
                      className="w-full border-2 border-[#B8112D]/30 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] text-sm font-mono font-bold tracking-wider"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Clients of this CSR will be coded as {form.csrCode || "XXXX"}-01, {form.csrCode || "XXXX"}-02…
                    </p>
                  </div>
                )}

                {/* CNIC */}
                <div>
                  <label className="text-sm text-gray-500 block mb-2">CNIC <span className="text-xs text-gray-400">(optional)</span></label>
                  <input
                    type="text"
                    value={form.cnic}
                    onChange={e => setForm({ ...form, cnic: e.target.value })}
                    placeholder="e.g. 12345-6789012-3"
                    maxLength={15}
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] text-sm font-mono"
                  />
                </div>

                {/* CNIC PDF */}
                <div>
                  <label className="text-sm text-gray-500 block mb-2">
                    CNIC Document (PDF) <span className="text-xs text-gray-400">(optional)</span>
                  </label>
                  <div className="flex flex-col gap-2">
                    {form.cnicPdfUrl ? (
                      <div className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-[#B8112D]/20 bg-[#FFF1F3]">
                        <a
                          href={form.cnicPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-[#B8112D] truncate hover:underline"
                        >
                          CNIC PDF uploaded — View
                        </a>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({ ...f, cnicPdfUrl: "" }))}
                          className="text-[11px] font-semibold text-gray-500 hover:text-[#B8112D] shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                    <label className="flex items-center justify-center gap-2 h-11 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#B8112D]/40 bg-[#FAFAFA] cursor-pointer text-xs font-semibold text-gray-600 hover:text-[#B8112D] transition-colors">
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        disabled={uploadingCnic}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) void handleCnicUpload(file);
                          e.target.value = "";
                        }}
                      />
                      {uploadingCnic ? "Uploading PDF…" : form.cnicPdfUrl ? "Replace CNIC PDF" : "Upload CNIC PDF"}
                    </label>
                    <p className="text-[11px] text-gray-400">Stored securely on cloud — max 10MB</p>
                  </div>
                </div>

                {/* Profile Picture */}
                <div>
                  <label className="text-sm text-gray-500 block mb-2">Profile Picture <span className="text-xs text-gray-400">(optional)</span></label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-gray-200 shrink-0 bg-gray-50 flex items-center justify-center mx-auto sm:mx-0">
                      {form.profilePic
                        ? <img src={form.profilePic} alt="Preview" className="w-full h-full object-cover" />
                        : <User2 size={22} className="text-gray-300" />
                      }
                    </div>
                    <div className="flex-1">
                      <label className={`flex items-center justify-center w-full py-2.5 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-sm font-medium ${uploadingPic ? "border-gray-200 text-gray-300 cursor-not-allowed" : "border-gray-200 text-gray-500 hover:border-[#B8112D] hover:text-[#B8112D]"}`}>
                        {uploadingPic ? "Uploading…" : form.profilePic ? "Change Photo" : "Upload Photo"}
                        <input type="file" accept="image/*" className="hidden" disabled={uploadingPic}
                          onChange={e => { const f = e.target.files?.[0]; if (f) void handlePicUpload(f); e.target.value = ""; }} />
                      </label>
                      {form.profilePic && (
                        <button type="button" onClick={() => setForm(f => ({ ...f, profilePic: "" }))}
                          className="text-[11px] text-red-400 hover:text-red-600 mt-1 w-full text-center transition-colors">
                          Remove photo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border border-gray-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-700">In-house Access Policy</p>
                      <p className="text-[11px] text-gray-400">Max 5 approved IPs</p>
                    </div>
                    {form.allowedIps.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, allowedIps: [...f.allowedIps, ""] }))}
                        className="w-7 h-7 rounded-lg bg-[#B8112D] text-white flex items-center justify-center"
                        title="Add IP field"
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {form.allowedIps.map((ip, idx) => (
                      <div key={`ip-${idx}`} className="flex items-center gap-2 min-w-0">
                        <input
                          type="text"
                          value={ip}
                          onChange={e => {
                            const value = e.target.value;
                            setForm(f => ({
                              ...f,
                              allowedIps: f.allowedIps.map((v, i) => (i === idx ? value : v)),
                            }));
                          }}
                          placeholder={`Approved IP ${idx + 1}`}
                          className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#B8112D]"
                        />
                        {form.allowedIps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setForm(f => ({ ...f, allowedIps: f.allowedIps.filter((_, i) => i !== idx) }))}
                            className="text-xs font-semibold text-red-500 shrink-0 px-1"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-amber-200 bg-amber-50 rounded-2xl p-4">
                  <p className="text-sm font-semibold text-amber-800">Temporary Outside Access</p>
                  <p className="text-[11px] text-amber-700 mb-2">Auto expires after selected duration.</p>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={form.temporaryAccessIp}
                      onChange={e => setForm({ ...form, temporaryAccessIp: e.target.value })}
                      placeholder="Temporary IP"
                      className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 bg-white"
                    />
                    <select
                      value={form.temporaryAccessHours}
                      onChange={e => setForm({ ...form, temporaryAccessHours: e.target.value })}
                      className="w-full border border-amber-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-amber-500 bg-white"
                    >
                      <option value="9">9 hours</option>
                      <option value="10">10 hours</option>
                    </select>
                  </div>
                  {editingUser?.temporaryAccessUntil && (
                    <p className="text-[11px] text-amber-700 mt-2">
                      Current expiry: {new Date(editingUser.temporaryAccessUntil).toLocaleString()}
                    </p>
                  )}
                </div>

                {editingUser && (
                  <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setEditIpOpen(v => !v)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-[#F8F9FC] text-left"
                    >
                      <span className="text-sm font-semibold text-gray-700">IP Access History</span>
                      <ChevronDown size={16} className={`text-gray-400 transition-transform ${editIpOpen ? "rotate-180" : ""}`} />
                    </button>
                    {editIpOpen && (
                      <div className="p-4 max-h-40 overflow-y-auto overscroll-y-contain">
                        {loadingHistory ? (
                          <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
                        ) : accessHistory.length === 0 ? (
                          <p className="text-xs text-gray-400">No access records yet.</p>
                        ) : (
                          <div className="overflow-x-auto -mx-1">
                          <table className="w-full text-[11px] min-w-[280px]">
                            <thead>
                              <tr className="text-left text-gray-400 border-b">
                                <th className="pb-1 pr-2">When</th>
                                <th className="pb-1 pr-2">IP</th>
                                <th className="pb-1">Browser</th>
                              </tr>
                            </thead>
                            <tbody>
                              {accessHistory.map(row => (
                                <tr key={row.id} className="border-b border-gray-50 last:border-0">
                                  <td className="py-1.5 pr-2 text-gray-600 whitespace-nowrap">
                                    {new Date(row.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                                  </td>
                                  <td className="py-1.5 pr-2 font-mono">{row.ip ?? "—"}</td>
                                  <td className="py-1.5 truncate">{row.browser ?? "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              </div>

              <div className="px-4 sm:px-6 py-4 shrink-0 border-t border-gray-100 bg-white flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <button onClick={() => { setShowModal(false); setEditingUser(null); setEditIpOpen(false); }}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl hover:bg-gray-50 transition-all text-sm">
                  Cancel
                </button>
                <button onClick={handleSubmit}
                  className="flex-1 bg-[#B8112D] text-white py-3 rounded-2xl hover:bg-[#a30f27] transition-all text-sm font-semibold">
                  {editingUser ? "Update User" : "Create User"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CSR RESET MODAL */}
        {resetUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
            <div className="bg-white w-full rounded-3xl max-w-lg max-h-[90vh] flex flex-col overflow-hidden my-4 shadow-xl">
              <div className="p-6 pb-4 shrink-0 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-800">Reset CSR Data</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Select pages and sub-pages to clear for <span className="font-semibold text-gray-800">{resetUser.name}</span>.
                  Account stays — only selected lead data is permanently deleted.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0 space-y-4">
                <label className="flex items-center gap-3 p-3 rounded-xl bg-[#FFF6F7] border border-[#B8112D]/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allResetScopesSelected}
                    onChange={toggleAllResetScopes}
                    className="w-4 h-4 rounded border-gray-300 text-[#B8112D] focus:ring-[#B8112D]"
                  />
                  <div>
                    <p className="text-sm font-bold text-[#B8112D]">Select All</p>
                    <p className="text-xs text-gray-500">Reset every page and sub-page (full wipe)</p>
                  </div>
                </label>

                {CSR_RESET_GROUPS.map(group => {
                  const groupChecked = isGroupFullySelected(group.id);
                  const groupPartial = isGroupPartiallySelected(group.id);
                  return (
                    <div key={group.id} className="rounded-xl border border-gray-100 overflow-hidden">
                      <label className="flex items-start gap-3 p-3 bg-[#F8F9FC] cursor-pointer border-b border-gray-100">
                        <input
                          type="checkbox"
                          checked={groupChecked}
                          ref={el => {
                            if (el) el.indeterminate = groupPartial;
                          }}
                          onChange={() => toggleResetGroup(group.id)}
                          className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#B8112D] focus:ring-[#B8112D]"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800">{group.label}</p>
                          {group.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                          )}
                        </div>
                      </label>

                      <div className="divide-y divide-gray-50">
                        {group.children.map(child => {
                          const checked = resetScopes.includes(child.id);
                          return (
                            <label
                              key={child.id}
                              className={`flex items-start gap-3 px-3 py-2.5 pl-8 cursor-pointer transition-colors ${
                                checked ? "bg-[#FFF6F7]" : "hover:bg-gray-50"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleResetScope(child.id)}
                                className="w-4 h-4 mt-0.5 rounded border-gray-300 text-[#B8112D] focus:ring-[#B8112D]"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800">{child.label}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{child.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-6 pt-4 shrink-0 border-t border-gray-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => !resettingCsr && setResetUser(null)}
                  disabled={resettingCsr}
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl hover:bg-gray-50 transition-all text-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void runCsrReset()}
                  disabled={resettingCsr || resetScopes.length === 0}
                  className="flex-1 bg-[#B8112D] text-white py-3 rounded-2xl hover:bg-[#a30f27] transition-all text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {resettingCsr && <RotateCcw size={14} className="animate-spin" />}
                  {resettingCsr ? "Resetting…" : `Reset (${resetScopes.length})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}