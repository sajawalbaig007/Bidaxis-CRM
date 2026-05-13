"use client";

import { useState } from "react";

import {
  Search,
  Plus,
  ClipboardList,
  Clock3,
  CheckCircle2,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";

import DashboardSidebar from "../components/Sidebar";
import DashboardNavbar from "../components/Navbar";

/* ================= TYPES ================= */

type Lead = {
  client: string;
  project: string;
  status: "Active" | "Pending" | "Completed";
  startedAt: string;
  deadline: string;
  priority: "High" | "Medium" | "Low";
};

/* ================= DATA ================= */

const initialLeads: Lead[] = [
  {
    client: "Ali Traders",
    project: "CRM Dashboard",
    status: "Active",
    startedAt: "12 May 2026",
    deadline: "25 May 2026",
    priority: "High",
  },
  {
    client: "Tech Solutions",
    project: "Scraper System",
    status: "Pending",
    startedAt: "10 May 2026",
    deadline: "28 May 2026",
    priority: "Medium",
  },
  {
    client: "Digital Agency",
    project: "Admin Panel",
    status: "Completed",
    startedAt: "02 May 2026",
    deadline: "15 May 2026",
    priority: "Low",
  },
];

export default function LeadsPage() {
  const [leads, setLeads] =
    useState<Lead[]>(initialLeads);

  const [search, setSearch] =
    useState("");

  const [openMenu, setOpenMenu] =
    useState<number | null>(null);

  const [selectedLead, setSelectedLead] =
    useState<Lead | null>(null);

  const [showModal, setShowModal] =
    useState(false);

  const [form, setForm] = useState({
    client: "",
    project: "",
    status: "Active",
    startedAt: "",
    deadline: "",
    priority: "Medium",
  });

  const filteredLeads = leads.filter(
    (lead) =>
      lead.client
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      lead.project
        .toLowerCase()
        .includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      {/* SIDEBAR */}
      <DashboardSidebar />

      {/* MAIN */}
      <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden mt-[72px] lg:mt-0">

        {/* NAVBAR */}
        <DashboardNavbar />

        {/* ================= STATS ================= */}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 mb-6">

          {/* TOTAL */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-400">
                  Total Leads
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {leads.length}
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-[#F8ECEF] flex items-center justify-center">

                <ClipboardList
                  size={26}
                  className="text-[#B8112D]"
                />

              </div>

            </div>

          </div>

          {/* ACTIVE */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-400">
                  Active Orders
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {
                    leads.filter(
                      (l) =>
                        l.status === "Active"
                    ).length
                  }
                </h2>

              </div>

              <div className="w-14 h-14 rounded-2xl bg-yellow-100 flex items-center justify-center">

                <Clock3
                  size={26}
                  className="text-yellow-600"
                />

              </div>

            </div>

          </div>

          {/* COMPLETED */}
          <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-sm text-gray-400">
                  Completed
                </p>

                <h2 className="text-3xl font-semibold text-gray-800 mt-2">
                  {
                    leads.filter(
                      (l) =>
                        l.status === "Completed"
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

        </div>

        {/* ================= SEARCH + BUTTON ================= */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">

          {/* SEARCH */}
          <div className="relative w-full sm:w-[320px]">

            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />

            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3 text-sm outline-none focus:border-[#B8112D]"
            />

          </div>

          {/* BUTTON */}
          <button
            onClick={() =>
              setShowModal(true)
            }
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#B8112D] text-white px-5 py-3 rounded-2xl text-sm font-medium shadow-sm hover:bg-[#a30f27] transition-all"
          >

            <Plus size={16} />

            Create Lead

          </button>

        </div>

        {/* ================= TABLE ================= */}

        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">

          <table className="w-full">

            <thead className="bg-[#FAFAFB] border-b border-gray-100">

              <tr className="text-left text-sm text-gray-400">

                <th className="px-6 py-4 font-medium">
                  Client
                </th>

                <th className="hidden md:table-cell px-6 py-4 font-medium">
                  Project
                </th>

                <th className="hidden lg:table-cell px-6 py-4 font-medium">
                  Started
                </th>

                <th className="hidden lg:table-cell px-6 py-4 font-medium">
                  Deadline
                </th>

                <th className="hidden md:table-cell px-6 py-4 font-medium">
                  Status
                </th>

                <th className="px-6 py-4 font-medium text-right">
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredLeads.map((lead, i) => (
                <tr
                  key={i}
                  className="border-b border-gray-100 hover:bg-[#FAFAFB]"
                >

                  {/* CLIENT */}
                  <td className="px-6 py-5">

                    <div className="flex items-center gap-3">

                      <div className="w-11 h-11 rounded-full bg-[#F8ECEF] flex items-center justify-center text-[#B8112D] font-semibold">
                        {lead.client.charAt(0)}
                      </div>

                      <div>

                        <h3 className="text-sm font-semibold text-gray-700">
                          {lead.client}
                        </h3>

                        <p className="text-xs text-gray-400">
                          {lead.priority} Priority
                        </p>

                      </div>

                    </div>

                  </td>

                  {/* PROJECT */}
                  <td className="hidden md:table-cell px-6 py-5 text-sm text-gray-600">
                    {lead.project}
                  </td>

                  {/* START */}
                  <td className="hidden lg:table-cell px-6 py-5 text-sm text-gray-500">
                    {lead.startedAt}
                  </td>

                  {/* DEADLINE */}
                  <td className="hidden lg:table-cell px-6 py-5 text-sm text-gray-500">
                    {lead.deadline}
                  </td>

                  {/* STATUS */}
                  <td className="hidden md:table-cell px-6 py-5">

                    <span
                      className={`px-4 py-1.5 rounded-full text-xs font-medium
                      ${
                        lead.status === "Active"
                          ? "bg-yellow-100 text-yellow-700"
                          : lead.status ===
                            "Completed"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {lead.status}
                    </span>

                  </td>

                  {/* ACTIONS */}
                  <td className="px-6 py-5">

                    {/* DESKTOP */}
                    <div className="hidden md:flex items-center justify-end gap-2">

                      <button
                        onClick={() =>
                          setSelectedLead(lead)
                        }
                        className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                      >

                        <Eye size={16} />

                      </button>

                      <button className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 hover:bg-blue-200 flex items-center justify-center">

                        <Pencil size={16} />

                      </button>

                      <button className="w-9 h-9 rounded-xl bg-red-100 text-red-600 hover:bg-red-200 flex items-center justify-center">

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
                        <div className="absolute right-0 top-11 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden">

                          <button
                            onClick={() => {
                              setSelectedLead(
                                lead
                              );

                              setOpenMenu(null);
                            }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50"
                          >
                            View Details
                          </button>

                          <button className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50">
                            Edit Lead
                          </button>

                          <button className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50">
                            Delete Lead
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

        {/* ================= DETAIL MODAL ================= */}

        {selectedLead && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">

            <div className="bg-white w-full max-w-md rounded-3xl p-6">

              <h2 className="text-xl font-semibold text-gray-800 mb-5">
                Lead Details
              </h2>

              <div className="space-y-4">

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">
                    Client
                  </p>
                  <h3 className="font-medium text-gray-700 mt-1">
                    {selectedLead.client}
                  </h3>
                </div>

                <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                  <p className="text-xs text-gray-400">
                    Project
                  </p>
                  <h3 className="font-medium text-gray-700 mt-1">
                    {selectedLead.project}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-4">

                  <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                    <p className="text-xs text-gray-400">
                      Started
                    </p>
                    <h3 className="font-medium text-gray-700 mt-1 text-sm">
                      {selectedLead.startedAt}
                    </h3>
                  </div>

                  <div className="bg-[#F8F9FC] p-4 rounded-2xl">
                    <p className="text-xs text-gray-400">
                      Deadline
                    </p>
                    <h3 className="font-medium text-gray-700 mt-1 text-sm">
                      {selectedLead.deadline}
                    </h3>
                  </div>

                </div>

              </div>

              <button
                onClick={() =>
                  setSelectedLead(null)
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