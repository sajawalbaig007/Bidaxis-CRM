"use client";

import { useState } from "react";

const initialLinks = [
  {
    id: 1,
    client: "John Smith",
    company: "BEM Design Studio",
    phone: "+1 202 555 0192",
    email: "john@bem.com",
    status: "pending",
  },
  {
    id: 2,
    client: "Michael Brown",
    company: "Prime Builders",
    phone: "+1 202 888 0192",
    email: "michael@prime.com",
    status: "important",
  },
  {
    id: 3,
    client: "David Lee",
    company: "Urban Space",
    phone: "+1 303 222 9999",
    email: "david@urban.com",
    status: "completed",
  },
  {
    id: 4,
    client: "Sophia Wilson",
    company: "Skyline Architects",
    phone: "+1 404 777 1122",
    email: "sophia@skyline.com",
    status: "pending",
  },
];

export default function LinksTable({
  activeTab,
}: {
  activeTab: string;
}) {
  const [links, setLinks] =
    useState(initialLinks);

  const updateStatus = (
    id: number,
    status: string
  ) => {
    setLinks((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status }
          : item
      )
    );
  };

  const filteredLinks =
    activeTab === "all"
      ? links
      : links.filter(
          (item) =>
            item.status === activeTab
        );

  return (
    <div className="w-full">

      <table className="w-full table-fixed">

        {/* HEAD */}
        <thead>

          <tr className="border-b border-gray-100">

            <th className="text-left py-4 text-sm font-semibold text-gray-500 w-[28%]">
              Client
            </th>

            <th className="text-left py-4 text-sm font-semibold text-gray-500 w-[25%]">
              Company
            </th>

            <th className="text-left py-4 text-sm font-semibold text-gray-500 w-[18%]">
              Phone
            </th>

            <th className="text-left py-4 text-sm font-semibold text-gray-500 w-[14%]">
              Status
            </th>

            <th className="text-left py-4 text-sm font-semibold text-gray-500 w-[15%]">
              Action
            </th>

          </tr>

        </thead>

        {/* BODY */}
        <tbody>

          {filteredLinks.map((item) => (

            <tr
              key={item.id}
              className="border-b border-gray-100"
            >

              {/* CLIENT */}
              <td className="py-5 pr-4">

                <div className="flex items-center gap-3">

                  <div className="w-11 h-11 rounded-full bg-[#B8112D] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {item.client.charAt(0)}
                  </div>

                  <div>

                    <h4 className="text-[15px] font-semibold text-[#0F172A]">
                      {item.client}
                    </h4>

                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {item.email}
                    </p>

                  </div>

                </div>

              </td>

              {/* COMPANY */}
              <td className="py-5 pr-4">

                <h4 className="text-[15px] font-medium text-[#0F172A] leading-6">
                  {item.company}
                </h4>

              </td>

              {/* PHONE */}
              <td className="py-5 pr-4">

                <h4 className="text-[15px] font-medium text-[#0F172A]">
                  {item.phone}
                </h4>

              </td>

              {/* STATUS */}
              <td className="py-5 pr-4">

                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap ${
                    item.status === "completed"
                      ? "bg-green-100 text-green-700"
                      : item.status === "important"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {item.status}
                </span>

              </td>

              {/* ACTION */}
              <td className="py-5">

                <select
                  value={item.status}
                  onChange={(e) =>
                    updateStatus(
                      item.id,
                      e.target.value
                    )
                  }
                  className="w-full h-[42px] rounded-xl border border-gray-200 px-3 text-sm font-medium outline-none bg-white"
                >

                  <option value="pending">
                    Pending
                  </option>

                  <option value="completed">
                    Completed
                  </option>

                  <option value="important">
                    Important
                  </option>

                </select>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>
  );
}