"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import CapsuleTabs, { type CapsuleTabItem } from "@/app/components/CapsuleTabs";

const CsrActivityReport = dynamic(() => import("./CsrActivityReport"), {
  ssr: false,
  loading: () => <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />,
});

const StaffAttendanceReport = dynamic(() => import("./StaffAttendanceReport"), {
  ssr: false,
  loading: () => <div className="h-40 rounded-xl bg-gray-100 animate-pulse" />,
});

const DEPARTMENTS = [
  { key: "csr", label: "CSR", kind: "role" },
  { key: "estimator", label: "Estimators", kind: "role" },
  { key: "bim", label: "BIM", kind: "role" },
  { key: "dev", label: "Development", kind: "staff" },
  { key: "office_boy", label: "Office Support", kind: "staff" },
  { key: "hr", label: "Human Resources", kind: "staff" },
  { key: "bim_modeler", label: "BIM Modeling", kind: "staff" },
  { key: "chief_estimator", label: "Chief Estimator", kind: "staff" },
  { key: "bim_manager", label: "BIM Management", kind: "staff" },
  { key: "admin", label: "Administration", kind: "staff" },
  { key: "accounts", label: "Accounts", kind: "staff" },
] as const;

type DeptKey = (typeof DEPARTMENTS)[number]["key"];

const TABS: CapsuleTabItem<DeptKey>[] = DEPARTMENTS.map((dept) => ({
  key: dept.key,
  label: dept.label,
}));

export default function AttendanceBoard() {
  const [active, setActive] = useState<DeptKey>("csr");
  const selected = DEPARTMENTS.find((dept) => dept.key === active) ?? DEPARTMENTS[0];

  return (
    <section className="rounded-[1.5rem] sm:rounded-[1.75rem] border border-gray-100/90 dark:border-crm-border bg-white dark:bg-crm-surface shadow-[0_10px_40px_-24px_rgba(15,23,42,0.35)] p-4 sm:p-5 min-w-0">
      <h2 className="font-bold text-[#0F172A] dark:text-crm-text text-base sm:text-lg tracking-tight">Attendance</h2>
      <p className="text-xs sm:text-sm text-gray-500 mt-0.5 mb-3">
        Select a department. Check-in and check-out open below.
      </p>
      <CapsuleTabs tabs={TABS} activeKey={active} onChange={setActive} size="sm" />
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-crm-border">
        <h3 className="text-sm font-bold text-[#0F172A] dark:text-crm-text mb-3">{selected.label}</h3>
        {selected.kind === "role" ? (
          <CsrActivityReport
            key={selected.key}
            staffRole={selected.key as "csr" | "estimator" | "bim"}
            embedded
            defaultOpen
          />
        ) : (
          <StaffAttendanceReport key={selected.key} only={selected.key} embedded />
        )}
      </div>
    </section>
  );
}
