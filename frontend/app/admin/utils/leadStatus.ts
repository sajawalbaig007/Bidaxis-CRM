import { hasSchedule } from "@/app/csr/utils/potentialClientBuckets";

/** Same status labels as CSR dashboard */
export function adminLeadStatusLabel(rawStatus: string, nextFollowup?: string): string {
  const s = (rawStatus || "pending").toLowerCase();
  if (s === "important") {
    return hasSchedule(nextFollowup) ? "Scheduled" : "Important";
  }
  if (s === "not interested" || s === "completed") return "Not Interested";
  if (s === "not picked" || s === "not completed") return "Not Picked";
  if (s === "close client" || s === "closed") return "Closed";
  if (s === "interested") return "Interested";
  if (s === "pending") return "Pending";
  if (!rawStatus) return "Pending";
  return rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
}

export function adminLeadStatusBadgeClass(rawStatus: string, nextFollowup?: string): string {
  const s = (rawStatus || "pending").toLowerCase();
  if (s === "important") {
    return hasSchedule(nextFollowup)
      ? "bg-[#FFF7E6] text-[#B54708]"
      : "bg-[#FFF1F3] text-[#B8112D]";
  }
  if (s === "interested") return "bg-[#FFF4E5] text-[#D97706]";
  if (s === "not picked" || s === "not completed") return "bg-[#FFF7E6] text-[#B54708]";
  if (s === "not interested" || s === "completed") return "bg-[#F1F5F9] text-[#475569]";
  if (s === "close client" || s === "closed") return "bg-gray-100 text-gray-600";
  if (s === "pending") return "bg-yellow-100 text-yellow-700";
  return "bg-[#F4F4F5] text-[#52525B]";
}
