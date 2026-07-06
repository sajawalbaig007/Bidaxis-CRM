"use client";

import { usePathname } from "next/navigation";

/** Route prefix for shared admin/manager pages (`/admin` or `/manager`). */
export function useStaffBase(): "/admin" | "/manager" {
  const pathname = usePathname();
  return pathname.startsWith("/manager") ? "/manager" : "/admin";
}
