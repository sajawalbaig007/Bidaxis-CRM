"use client";

import { redirect } from "next/navigation";

export default function LegacyCsrPayrollRedirect() {
  redirect("/accounts/sales-team-payroll");
}
