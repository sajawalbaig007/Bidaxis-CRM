"use client";

import { useState } from "react";

import {
  PhoneCall,
  CalendarDays,
  Clock3,
  Building2,
  CircleAlert,
  Phone,
  User2,
} from "lucide-react";

import CSRNavbar from "../components/CSRNavbar";
import CSRSidebar from "../components/CSRSidebar";

const importantCalls = [
  {
    id: 1,
    type: "important",
    client: "Michael Brown",
    company: "Prime Builders",
    phone: "+1 202 888 0192",
    priority: "High",
    nextFollowup: "May 20, 2026",
    time: "11:30 AM",
    notes:
      "Client requested updated BIM drawings and pricing details.",
  },

  {
    id: 2,
    type: "important",
    client: "Sarah Wilson",
    company: "Urban Space",
    phone: "+1 404 222 9811",
    priority: "Urgent",
    nextFollowup: "May 21, 2026",
    time: "03:00 PM",
    notes:
      "Waiting for final approval call from client side.",
  },

  {
    id: 3,
    type: "interested",
    client: "David Lee",
    company: "Skyline Group",
    phone: "+1 909 777 1122",
    priority: "Medium",
    notes:
      "Interested in rendering and BIM coordination package.",
  },

  {
    id: 4,
    type: "interested",
    client: "Emma Watson",
    company: "Vision Arc",
    phone: "+1 808 555 9090",
    priority: "High",
    notes:
      "Client showed strong interest in full BIM workflow service.",
  },
];

