"use client";

import { useState } from "react";

import toast, {
  Toaster,
} from "react-hot-toast";

import {
  Search,
  Plus,
  Users,
  UserCheck,
  UserX,
  Pencil,
  Trash2,
  Ban,
  MoreVertical,
  Eye,
  EyeOff,
  Headphones,
  Shield,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar from "../components/Navbar";

/* ================= TYPES ================= */

type UserRole = "CSR" | "Admin" | "User";

type User = {
  name: string;
  email: string;
  password: string;
  status: "Active" | "Inactive";
  lastActivity: string;
  role: UserRole;
};

/* ================= DATA ================= */

const initialUsers: User[] = [
  {
    name: "Ali Khan",
    email: "ali@gmail.com",
    password: "123456",
    status: "Active",
    lastActivity: "2 min ago",
    role: "Admin",
  },
  {
    name: "Hamza Farooq",
    email: "hamza@gmail.com",
    password: "123456",
    status: "Active",
    lastActivity: "Just now",
    role: "CSR",
  },
  {
    name: "Ahmed Raza",
    email: "ahmed@gmail.com",
    password: "123456",
    status: "Inactive",
    lastActivity: "1 hour ago",
    role: "CSR",
  },
  {
    name: "Sara Ahmed",
    email: "sara@gmail.com",
    password: "123456",
    status: "Active",
    lastActivity: "5 min ago",
    role: "Admin",
  },
  {
    name: "Omar Hassan",
    email: "omar@gmail.com",
    password: "123456",
    status: "Active",
    lastActivity: "Just now",
    role: "CSR",
  },
];

export default function UsersPage() {
  const [users, setUsers] =
    useState<User[]>(initialUsers);

  const [search, setSearch] =
    useState("");

  const [showModal, setShowModal] =
    useState(false);

  const [editingUser, setEditingUser] =
    useState<User | null>(null);

  const [mobileDetailsUser, setMobileDetailsUser] =
    useState<User | null>(null);

  const [openMenu, setOpenMenu] =
    useState<number | null>(null);

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showDetailPassword,
    setShowDetailPassword,
  ] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "User" as UserRole,
  });

  /* ================= FILTER ================= */

  const filteredUsers = users.filter((u) =>
    u.name
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* ================= STATS ================= */

  const activeCSRCount = users.filter(
    (u) => u.status === "Active" && u.role === "CSR"
  ).length;

  const activeAdminCount = users.filter(
    (u) => u.status === "Active" && u.role === "Admin"
  ).length;

  /* ================= ACTIONS ================= */

  const handleSubmit = () => {
    if (
      !form.name ||
      !form.email ||
      !form.password
    ) {
      toast.error(
        "Please fill all fields."
      );

      return;
    }

    if (editingUser) {
      setUsers(
        users.map((u) =>
          u.email === editingUser.email
            ? {
                ...u,
                name: form.name,
                email: form.email,
                password: form.password,
                lastActivity: "Just now",
                role: form.role,
              }
            : u
        )
      );

      toast.success(
        "User updated successfully."
      );
    } else {
      setUsers([
        ...users,
        {
          ...form,
          status: "Active",
          lastActivity: "Just now",
        },
      ]);

      toast.success(
        "User created successfully."
      );
    }

    setShowModal(false);

    setEditingUser(null);

    setForm({
      name: "",
      email: "",
      password: "",
      role: "User",
    });

    setShowPassword(false);
  };

  const handleDelete = (
    email: string
  ) => {
    setUsers(
      users.filter(
        (u) => u.email !== email
      )
    );

    toast.success(
      "User deleted successfully."
    );
  };

  const toggleStatus = (
    email: string
  ) => {
    const targetUser = users.find(
      (u) => u.email === email
    );

    setUsers(
      users.map((u) =>
        u.email === email
          ? {
              ...u,
              status:
                u.status === "Active"
                  ? "Inactive"
                  : "Active",
            }
          : u
      )
    );

    toast.success(
      targetUser?.status ===
        "Active"
        ? "User blocked successfully."
        : "User activated successfully."
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      {/* ================= TOASTER ================= */}

      <Toaster
        position="top-right"
        reverseOrder={false}
        toastOptions={{
          duration: 3000,

          style: {
            background: "#fff",
            color: "#111827",
            borderRadius: "16px",
            padding: "14px 16px",
            border: "1px solid #E5E7EB",
            boxShadow:
              "0 10px 25px rgba(0,0,0,0.08)",
            fontSize: "14px",
            fontWeight: "500",
          },

          success: {
            iconTheme: {
              primary: "#16A34A",
              secondary: "#fff",
            },
          },

          error: {
            iconTheme: {
              primary: "#DC2626",
              secondary: "#fff",
            },
          },
        }}
      />

      {/* SIDEBAR */}
      <DashboardSidebar />

      {/* MAIN */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">

        {/* NAVBAR */}
        <DashboardNavbar />

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">

          {/* TOTAL */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs sm:text-sm text-gray-400">
                  Total Users
                </p>

                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-2">
                  {users.length}
                </h2>

              </div>

              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#F8ECEF] flex items-center justify-center">

                <Users
                  size={24}
                  className="text-[#B8112D]"
                />

              </div>

            </div>

          </div>

          {/* ACTIVE USERS */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs sm:text-sm text-gray-400">
                  Active Users
                </p>

                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-2">
                  {
                    users.filter(
                      (u) =>
                        u.status === "Active"
                    ).length
                  }
                </h2>

              </div>

              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-green-100 flex items-center justify-center">

                <UserCheck
                  size={24}
                  className="text-green-600"
                />

              </div>

            </div>

          </div>

          {/* ACTIVE CSR CARD */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-3xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2 mb-1">

                  <Headphones size={16} className="text-emerald-600" />

                  <p className="text-xs sm:text-sm text-emerald-600 font-medium">
                    Active CSR
                  </p>

                </div>

                <h2 className="text-2xl sm:text-3xl font-semibold text-emerald-800 mt-1">
                  {activeCSRCount}
                </h2>

                <p className="text-xs text-emerald-500 mt-1">
                  Customer Support Reps
                </p>

              </div>

              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">

                <Headphones
                  size={24}
                  className="text-emerald-600"
                />

              </div>

            </div>

          </div>

          {/* ACTIVE ADMINS CARD */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-3xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <div className="flex items-center gap-2 mb-1">

                  <Shield size={16} className="text-blue-600" />

                  <p className="text-xs sm:text-sm text-blue-600 font-medium">
                    Active Admins
                  </p>

                </div>

                <h2 className="text-2xl sm:text-3xl font-semibold text-blue-800 mt-1">
                  {activeAdminCount}
                </h2>

                <p className="text-xs text-blue-500 mt-1">
                  System Administrators
                </p>

              </div>

              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-100 flex items-center justify-center">

                <Shield
                  size={24}
                  className="text-blue-600"
                />

              </div>

            </div>

          </div>

        </div>

        {/* SEARCH + BUTTON */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">

          {/* SEARCH */}
          <div className="relative w-full sm:w-[300px]">

            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"
            />

          </div>

          {/* BUTTON */}
          <button
            onClick={() => {
              setEditingUser(null);

              setForm({
                name: "",
                email: "",
                password: "",
                role: "User",
              });

              setShowModal(true);

              toast(
                "Create new user."
              );
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all"
          >

            <Plus size={16} />

            Create User

          </button>

        </div>

        {/* ================= TABLE ================= */}

        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">

          <table className="w-full">

            <thead className="bg-[#FAFAFB] border-b border-gray-100">

              <tr className="text-left text-sm text-gray-400">

                <th className="px-6 py-4 font-medium">
                  User
                </th>

                <th className="px-6 py-4 font-medium">
                  Role
                </th>

                <th className="px-6 py-4 font-medium text-right">
                  Actions
                </th>

               </tr>

            </thead>

            <tbody>

              {filteredUsers.map((u, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 hover:bg-[#FAFAFB] transition-all"
                >

                  {/* USER */}
                  <td className="px-4 sm:px-6 py-5">

                    <div className="flex items-center gap-3">

                      <div className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold
                        ${u.role === "Admin" ? "bg-blue-100 text-blue-600" : 
                          u.role === "CSR" ? "bg-emerald-100 text-emerald-600" : 
                          "bg-[#F8ECEF] text-[#B8112D]"}`}>
                        {u.name.charAt(0)}
                      </div>

                      <div>

                        <h3 className="text-sm font-semibold text-gray-700">
                          {u.name}
                        </h3>

                        <p className="text-xs text-gray-400">
                          {u.email}
                        </p>

                      </div>

                    </div>

                   </td>

                  {/* ROLE */}
                  <td className="px-4 sm:px-6 py-5">

                    <span className={`px-3 py-1 rounded-full text-xs font-medium
                      ${u.role === "Admin" ? "bg-blue-100 text-blue-600" : 
                        u.role === "CSR" ? "bg-emerald-100 text-emerald-600" : 
                        "bg-gray-100 text-gray-600"}`}>
                      {u.role}
                    </span>

                   </td>

                  {/* ACTIONS */}
                  <td className="px-4 sm:px-6 py-5">

                    {/* DESKTOP */}
                    <div className="hidden md:flex items-center justify-end gap-2">

                      <button
                        onClick={() => {
                          setMobileDetailsUser(
                            u
                          );

                          toast(
                            "Viewing user details."
                          );
                        }}
                        className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all text-sm"
                      >
                        View Details
                      </button>

                      <button
                        onClick={() => {
                          setEditingUser(u);

                          setForm({
                            name: u.name,
                            email: u.email,
                            password: u.password,
                            role: u.role,
                          });

                          setShowModal(true);

                          toast(
                            "Editing user..."
                          );
                        }}
                        className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all"
                      >

                        <Pencil size={16} />

                      </button>

                      <button
                        onClick={() =>
                          toggleStatus(
                            u.email
                          )
                        }
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all
                        ${
                          u.status === "Active"
                            ? "bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                            : "bg-green-100 text-green-600 hover:bg-green-200"
                        }`}
                      >

                        <Ban size={16} />

                      </button>

                      <button
                        onClick={() =>
                          handleDelete(
                            u.email
                          )
                        }
                        className="w-9 h-9 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                      >

                        <Trash2 size={16} />

                      </button>

                    </div>

                    {/* MOBILE */}
                    <div className="relative md:hidden flex justify-end">

                      <button
                        onClick={() =>
                          setOpenMenu(
                            openMenu === i
                              ? null
                              : i
                          )
                        }
                        className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center bg-white"
                      >

                        <MoreVertical size={18} />

                      </button>

                      {openMenu === i && (
                        <div className="absolute right-0 top-11 w-52 bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden z-50">

                          <button
                            onClick={() => {
                              setMobileDetailsUser(
                                u
                              );

                              setOpenMenu(null);

                              toast(
                                "Viewing user details."
                              );
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-all"
                          >
                            View Details
                          </button>

                          <button
                            onClick={() => {
                              setEditingUser(u);

                              setForm({
                                name: u.name,
                                email: u.email,
                                password:
                                  u.password,
                                role: u.role,
                              });

                              setShowModal(true);

                              setOpenMenu(null);

                              toast(
                                "Editing user..."
                              );
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-all"
                          >
                            Edit User
                          </button>

                          <button
                            onClick={() => {
                              toggleStatus(
                                u.email
                              );

                              setOpenMenu(null);
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-all"
                          >
                            {u.status ===
                            "Active"
                              ? "Block User"
                              : "Unblock User"}
                          </button>

                          <button
                            onClick={() => {
                              handleDelete(
                                u.email
                              );

                              setOpenMenu(null);
                            }}
                            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-all"
                          >
                            Delete User
                          </button>

                        </div>
                      )}

                    </div>

                   </td>

                 </tr>
              ))}

            </tbody>

           </table>

        </div>

        {/* ================= MOBILE DETAIL MODAL ================= */}

        {mobileDetailsUser && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">

            <div className="bg-white w-full rounded-3xl p-5 max-w-sm">

              <div className="flex items-center gap-3 mb-5">

                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold
                  ${mobileDetailsUser.role === "Admin" ? "bg-blue-100 text-blue-600" : 
                    mobileDetailsUser.role === "CSR" ? "bg-emerald-100 text-emerald-600" : 
                    "bg-[#F8ECEF] text-[#B8112D]"}`}>
                  {mobileDetailsUser.name.charAt(
                    0
                  )}
                </div>

                <div>

                  <h2 className="text-lg font-semibold text-gray-800">
                    {mobileDetailsUser.name}
                  </h2>

                  <p className="text-sm text-gray-400">
                    {mobileDetailsUser.role}
                  </p>

                </div>

              </div>

              <div className="space-y-4">

                <div className="bg-[#F8F9FC] rounded-2xl p-4">

                  <p className="text-xs text-gray-400 mb-1">
                    Email
                  </p>

                  <h3 className="text-sm font-medium text-gray-700 break-all">
                    {mobileDetailsUser.email}
                  </h3>

                </div>

                <div className="bg-[#F8F9FC] rounded-2xl p-4">

                  <div className="flex items-center justify-between mb-1">

                    <p className="text-xs text-gray-400">
                      Password
                    </p>

                    <button
                      onClick={() =>
                        setShowDetailPassword(
                          !showDetailPassword
                        )
                      }
                      className="text-gray-400 hover:text-gray-600"
                    >

                      {showDetailPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}

                    </button>

                  </div>

                  <h3 className="text-sm font-medium text-gray-700">
                    {showDetailPassword
                      ? mobileDetailsUser.password
                      : "••••••••"}
                  </h3>

                </div>

                <div className="bg-[#F8F9FC] rounded-2xl p-4">

                  <p className="text-xs text-gray-400 mb-1">
                    Last Activity
                  </p>

                  <h3 className="text-sm font-medium text-gray-700">
                    {mobileDetailsUser.lastActivity}
                  </h3>

                </div>

                <div className="bg-[#F8F9FC] rounded-2xl p-4">

                  <p className="text-xs text-gray-400 mb-1">
                    Status
                  </p>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium
                    ${
                      mobileDetailsUser.status ===
                      "Active"
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {mobileDetailsUser.status}
                  </span>

                </div>

              </div>

              <button
                onClick={() =>
                  setMobileDetailsUser(null)
                }
                className="w-full mt-6 bg-[#B8112D] text-white py-3 rounded-2xl font-medium"
              >
                Close
              </button>

            </div>

          </div>
        )}

        {/* ================= CREATE / EDIT MODAL ================= */}

        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">

            <div className="bg-white w-full rounded-3xl p-6 max-w-md">

              <h2 className="text-xl font-semibold text-gray-800 mb-6">
                {editingUser
                  ? "Edit User"
                  : "Create User"}
              </h2>

              <div className="space-y-4">

                <div>

                  <label className="text-sm text-gray-500 block mb-2">
                    Full Name
                  </label>

                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        name:
                          e.target.value,
                      })
                    }
                    placeholder="Enter full name"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />

                </div>

                <div>

                  <label className="text-sm text-gray-500 block mb-2">
                    Email Address
                  </label>

                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        email:
                          e.target.value,
                      })
                    }
                    placeholder="Enter email"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />

                </div>

                <div>

                  <label className="text-sm text-gray-500 block mb-2">
                    Password
                  </label>

                  <div className="relative">

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={form.password}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          password:
                            e.target.value,
                        })
                      }
                      placeholder="Enter password"
                      className="w-full border border-gray-200 rounded-2xl px-4 py-3 pr-12 outline-none focus:border-[#B8112D]"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >

                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}

                    </button>

                  </div>

                </div>

                <div>

                  <label className="text-sm text-gray-500 block mb-2">
                    Role
                  </label>

                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D] bg-white"
                  >
                    <option value="User">User</option>
                    <option value="CSR">CSR (Customer Support)</option>
                    <option value="Admin">Admin</option>
                  </select>

                </div>

              </div>

              <div className="flex items-center gap-3 mt-6">

                <button
                  onClick={() =>
                    setShowModal(false)
                  }
                  className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-2xl hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    handleSubmit
                  }
                  className="flex-1 bg-[#B8112D] text-white py-3 rounded-2xl hover:bg-[#a30f27] transition-all"
                >
                  {editingUser
                    ? "Update User"
                    : "Create User"}
                </button>

              </div>

            </div>

          </div>
        )}

      </main>

    </div>
  );
}