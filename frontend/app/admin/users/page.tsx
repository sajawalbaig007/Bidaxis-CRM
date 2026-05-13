"use client";

import { useState } from "react";

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
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar from "../components/Navbar";

/* ================= TYPES ================= */

type User = {
  name: string;
  email: string;
  password: string;
  status: "Active" | "Inactive";
  lastActivity: string;
};

/* ================= DATA ================= */

const initialUsers: User[] = [
  {
    name: "Ali Khan",
    email: "ali@gmail.com",
    password: "123456",
    status: "Active",
    lastActivity: "2 min ago",
  },
  {
    name: "Hamza Farooq",
    email: "hamza@gmail.com",
    password: "123456",
    status: "Active",
    lastActivity: "Just now",
  },
  {
    name: "Ahmed Raza",
    email: "ahmed@gmail.com",
    password: "123456",
    status: "Inactive",
    lastActivity: "1 hour ago",
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

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [confirmAction, setConfirmAction] =
    useState<{
      type: "delete" | "toggle";
      user: User;
    } | null>(null);

  /* ================= FILTER ================= */

  const filteredUsers = users.filter((u) =>
    u.name
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* ================= ACTIONS ================= */

  const handleSubmit = () => {
    if (
      !form.name ||
      !form.email ||
      !form.password
    ) {
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
              }
            : u
        )
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
    }

    setShowModal(false);

    setEditingUser(null);

    setForm({
      name: "",
      email: "",
      password: "",
    });
  };

  const handleDelete = (email: string) => {
    setUsers(
      users.filter((u) => u.email !== email)
    );
  };

  const toggleStatus = (email: string) => {
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
  };

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      {/* SIDEBAR */}
      <DashboardSidebar />

      {/* MAIN */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">

        {/* NAVBAR */}
        <DashboardNavbar />

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-3 sm:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-5 mb-6">

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

          {/* ACTIVE */}
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

          {/* INACTIVE */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-xs sm:text-sm text-gray-400">
                  Inactive Users
                </p>

                <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800 mt-2">
                  {
                    users.filter(
                      (u) =>
                        u.status === "Inactive"
                    ).length
                  }
                </h2>

              </div>

              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gray-100 flex items-center justify-center">

                <UserX
                  size={24}
                  className="text-gray-600"
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
              });

              setShowModal(true);
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

                      <div className="w-11 h-11 rounded-full bg-[#F8ECEF] flex items-center justify-center text-[#B8112D] font-semibold">
                        {u.name.charAt(0)}
                      </div>

                      <div>

                        <h3 className="text-sm font-semibold text-gray-700">
                          {u.name}
                        </h3>

                        <p className="text-xs text-gray-400">
                          CRM User
                        </p>

                      </div>

                    </div>

                  </td>

                  {/* ACTIONS */}
                  <td className="px-4 sm:px-6 py-5">

                    {/* DESKTOP */}
                    <div className="hidden md:flex items-center justify-end gap-2">

                      <button
                        onClick={() =>
                          setMobileDetailsUser(u)
                        }
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
                          });

                          setShowModal(true);
                        }}
                        className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all"
                      >

                        <Pencil size={16} />

                      </button>

                      <button
                        onClick={() =>
                          setConfirmAction({
                            type: "toggle",
                            user: u,
                          })
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
                          setConfirmAction({
                            type: "delete",
                            user: u,
                          })
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
                              });

                              setShowModal(true);

                              setOpenMenu(null);
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 transition-all"
                          >
                            Edit User
                          </button>

                          <button
                            onClick={() => {
                              setConfirmAction({
                                type: "toggle",
                                user: u,
                              });

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
                              setConfirmAction({
                                type: "delete",
                                user: u,
                              });

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

                <div className="w-14 h-14 rounded-full bg-[#F8ECEF] flex items-center justify-center text-[#B8112D] text-xl font-semibold">
                  {mobileDetailsUser.name.charAt(
                    0
                  )}
                </div>

                <div>

                  <h2 className="text-lg font-semibold text-gray-800">
                    {mobileDetailsUser.name}
                  </h2>

                  <p className="text-sm text-gray-400">
                    CRM User
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

                  <p className="text-xs text-gray-400 mb-1">
                    Password
                  </p>

                  <h3 className="text-sm font-medium text-gray-700">
                    {mobileDetailsUser.password}
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

      </main>
    </div>
  );
}