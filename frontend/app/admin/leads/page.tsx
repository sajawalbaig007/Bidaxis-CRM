"use client";

import { useState } from "react";

import toast, {
  Toaster,
} from "react-hot-toast";

import {
  Search,
  Plus,
  Building2,
  Phone,
  Mail,
  CheckCircle2,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  X,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar from "../components/Navbar";

/* ================= TYPES ================= */

type Client = {
  id: number;
  clientName: string;
  email: string;
  contact: string;
  company: string;
  parentCompany: string;
  scope: string;
  lastEmail: string;
  lastCall: string;
  lastComment: string;
  status: "Active" | "Pending" | "Closed";
};

/* ================= DATA ================= */

const initialClients: Client[] = [
  {
    id: 1,
    clientName: "John Smith",
    email: "john@bemdesign.com",
    contact: "+1 202 555 0192",
    company: "BEM DESIGN STUDIO",
    parentCompany: "BEM DESIGN STUDIO",
    scope: "Architectural BIM Modeling",
    lastEmail: "2026-05-12",
    lastCall: "2026-05-10",
    lastComment:
      "Client requested revised drawings.",
    status: "Active",
  },
  {
    id: 2,
    clientName: "Michael Brown",
    email: "michael@gps.com",
    contact: "+1 202 555 0177",
    company: "GPS",
    parentCompany: "GPS",
    scope: "MEP Coordination",
    lastEmail: "2026-05-11",
    lastCall: "2026-05-09",
    lastComment:
      "Waiting for final approval.",
    status: "Pending",
  },
];

/* ================= PAGE ================= */

export default function ClientsPage() {
  /* ================= STATES ================= */

  const [clients, setClients] =
    useState<Client[]>(initialClients);

  const [search, setSearch] =
    useState("");

  const [openMenu, setOpenMenu] =
    useState<number | null>(null);

  const [selectedClient, setSelectedClient] =
    useState<Client | null>(null);

  const [showCompanies, setShowCompanies] =
    useState(false);

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [isEditing, setIsEditing] =
    useState(false);

  const [showDeleteModal, setShowDeleteModal] =
    useState(false);

  const [clientToDelete, setClientToDelete] =
    useState<number | null>(null);

  /* ================= NEW CLIENT ================= */

  const emptyClient: Client = {
    id: 0,
    clientName: "",
    email: "",
    contact: "",
    company: "",
    parentCompany: "",
    scope: "",
    lastEmail: "",
    lastCall: "",
    lastComment: "",
    status: "Active",
  };

  const [newClient, setNewClient] =
    useState<Client>(emptyClient);

  /* ================= FILTER ================= */

  const filteredClients = clients.filter(
    (client) =>
      client.clientName
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      client.company
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      client.scope
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  /* ================= SAVE CLIENT ================= */

  const handleSaveClient = () => {
    if (
      !newClient.clientName ||
      !newClient.email ||
      !newClient.company
    ) {
      toast.error(
        "Please fill all required fields."
      );

      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailRegex.test(newClient.email)
    ) {
      toast.error(
        "Please enter valid email."
      );

      return;
    }

    if (isEditing) {
      setClients((prev) =>
        prev.map((client) =>
          client.id === newClient.id
            ? newClient
            : client
        )
      );

      toast.success(
        "Client updated successfully."
      );
    } else {
      setClients((prev) => [
        {
          ...newClient,
          id: Date.now(),
        },
        ...prev,
      ]);

      toast.success(
        "Client added successfully."
      );
    }

    setShowAddModal(false);

    setIsEditing(false);

    setNewClient(emptyClient);
  };

  /* ================= DELETE ================= */

  const handleDeleteClient = () => {
    if (clientToDelete === null)
      return;

    setClients((prev) =>
      prev.filter(
        (client) =>
          client.id !==
          clientToDelete
      )
    );

    toast.success(
      "Client deleted successfully."
    );

    setShowDeleteModal(false);

    setClientToDelete(null);
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

        {/* ================= HEADER ================= */}

        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-gray-800">
            Client Management
          </h1>

          <p className="text-sm text-gray-400 mt-1">
            Manage clients,
            conversations, and company
            records.
          </p>
        </div>

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-6">
          {/* TOTAL */}

          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Total Clients
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {clients.length}
                </h2>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#F8ECEF] flex items-center justify-center">
                <Building2
                  size={26}
                  className="text-[#B8112D]"
                />
              </div>
            </div>
          </div>

          {/* ACTIVE */}

          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Active Clients
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {
                    clients.filter(
                      (c) =>
                        c.status ===
                        "Active"
                    ).length
                  }
                </h2>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center">
                <CheckCircle2
                  size={26}
                  className="text-green-600"
                />
              </div>
            </div>
          </div>

          {/* FOLLOW UPS */}

          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Follow Ups
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  14
                </h2>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Phone
                  size={26}
                  className="text-blue-600"
                />
              </div>
            </div>
          </div>

          {/* EMAILS */}

          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">
                  Emails Sent
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  42
                </h2>
              </div>

              <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center">
                <Mail
                  size={26}
                  className="text-yellow-600"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ================= PARENT COMPANIES ================= */}

        <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm mb-6">
          <button
            onClick={() =>
              setShowCompanies(
                !showCompanies
              )
            }
            className="w-full flex items-center justify-between"
          >
            <div>
              <h2 className="text-xl font-semibold text-gray-800 text-left">
                Parent Companies
              </h2>

              <p className="text-sm text-gray-400 mt-1 text-left">
                Company groups and
                associated clients.
              </p>
            </div>

            {showCompanies ? (
              <ChevronUp
                size={20}
                className="text-gray-500"
              />
            ) : (
              <ChevronDown
                size={20}
                className="text-gray-500"
              />
            )}
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ${
              showCompanies
                ? "max-h-[500px] mt-6"
                : "max-h-0"
            }`}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              {[
                "BEM DESIGN STUDIO",
                "GPS",
                "BEM SOLUTIONS",
                "PS-ESTIMATING",
                "DEVCON-ESTIMATING",
              ].map((company, i) => (
                <div
                  key={i}
                  className="bg-[#FAFAFB] border border-gray-100 rounded-2xl p-4"
                >
                  <h3 className="font-semibold text-gray-700">
                    {company}
                  </h3>

                  <p className="text-sm text-gray-400 mt-2">
                    Active Projects &
                    Clients
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= SEARCH ================= */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
          {/* SEARCH */}

          <div className="relative w-full sm:w-[320px]">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search clients..."
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
              setShowAddModal(true);

              setIsEditing(false);

              setNewClient(emptyClient);

              toast(
                "Create new client record."
              );
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all"
          >
            <Plus size={16} />
            Add Client
          </button>
        </div>

        {/* ================= TABLE ================= */}

        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto overflow-y-auto max-h-[700px] custom-scrollbar">
            <table className="w-full min-w-[1600px]">
              <thead className="bg-[#FAFAFB] border-b border-gray-100 sticky top-0 z-10">
                <tr className="text-left text-sm text-gray-400">
                  <th className="px-6 py-4 font-medium">
                    Client
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Company
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Scope
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Contact
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Last Email
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Last Call
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Last Call Comments
                  </th>

                  <th className="px-6 py-4 font-medium">
                    Status
                  </th>

                  <th className="px-6 py-4 font-medium text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredClients.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-20 text-center"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-[#F8ECEF] flex items-center justify-center mb-4">
                          <Building2
                            size={32}
                            className="text-[#B8112D]"
                          />
                        </div>

                        <h3 className="text-lg font-semibold text-gray-700">
                          No Clients Found
                        </h3>

                        <p className="text-sm text-gray-400 mt-2">
                          Try adding a new
                          client or changing
                          your search.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredClients.map(
                    (client, i) => (
                      <tr
                        key={client.id}
                        className="border-b border-gray-100 hover:bg-[#FAFAFB]"
                      >
                        {/* CLIENT */}

                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-full bg-[#F8ECEF] flex items-center justify-center text-[#B8112D] font-semibold">
                              {client.clientName.charAt(
                                0
                              )}
                            </div>

                            <div>
                              <h3 className="text-sm font-semibold text-gray-700">
                                {
                                  client.clientName
                                }
                              </h3>

                              <p className="text-xs text-gray-400">
                                {
                                  client.email
                                }
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* COMPANY */}

                        <td className="px-6 py-5 text-sm text-gray-600">
                          {client.company}
                        </td>

                        {/* SCOPE */}

                        <td className="px-6 py-5 text-sm text-gray-600">
                          {client.scope}
                        </td>

                        {/* CONTACT */}

                        <td className="px-6 py-5 text-sm text-gray-500">
                          {client.contact}
                        </td>

                        {/* EMAIL */}

                        <td className="px-6 py-5 text-sm text-gray-500">
                          {client.lastEmail}
                        </td>

                        {/* CALL */}

                        <td className="px-6 py-5 text-sm text-gray-500">
                          {client.lastCall}
                        </td>

                        {/* COMMENT */}

                        <td className="px-6 py-5 text-sm text-gray-500 max-w-[280px]">
                          {
                            client.lastComment
                          }
                        </td>

                        {/* STATUS */}

                        <td className="px-6 py-5">
                          <span
                            className={`px-4 py-2 rounded-full text-xs font-medium ${
                              client.status ===
                              "Active"
                                ? "bg-green-100 text-green-700"
                                : client.status ===
                                  "Pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {
                              client.status
                            }
                          </span>
                        </td>

                        {/* ACTIONS */}

                        <td className="px-6 py-5">
                          {/* DESKTOP */}

                          <div className="hidden md:flex items-center justify-end gap-2">
                            {/* VIEW */}

                            <button
                              onClick={() => {
                                setSelectedClient(
                                  client
                                );

                                toast(
                                  "Viewing client details."
                                );
                              }}
                              className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all"
                            >
                              <Eye
                                size={16}
                              />
                            </button>

                            {/* EDIT */}

                            <button
                              onClick={() => {
                                setShowAddModal(
                                  true
                                );

                                setIsEditing(
                                  true
                                );

                                setNewClient(
                                  client
                                );

                                toast(
                                  "Editing client..."
                                );
                              }}
                              className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center transition-all"
                            >
                              <Pencil
                                size={16}
                              />
                            </button>

                            {/* DELETE */}

                            <button
                              onClick={() => {
                                setClientToDelete(
                                  client.id
                                );

                                setShowDeleteModal(
                                  true
                                );
                              }}
                              className="w-10 h-10 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center transition-all"
                            >
                              <Trash2
                                size={16}
                              />
                            </button>
                          </div>

                          {/* MOBILE */}

                          <div className="relative md:hidden flex justify-end">
                            <button
                              onClick={() =>
                                setOpenMenu(
                                  openMenu ===
                                    i
                                    ? null
                                    : i
                                )
                              }
                              className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center bg-white"
                            >
                              <MoreVertical
                                size={18}
                              />
                            </button>

                            {openMenu ===
                              i && (
                              <div className="absolute right-0 top-12 w-44 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">
                                {/* VIEW */}

                                <button
                                  onClick={() => {
                                    setSelectedClient(
                                      client
                                    );

                                    setOpenMenu(
                                      null
                                    );

                                    toast(
                                      "Viewing client details."
                                    );
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Eye
                                    size={15}
                                  />
                                  View
                                </button>

                                {/* EDIT */}

                                <button
                                  onClick={() => {
                                    setShowAddModal(
                                      true
                                    );

                                    setIsEditing(
                                      true
                                    );

                                    setNewClient(
                                      client
                                    );

                                    setOpenMenu(
                                      null
                                    );

                                    toast(
                                      "Editing client..."
                                    );
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Pencil
                                    size={15}
                                  />
                                  Edit
                                </button>

                                {/* DELETE */}

                                <button
                                  onClick={() => {
                                    setClientToDelete(
                                      client.id
                                    );

                                    setShowDeleteModal(
                                      true
                                    );

                                    setOpenMenu(
                                      null
                                    );
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                                >
                                  <Trash2
                                    size={15}
                                  />
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= DETAILS MODAL ================= */}

        {selectedClient && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl p-6">
              {/* HEADER */}

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Client Details
                  </h2>

                  <p className="text-sm text-gray-400 mt-1">
                    Complete client
                    information.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setSelectedClient(
                      null
                    )
                  }
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              {/* BODY */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">
                    Client Name
                  </p>

                  <h3 className="font-medium text-gray-700 mt-1">
                    {
                      selectedClient.clientName
                    }
                  </h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">
                    Company
                  </p>

                  <h3 className="font-medium text-gray-700 mt-1">
                    {
                      selectedClient.company
                    }
                  </h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">
                    Email
                  </p>

                  <h3 className="font-medium text-gray-700 mt-1">
                    {
                      selectedClient.email
                    }
                  </h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">
                    Contact
                  </p>

                  <h3 className="font-medium text-gray-700 mt-1">
                    {
                      selectedClient.contact
                    }
                  </h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl md:col-span-2">
                  <p className="text-xs text-gray-400">
                    Scope
                  </p>

                  <h3 className="font-medium text-gray-700 mt-1">
                    {
                      selectedClient.scope
                    }
                  </h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl md:col-span-2">
                  <div className="flex items-start gap-3">
                    <MessageSquare
                      size={18}
                      className="text-[#B8112D] mt-1"
                    />

                    <div>
                      <p className="text-xs text-gray-400">
                        Last Call
                        Comments
                      </p>

                      <h3 className="font-medium text-gray-700 mt-1">
                        {
                          selectedClient.lastComment
                        }
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= DELETE MODAL ================= */}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-md rounded-3xl p-6">
              {/* HEADER */}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    Delete Client
                  </h2>

                  <p className="text-sm text-gray-400 mt-1">
                    This action cannot
                    be undone.
                  </p>
                </div>

                <button
                  onClick={() => {
                    setShowDeleteModal(
                      false
                    );

                    setClientToDelete(
                      null
                    );
                  }}
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              {/* BODY */}

              <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
                <p className="text-sm text-red-600">
                  Are you sure you want
                  to delete this client
                  permanently?
                </p>
              </div>

              {/* FOOTER */}

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowDeleteModal(
                      false
                    );

                    setClientToDelete(
                      null
                    );
                  }}
                  className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    handleDeleteClient
                  }
                  className="px-6 py-3 rounded-2xl bg-red-600 text-white hover:bg-red-700 transition-all"
                >
                  Delete Client
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= ADD / EDIT MODAL ================= */}

        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-3xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto custom-scrollbar">
              {/* HEADER */}

              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-800">
                    {isEditing
                      ? "Edit Client"
                      : "Add New Client"}
                  </h2>

                  <p className="text-sm text-gray-400 mt-1">
                    Create and manage
                    client records.
                  </p>
                </div>

                <button
                  onClick={() =>
                    setShowAddModal(
                      false
                    )
                  }
                  className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                >
                  <X size={18} />
                </button>
              </div>

              {/* FORM */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* CLIENT NAME */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Client Name
                  </label>

                  <input
                    type="text"
                    value={
                      newClient.clientName
                    }
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        clientName:
                          e.target.value,
                      })
                    }
                    placeholder="John Smith"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />
                </div>

                {/* EMAIL */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Email Address
                  </label>

                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        email:
                          e.target.value,
                      })
                    }
                    placeholder="john@email.com"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />
                </div>

                {/* CONTACT */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Contact Number
                  </label>

                  <input
                    type="text"
                    value={
                      newClient.contact
                    }
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        contact:
                          e.target.value,
                      })
                    }
                    placeholder="+1 234 567 890"
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />
                </div>

                {/* COMPANY */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Company Name
                  </label>

                  <select
                    value={newClient.company}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        company:
                          e.target.value,
                        parentCompany:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  >
                    <option value="">
                      Select Company
                    </option>

                    <option value="BEM DESIGN STUDIO">
                      BEM DESIGN STUDIO
                    </option>

                    <option value="GPS">
                      GPS
                    </option>

                    <option value="BEM SOLUTIONS">
                      BEM SOLUTIONS
                    </option>

                    <option value="PS-ESTIMATING">
                      PS-ESTIMATING
                    </option>

                    <option value="DEVCON-ESTIMATING">
                      DEVCON-ESTIMATING
                    </option>
                  </select>
                </div>

                {/* SCOPE */}

                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500 mb-2 block">
                    Scope of Work
                  </label>

                  <textarea
                    rows={3}
                    value={newClient.scope}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        scope:
                          e.target.value,
                      })
                    }
                    placeholder="Write project scope..."
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none resize-none focus:border-[#B8112D]"
                  />
                </div>

                {/* LAST EMAIL */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Last Email Date
                  </label>

                  <input
                    type="date"
                    value={
                      newClient.lastEmail
                    }
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        lastEmail:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />
                </div>

                {/* LAST CALL */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Last Call Date
                  </label>

                  <input
                    type="date"
                    value={
                      newClient.lastCall
                    }
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        lastCall:
                          e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  />
                </div>

                {/* STATUS */}

                <div>
                  <label className="text-sm text-gray-500 mb-2 block">
                    Status
                  </label>

                  <select
                    value={newClient.status}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        status:
                          e.target
                            .value as
                            | "Active"
                            | "Pending"
                            | "Closed",
                      })
                    }
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none focus:border-[#B8112D]"
                  >
                    <option value="Active">
                      Active
                    </option>

                    <option value="Pending">
                      Pending
                    </option>

                    <option value="Closed">
                      Closed
                    </option>
                  </select>
                </div>

                {/* COMMENTS */}

                <div className="md:col-span-2">
                  <label className="text-sm text-gray-500 mb-2 block">
                    Last Call Comments
                  </label>

                  <textarea
                    rows={4}
                    value={
                      newClient.lastComment
                    }
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        lastComment:
                          e.target.value,
                      })
                    }
                    placeholder="Write discussion notes..."
                    className="w-full border border-gray-200 rounded-2xl px-4 py-3 outline-none resize-none focus:border-[#B8112D]"
                  />
                </div>
              </div>

              {/* FOOTER */}

              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  onClick={() =>
                    setShowAddModal(false)
                  }
                  className="px-5 py-3 rounded-2xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>

                <button
                  onClick={
                    handleSaveClient
                  }
                  className="px-6 py-3 rounded-2xl bg-[#B8112D] text-white hover:bg-[#a30f27] transition-all"
                >
                  {isEditing
                    ? "Update Client"
                    : "Save Client"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}