export default function ImportantCallsPage() {

  const [isOpen, setIsOpen] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState("important");

  const filteredCalls =
    importantCalls.filter(
      (call) =>
        call.type === activeTab
    );

  const [selectedCall, setSelectedCall] =
    useState(
      importantCalls.find(
        (call) =>
          call.type === "important"
      )
    );

  return (
    <div className="flex min-h-screen bg-[#F5F6FA]">

      {/* SIDEBAR */}
      <CSRSidebar
        isOpen={isOpen}
        setIsOpen={setIsOpen}
      />

      {/* MAIN */}
      <main className="flex-1 p-4 sm:p-5 pt-[95px] overflow-x-hidden">

        {/* NAVBAR */}
        <CSRNavbar
          setIsOpen={setIsOpen}
        />

        {/* HEADER */}
        <div className="mt-7">

          <h1 className="text-[28px] sm:text-[34px] font-bold text-[#0F172A] leading-tight">
            Important Calls
          </h1>

          <p className="text-gray-500 mt-2 text-sm">
            Manage important and interested clients.
          </p>

        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-7">

          {/* TOTAL */}
          <div className="bg-white rounded-[24px] p-5 border border-white shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Total Important
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  12
                </h2>

              </div>

              <div className="w-12 h-12 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <CircleAlert size={22} />
              </div>

            </div>

          </div>

          {/* TODAY */}
          <div className="bg-white rounded-[24px] p-5 border border-white shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Calls Today
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  5
                </h2>

              </div>

              <div className="w-12 h-12 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <PhoneCall size={22} />
              </div>

            </div>

          </div>

          {/* INTERESTED */}
          <div className="bg-white rounded-[24px] p-5 border border-white shadow-sm">

            <div className="flex items-center justify-between">

              <div>

                <p className="text-gray-500 text-sm">
                  Interested Leads
                </p>

                <h2 className="text-[28px] font-bold text-[#0F172A] mt-2">
                  8
                </h2>

              </div>

              <div className="w-12 h-12 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                <CalendarDays size={22} />
              </div>

            </div>

          </div>

        </div>

        {/* FILTER BUTTONS */}
        <div className="flex flex-wrap gap-3 mt-7">

          {/* IMPORTANT */}
          <button
            onClick={() => {

              setActiveTab("important");

              setSelectedCall(
                importantCalls.find(
                  (call) =>
                    call.type === "important"
                )
              );

            }}
            className={`
              h-[48px]
              px-5
              rounded-2xl
              text-sm
              font-semibold
              transition-all duration-200
              flex items-center gap-2
              shadow-sm

              ${
                activeTab === "important"
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"
              }
            `}
          >

            <CircleAlert size={17} />

            Important Calls

          </button>

          {/* INTERESTED */}
          <button
            onClick={() => {

              setActiveTab("interested");

              setSelectedCall(
                importantCalls.find(
                  (call) =>
                    call.type === "interested"
                )
              );

            }}
            className={`
              h-[48px]
              px-5
              rounded-2xl
              text-sm
              font-semibold
              transition-all duration-200
              flex items-center gap-2
              shadow-sm

              ${
                activeTab === "interested"
                  ? "bg-[#B8112D] text-white"
                  : "bg-white text-[#B8112D] border border-[#B8112D]/20 hover:bg-[#FFF6F7]"
              }
            `}
          >

            <PhoneCall size={17} />

            Interested Clients

          </button>

        </div>

        {/* IMPORTANT UI */}
        {activeTab === "important" && selectedCall && (

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 mt-7">

            {/* LEFT */}
            <div className="xl:col-span-5 bg-white rounded-[30px] border border-white shadow-sm p-5">

              <div className="flex items-center justify-between">

                <div>

                  <h3 className="text-[22px] font-bold text-[#0F172A]">
                    Important Clients
                  </h3>

                  <p className="text-gray-500 text-sm mt-1">
                    Scheduled follow-up meetings.
                  </p>

                </div>

                <div className="bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold px-4 py-2 rounded-2xl">
                  Live
                </div>

              </div>

              {/* CLIENTS */}
              <div className="space-y-4 mt-7">

                {filteredCalls.map((call) => (

                  <button
                    key={call.id}
                    onClick={() =>
                      setSelectedCall(call)
                    }
                    className={`
                      w-full
                      text-left
                      rounded-[24px]
                      border
                      p-5
                      transition-all

                      ${
                        selectedCall?.id === call.id
                          ? "border-[#B8112D] bg-[#FFF8F9]"
                          : "border-gray-100 bg-white hover:border-[#B8112D]/30"
                      }
                    `}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="flex items-center gap-4">

                        <div className="w-12 h-12 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold shrink-0">
                          {call.client.charAt(0)}
                        </div>

                        <div>

                          <h4 className="font-semibold text-[#0F172A] text-[15px]">
                            {call.client}
                          </h4>

                          <p className="text-gray-500 text-sm mt-1">
                            {call.company}
                          </p>

                        </div>

                      </div>

                      <div
                        className={`
                          px-3 py-1 rounded-xl text-xs font-semibold

                          ${
                            call.priority === "Urgent"
                              ? "bg-[#FFF1F3] text-[#B42318]"
                              : call.priority === "High"
                              ? "bg-[#FFF7E6] text-[#B54708]"
                              : "bg-[#ECFDF3] text-[#027A48]"
                          }
                        `}
                      >
                        {call.priority}
                      </div>

                    </div>

                  </button>

                ))}

              </div>

            </div>

            {/* RIGHT */}
            <div className="xl:col-span-7 bg-white rounded-[30px] border border-white shadow-sm p-5">

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">

                <div>

                  <h3 className="text-[26px] font-bold text-[#0F172A]">
                    {selectedCall.client}
                  </h3>

                  <p className="text-gray-500 mt-1">
                    Detailed follow-up information.
                  </p>

                </div>

                <button className="h-[48px] px-5 rounded-2xl bg-[#B8112D] text-white text-sm font-semibold shadow-sm">
                  Open Client
                </button>

              </div>

              {/* INFO GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-7">

                <div className="bg-[#FAFAFA] rounded-2xl p-5">

                  <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <Building2 size={20} />
                    </div>

                    <div>

                      <p className="text-gray-500 text-sm">
                        Company
                      </p>

                      <h4 className="font-semibold text-[#0F172A] mt-1">
                        {selectedCall.company}
                      </h4>

                    </div>

                  </div>

                </div>

                <div className="bg-[#FAFAFA] rounded-2xl p-5">

                  <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <Phone size={20} />
                    </div>

                    <div>

                      <p className="text-gray-500 text-sm">
                        Contact Number
                      </p>

                      <h4 className="font-semibold text-[#0F172A] mt-1">
                        {selectedCall.phone}
                      </h4>

                    </div>

                  </div>

                </div>

                <div className="bg-[#FAFAFA] rounded-2xl p-5">

                  <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <CalendarDays size={20} />
                    </div>

                    <div>

                      <p className="text-gray-500 text-sm">
                        Next Schedule
                      </p>

                      <h4 className="font-semibold text-[#0F172A] mt-1">
                        {selectedCall.nextFollowup}
                      </h4>

                    </div>

                  </div>

                </div>

                <div className="bg-[#FAFAFA] rounded-2xl p-5">

                  <div className="flex items-center gap-3">

                    <div className="w-11 h-11 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center">
                      <Clock3 size={20} />
                    </div>

                    <div>

                      <p className="text-gray-500 text-sm">
                        Time
                      </p>

                      <h4 className="font-semibold text-[#0F172A] mt-1">
                        {selectedCall.time}
                      </h4>

                    </div>

                  </div>

                </div>

              </div>

              {/* NOTES */}
              <div className="mt-7">

                <h4 className="text-[18px] font-bold text-[#0F172A]">
                  Follow-up Notes
                </h4>

                <div className="bg-[#FAFAFA] rounded-2xl p-5 mt-4">

                  <div className="flex items-start gap-3">

                    <div className="w-10 h-10 rounded-2xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0">
                      <User2 size={18} />
                    </div>

                    <p className="text-gray-600 leading-7 text-[15px]">
                      {selectedCall.notes}
                    </p>

                  </div>

                </div>

              </div>

            </div>

          </div>

        )}

        {/* INTERESTED TABLE */}
        {activeTab === "interested" && (

          <div className="bg-white rounded-[30px] border border-white shadow-sm p-5 sm:p-6 mt-7">

            {/* TOP */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              <div>

                <h3 className="text-[26px] font-bold text-[#0F172A]">
                  Interested Clients
                </h3>

                <p className="text-gray-500 text-sm mt-1">
                  Clients interested in BIM & rendering services.
                </p>

              </div>

              <div className="bg-[#FFF1F3] text-[#B8112D] text-sm font-semibold px-4 py-2 rounded-2xl w-fit">
                {filteredCalls.length} Interested Leads
              </div>

            </div>

            {/* TABLE */}
            <div className="overflow-x-auto mt-7">

              <table className="w-full min-w-[760px]">

                <thead>

                  <tr className="border-b border-[#F1F1F1]">

                    <th className="text-left py-4 px-2 text-[13px] font-semibold text-gray-500">
                      Client
                    </th>

                    <th className="text-left py-4 px-2 text-[13px] font-semibold text-gray-500">
                      Company
                    </th>

                    <th className="text-left py-4 px-2 text-[13px] font-semibold text-gray-500">
                      Contact
                    </th>

                    <th className="text-left py-4 px-2 text-[13px] font-semibold text-gray-500">
                      Interest
                    </th>

                    <th className="text-left py-4 px-2 text-[13px] font-semibold text-gray-500">
                      Status
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredCalls.map((call) => (

                    <tr
                      key={call.id}
                      className="border-b border-[#F7F7F7] hover:bg-[#FFF8F9] transition-all"
                    >

                      <td className="py-5 px-2">

                        <div className="flex items-center gap-4">

                          <div className="w-11 h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center font-bold text-sm">
                            {call.client.charAt(0)}
                          </div>

                          <div>

                            <h4 className="font-semibold text-[#0F172A] text-[14px]">
                              {call.client}
                            </h4>

                            <p className="text-gray-500 text-[12px] mt-1">
                              Interested Lead
                            </p>

                          </div>

                        </div>

                      </td>

                      <td className="py-5 px-2">

                        <div>

                          <h4 className="font-medium text-[#0F172A] text-[14px]">
                            {call.company}
                          </h4>

                          <p className="text-gray-500 text-[12px] mt-1">
                            BIM Services
                          </p>

                        </div>

                      </td>

                      <td className="py-5 px-2">

                        <div className="bg-[#FFF6F7] text-[#B8112D] px-4 py-2 rounded-xl text-sm font-medium w-fit">
                          {call.phone}
                        </div>

                      </td>

                      <td className="py-5 px-2">

                        <div className="bg-[#FFF6F7] text-[#B8112D] px-4 py-2 rounded-xl text-sm font-medium w-fit">
                          Rendering + BIM
                        </div>

                      </td>

                      <td className="py-5 px-2">

                        <div className="bg-[#FFF1F3] text-[#B8112D] px-4 py-2 rounded-xl text-sm font-semibold w-fit">
                          Interested
                        </div>

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>

        )}

      </main>

    </div>
  );
}