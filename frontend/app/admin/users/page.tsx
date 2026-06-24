"use client";

import { useState, useEffect, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  Search, Plus, Users, Pencil, Trash2, Ban,
  MoreVertical, Eye, EyeOff, Wifi, WifiOff,
  Globe, RotateCcw, User2,
} from "lucide-react";

import DashboardSidebar from "../components/layout/Sidebar";
import DashboardNavbar  from "../components/layout/Navbar";
import API, { getApiBase } from "@/lib/api";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

type UserRole = "CSR" | "Admin";

type User = {
  id: string; name: string; email: string; password: string;
  status: "Active" | "Inactive"; role: UserRole;
  csrCode:    string | null;
  cnic:       string | null;
  profilePic: string | null;
  isOnline: boolean; lastActive: string | null;
  browser:     string | null;
  tabId:       string | null;
  openedAt:    string | null;
  tabVisible:  boolean | null;
  hiddenAt:    string | null;
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
  const [showModal,    setShowModal]    = useState(false);
  const [editingUser,  setEditingUser]  = useState<User | null>(null);
  const [detailUser,   setDetailUser]   = useState<User | null>(null);
  const [openMenu,     setOpenMenu]     = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [accessHistory, setAccessHistory] = useState<AccessHistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "CSR" as UserRole, csrCode: "", cnic: "", profilePic: "",
  });
  const [uploadingPic, setUploadingPic] = useState(false);

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
        cnic?: string; profilePic?: string;
        isActive?: boolean; isOnline?: boolean; lastActive?: string;
        browser?: string; tabId?: string; openedAt?: string;
        tabVisible?: boolean; hiddenAt?: string;
      }) => ({
        id:         u.id,
        name:       u.name,
        email:      u.email,
        role:       u.role === "csr" ? "CSR" : "Admin",
        csrCode:    u.csrCode    ?? null,
        cnic:       u.cnic       ?? null,
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
    if (!detailUser) {
      setAccessHistory([]);
      return;
    }
    setLoadingHistory(true);
    API.get(`/admin/access-history/${detailUser.id}?limit=30`)
      .then(res => setAccessHistory(res.data.history ?? []))
      .catch(() => setAccessHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [detailUser]);

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
      const url    = editingUser ? `${apiBase()}/users/${editingUser.id}` : `${apiBase()}/auth/register`;
      const method = editingUser ? "PUT" : "POST";
      const shared = {
        name: form.name, email: form.email, role,
        csrCode:    role === "csr" ? form.csrCode.trim() : null,
        cnic:       form.cnic.trim() || null,
        profilePic: form.profilePic  || null,
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
      fetchUsers();
      setShowModal(false); setEditingUser(null);
      setForm({ name: "", email: "", password: "", role: "CSR", csrCode: "", cnic: "", profilePic: "" });
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
          <p className="text-xs text-gray-400 mt-1">
            Permanently removes from database: all leads, notes, sub-contacts, and call logs for this CSR.
            The user account will stay — only their data is cleared.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={async () => {
            toast.dismiss(t.id);
            const tid = toast.loading(`Resetting ${user.name}'s data...`);
            try {
              const res  = await fetch(`${apiBase()}/admin/csr-leads/${user.id}`, { method: "DELETE", credentials: "include" });
              const data = await res.json();
              if (!res.ok) { toast.error(data.message || "Reset failed.", { id: tid }); return; }
              toast.success(`All data removed for ${user.name} (${data.deleted ?? 0} leads deleted).`, { id: tid });
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
          <div className="h-[150px]">
            {loading ? (
              <div className="h-full bg-gray-50 rounded-2xl animate-pulse"/>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "CSR",   online: activeCSR,    offline: users.filter(u => u.role === "CSR").length   - activeCSR   },
                    { name: "Admin", online: activeAdmins, offline: users.filter(u => u.role === "Admin").length - activeAdmins },
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
              </ResponsiveContainer>
            )}
          </div>
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          <div className="relative w-full sm:w-[300px]">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input type="text" placeholder="Search users..." value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"/>
          </div>
          <button onClick={() => { setEditingUser(null); setForm({ name:"", email:"", password:"", role:"CSR", csrCode:"", cnic:"", profilePic:"" }); setShowModal(true); }}
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
                    <td className="px-4 sm:px-6 py-4">
                      <div className="hidden md:flex items-center justify-end gap-2">
                        <button onClick={() => setDetailUser(u)}
                          className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm">
                          Details
                        </button>
                        <button onClick={() => { setEditingUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role, csrCode: u.csrCode ?? "", cnic: u.cnic ?? "", profilePic: u.profilePic ?? "" }); setShowModal(true); }}
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
                              { label:"Edit User",    action:() => { setEditingUser(u); setForm({ name:u.name, email:u.email, password:"", role:u.role, csrCode: u.csrCode ?? "", cnic: u.cnic ?? "", profilePic: u.profilePic ?? "" }); setShowModal(true); setOpenMenu(null); }},
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
            <div className="bg-white w-full rounded-3xl p-6 max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <h3 className="text-sm font-medium text-gray-700">Encrypted (bcrypt hash in database)</h3>
                </div>

                <div className="bg-[#F8F9FC] rounded-2xl p-4">
                  <p className="text-xs text-gray-400 mb-2">IP &amp; Device Access History</p>
                  <p className="text-[10px] text-gray-400 mb-3">
                    Browsers cannot expose MAC addresses — device ID is the session tab identifier.
                  </p>
                  {loadingHistory ? (
                    <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ) : accessHistory.length === 0 ? (
                    <p className="text-xs text-gray-400">No access records yet.</p>
                  ) : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-[11px]">
                        <thead>
                          <tr className="text-left text-gray-400 border-b border-gray-200">
                            <th className="pb-2 pr-2 font-medium">When</th>
                            <th className="pb-2 pr-2 font-medium">Event</th>
                            <th className="pb-2 pr-2 font-medium">IP</th>
                            <th className="pb-2 pr-2 font-medium">Device</th>
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
                              <td className="py-2 pr-2 font-mono text-gray-500">{row.deviceId ?? "—"}</td>
                              <td className="py-2 text-gray-500">{row.browser ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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

              <button onClick={() => setDetailUser(null)}
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

                {/* Profile Picture */}
                <div>
                  <label className="text-sm text-gray-500 block mb-2">Profile Picture <span className="text-xs text-gray-400">(optional)</span></label>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-gray-200 shrink-0 bg-gray-50 flex items-center justify-center">
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