"use client";

import { usePathname } from "next/navigation";
import AdminSidebar from "@/app/admin/components/layout/Sidebar";
import ManagerSidebar from "@/app/manager/components/layout/Sidebar";

export function useStaffSidebar() {
  const pathname = usePathname();
  return pathname.startsWith("/manager") ? ManagerSidebar : AdminSidebar;
}
