"use client";

import { useState, useEffect, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, Plus, Users, Pencil, Trash2, Ban,
  MoreVertical, Eye, EyeOff, Headphones, Shield, Wifi, WifiOff,
  Globe, RotateCcw,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar  from "../components/Navbar";

type UserRole = "CSR" | "Admin";

type User = {
  id: string; name: string; email: string; password: string;
  status: "Active" | "Inactive"; role: UserRole;
  csrCode:    string | null;
  isOnline: boolean; lastActive: string | null;
  browser:     string | null;
  tabId:       string | null;
  openedAt:    string | null;
  tabVisible:  boolean | null;
  hiddenAt:    string | null;
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

const roleColor = (role: UserRole) => {
  if (role === "Admin") return "bg-blue-100 text-blue-600";
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

const formatHiddenTime = (iso: string | null): string => {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  const mins = Math.floor(diff / 60000);
  if (secs < 60) return `${secs}s`;
  return `${mins}m`;
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

/* Tab status — On Dashboard vs Away */
/* ── Live timer that updates every second ── */
function useLiveSeconds(isoTimestamp: string | null): number {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!isoTimestamp) return;
    const update = () => setSecs(Math.floor((Date.now() - new Date(isoTimestamp).getTime()) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isoTimestamp]);
  return secs;
}

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
function AwayTimer({ hiddenAt, browser }: { hiddenAt: string | null; browser: string | null }) {
  const secs = useLiveSeconds(hiddenAt);
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
function TabStatusBadge({ tabVisible, hiddenAt, openedAt, browser }: {
  tabVisible: boolean | null; hiddenAt: string | null;
  openedAt: string | null; browser: string | null;
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

  return <AwayTimer hiddenAt={hiddenAt} browser={browser}/>;
}

/* ── Online/Offline badge — 5min offline → Inactive label ── */
function OnlineBadge({ isOnline, lastActive }: { isOnline: boolean; lastActive: string | null }) {
  const offlineSecs = useLiveSeconds(isOnline ? null : lastActive);
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
  const [users,        setUsers]        = useState<User[]>([]);
  const [search,       setSearch]       = useState("");
  const [page,         setPage]         = useState(1);
  const [showModal,    setShowModal]    = useState(false);
  const [editingUser,  setEditingUser]  = useState<User | null>(null);
  const [detailUser,   setDetailUser]   = useState<User | null>(null);
  const [openMenu,     setOpenMenu]     = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showDetailPw, setShowDetailPw] = useState(false);
  const [loading,      setLoading]      = useState(true);

  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "CSR" as UserRole, csrCode: "",
  });

  const fetchUsers = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res  = await fetch(`${BASE}/users`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { if (!silent) toast.error("Failed to fetch users."); return; }

      const formatted: User[] = (Array.isArray(data) ? data : []).map((u: {
        id: string; name: string; email: string; role: string; csrCode?: string;
        isActive?: boolean; isOnline?: boolean; lastActive?: string;
        browser?: string; tabId?: string; openedAt?: string;
        tabVisible?: boolean; hiddenAt?: string;
      }) => ({
        id:         u.id,
        name:       u.name,
        email:      u.email,
        role:       u.role === "csr" ? "CSR" : "Admin",
        csrCode:    u.csrCode    ?? null,
        status:     u.isActive === false ? "Inactive" : "Active",
        isOnline:   u.isOnline   ?? false,
        lastActive: u.lastActive ?? null,
        password:   "",
        browser:    u.browser    ?? null,
        tabId:      u.tabId      ?? null,
        openedAt:   u.openedAt   ?? null,
        tabVisible: u.tabVisible ?? null,
        hiddenAt:   u.hiddenAt   ?? null,
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

  /* 2s poll — fast "On Dashboard" / "Away" updates */
  useEffect(() => {
    const interval = setInterval(() => fetchUsers(true), 2_000);
    return () => clearInterval(interval);
  }, [fetchUsers]);

  /* Refresh on tab focus */
  useEffect(() => {
    const onFocus = () => fetchUsers(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchUsers]);

  const totalUsers   = users.length;
  const onlineNow    = users.filter(u => u.isOnline).length;
  const activeCSR    = users.filter(u => u.role === "CSR"   && u.isOnline).length;
  const activeAdmins = users.filter(u => u.role === "Admin" && u.isOnline).length;

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const totalPagesUsers = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers  = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
      const role = form.role === "CSR" ? "csr" : "admin";
      const url    = editingUser ? `${BASE}/users/${editingUser.id}` : `${BASE}/auth/register`;
      const method = editingUser ? "PUT" : "POST";
      const body   = editingUser
        ? { name: form.name, email: form.email, role, csrCode: role === "csr" ? form.csrCode.trim() : null }
        : { name: form.name, email: form.email, password: form.password, role, csrCode: role === "csr" ? form.csrCode.trim() : null };

      const res  = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Operation failed."); return; }

      toast.success(editingUser ? "User updated." : "User created.");
      fetchUsers();
      setShowModal(false); setEditingUser(null);
      setForm({ name: "", email: "", password: "", role: "CSR", csrCode: "" });
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
              const res  = await fetch(`${BASE}/users/${id}`, { method: "DELETE", credentials: "include" });
              const data = await res.json();
              if (!res.ok) { toast.error(data.message || "Delete failed.", { id: tid }); return; }
              toast.success("User deleted.", { id: tid });
              fetchUsers();
            } catch { toast.error("Something went wrong.", { id: tid }); }
          }} className="flex-1 rounded-xl bg-[#B8112D] py-2 text-sm font-semibold text-white">Delete</button>
          <button onClick={() => toast.dismiss(t.id)} className="flex-1 rounded-xl bg-gray-100 py-2 text-sm font-semibold text-gray-600">Cancel</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const handleResetCSR = (user: User) => {
    toast(t => (
      <div className="flex flex-col gap-3 min-w-[220px]">
        <div>
          <p className="font-semibold text-[#111827]">Reset {user.name}&apos;s data?</p>
          <p className="text-xs text-gray-400 mt-1">All leads assigned to this CSR will be permanently deleted.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            toast.dismiss(t.id);
            const tid = toast.loading(`Resetting ${user.name}'s data...`);
            try {
              const res  = await fetch(`${BASE}/admin/csr-leads/${user.id}`, { method: "DELETE", credentials: "include" });
              const data = await res.json();
              if (!res.ok) { toast.error(data.message || "Reset failed.", { id: tid }); return; }
              toast.success(`${data.deleted} leads deleted for ${user.name}.`, { id: tid });
            } catch { toast.error("Something went wrong.", { id: tid }); }
          }} className="flex-1 rounded-xl bg-[#B8112D] py-2 text-sm font-semibold text-white">Reset</button>
          <button onClick={() => toast.dismiss(t.id)} className="flex-1 rounded-xl bg-gray-100 py-2 text-sm font-semibold text-gray-600">Cancel</button>
        </div>
      </div>
    ), { duration: Infinity });
  };

  const toggleStatus = async (user: User) => {
    const newActive = user.status !== "Active";
    try {
      const res = await fetch(`${BASE}/users/${user.id}`, {
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

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">
      <Toaster position="top-right" toastOptions={{
        style: { borderRadius:"16px", fontFamily:"inherit", fontSize:"14px" },
        success: { iconTheme:{ primary:"#027A48", secondary:"#fff" } },
        error:   { iconTheme:{ primary:"#B8112D", secondary:"#fff" } },
      }}/>

      <DashboardSidebar/>

      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">
        <DashboardNavbar/>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
          {[
            { label:"Total Users",   value:totalUsers,   bg:"bg-[#F8ECEF]",   icon:<Users size={24} className="text-[#B8112D]"/>,      extra:null },
            { label:"Online Now",    value:onlineNow,    bg:"bg-green-100",   icon:<Wifi size={24} className="text-green-600"/>,         extra:<div className="flex items-center gap-1 mt-1"><span className="w-1.5 h-1.5 rounded-full bg-[#12B76A] animate-pulse"/><p className="text-[10px] text-gray-400">Live · 2s</p></div> },
            { label:"CSR Online",    value:activeCSR,    bg:"bg-emerald-100", icon:<Headphones size={24} className="text-emerald-600"/>, extra:null },
            { label:"Admins Online", value:activeAdmins, bg:"bg-blue-100",    icon:<Shield size={24} className="text-blue-600"/>,        extra:null },
          ].map((c, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm text-gray-400">{c.label}</p>
                  {loading
                    ? <div className="h-8 w-10 bg-gray-100 rounded-lg mt-2 animate-pulse"/>
                    : <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-2">{c.value}</h2>
                  }
                  {c.extra}
                </div>
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl ${c.bg} flex items-center justify-center`}>{c.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* SEARCH + CREATE */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="relative w-full sm:w-[300px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search users..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"/>
          </div>
          <button onClick={() => { setEditingUser(null); setForm({ name:"", email:"", password:"", role:"CSR", csrCode:"" }); setShowModal(true); }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all">
            <Plus size={16}/>Create User
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-[#FAFAFB] border-b border-gray-100">
                <tr className="text-left text-sm text-gray-400">
                  <th className="px-6 py-4 font-medium">User</th>
                  <th className="px-6 py-4 font-medium">Role</th>
                  <th className="px-6 py-4 font-medium">Online Status</th>
                  <th className="px-6 py-4 font-medium">Browser / Tab</th>
                  <th className="px-6 py-4 font-medium">Account</th>
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
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm relative ${roleColor(u.role)}`}>
                          {u.name.charAt(0).toUpperCase()}
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
                        </div>
                      </div>
                    </td>

                    {/* ROLE */}
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${roleColor(u.role)}`}>{u.role}</span>
                    </td>

                    {/* ONLINE STATUS */}
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <OnlineBadge isOnline={u.isOnline} lastActive={u.lastActive}/>
                    </td>

                    {/* BROWSER / TAB STATUS */}
                    <td className="px-4 sm:px-6 py-4">
                      {u.isOnline ? (
                        <TabStatusBadge
                          tabVisible={u.tabVisible}
                          hiddenAt={u.hiddenAt}
                          openedAt={u.openedAt}
                          browser={u.browser}
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
                    <td className="px-4 sm:px-6 py-4">
                      <div className="hidden md:flex items-center justify-end gap-2">
                        <button onClick={() => setDetailUser(u)}
                          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm">
                          Details
                        </button>
                        <button onClick={() => { setEditingUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role, csrCode: u.csrCode ?? "" }); setShowModal(true); }}
                          className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all">
                          <Pencil size={16}/>
                        </button>
                        <button onClick={() => toggleStatus(u)}
                          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                            u.status === "Active"
                              ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                              : "bg-green-100 text-green-600 hover:bg-green-200"
                          }`}>
                          <Ban size={16}/>
                        </button>
                        {u.role === "CSR" && (
                          <button onClick={() => handleResetCSR(u)}
                            title="Reset CSR data"
                            className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 hover:bg-orange-200 flex items-center justify-center transition-all">
                            <RotateCcw size={16}/>
                          </button>
                        )}
                        <button onClick={() => handleDelete(u.id)}
                          className="w-9 h-9 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all">
                          <Trash2 size={16}/>
                        </button>
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
                              { label:"Edit User",    action:() => { setEditingUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role, csrCode: u.csrCode ?? "" }); setShowModal(true); setOpenMenu(null); }},
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
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white w-full rounded-3xl p-6 max-w-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className={`relative w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold ${roleColor(detailUser.role)}`}>
                  {detailUser.name.charAt(0).toUpperCase()}
                  <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${detailUser.isOnline ? "bg-[#12B76A]" : "bg-gray-300"}`}/>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{detailUser.name}</h2>
                  <p className="text-sm text-gray-400">{detailUser.role}</p>
                </div>
              </div>

              <div className="space-y-3">
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

                <div className="bg-[#F8F9FC] rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Password</p>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">
                      {showDetailPw ? (detailUser.password || "Hidden") : "••••••••"}
                    </h3>
                    <button onClick={() => setShowDetailPw(!showDetailPw)} className="text-gray-400 hover:text-gray-600">
                      {showDetailPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
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
                      />
                    </div>
                  )}
                </div>
              </div>

              <button onClick={() => { setDetailUser(null); setShowDetailPw(false); }}
                className="w-full mt-5 bg-[#B8112D] text-white py-3 rounded-2xl font-medium">
                Close
              </button>
            </div>
          </div>
        )}

        {/* CREATE / EDIT MODAL */}
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white w-full rounded-3xl p-6 max-w-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                {editingUser ? "Edit User" : "Create User"}
              </h2>
              <div className="space-y-4">
                {[
                  { label:"Full Name",     key:"name",  type:"text",  placeholder:"Enter full name" },
                  { label:"Email Address", key:"email", type:"email", placeholder:"Enter email"      },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="text-sm text-gray-500 block mb-2">{label}</label>
                    <input type={type} value={form[key as "name"|"email"]}
                      onChange={e => setForm({ ...form, [key]: e.target.value })}
                      placeholder={placeholder}
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] text-sm"/>
                  </div>
                ))}
                {!editingUser && (
                  <div>
                    <label className="text-sm text-gray-500 block mb-2">Password</label>
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
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowModal(false); setEditingUser(null); }}
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
      </main>
    </div>
  );
}