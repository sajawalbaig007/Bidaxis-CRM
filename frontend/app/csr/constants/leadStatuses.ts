export const STATUS_NOT_INTERESTED = "Not Interested";
export const STATUS_NOT_PICKED = "not picked";
export const STATUS_NOT_COMPLETED = "not completed";
export const STATUS_NO_OWNER = "no owner available";
export const STATUS_NOT_IN_SERVICE = "not in service";
export const STATUS_IN_HOUSE = "in house";

export function isNotPickedStatus(s: string) {
  return s === STATUS_NOT_PICKED || s === STATUS_NOT_COMPLETED;
}

export function isNotInterestedStatus(s: string) {
  return s === STATUS_NOT_INTERESTED || s === "completed";
}

export function statusDisplayLabel(s: string): string {
  if (isNotInterestedStatus(s)) return "Not Interested";
  if (isNotPickedStatus(s)) return "Not Picked";
  if (s === STATUS_NO_OWNER) return "No Owner Available";
  if (s === STATUS_NOT_IN_SERVICE) return "Not In Service";
  if (s === STATUS_IN_HOUSE) return "In House";
  if (s === "important") return "Important";
  if (s === "interested") return "Interested";
  if (s === "Close Client") return "Close Client";
  if (s === "pending") return "Pending";
  return s;
}

export function statusBadgeClass(s: string): string {
  if (isNotPickedStatus(s)) return "bg-[#FFF7E6] text-[#B54708]";
  if (isNotInterestedStatus(s)) return "bg-[#F1F5F9] text-[#475569]";
  if (s === STATUS_NO_OWNER) return "bg-[#FEF3C7] text-[#B45309]";
  if (s === STATUS_NOT_IN_SERVICE) return "bg-[#F3E8FF] text-[#7C3AED]";
  if (s === STATUS_IN_HOUSE) return "bg-[#CCFBF1] text-[#0D9488]";
  if (s === "important") return "bg-[#FFF1F3] text-[#B8112D]";
  if (s === "interested") return "bg-[#FFF4E5] text-[#D97706]";
  if (s === "Close Client") return "bg-[#ECFDF5] text-[#065F46]";
  return "bg-[#F4F4F5] text-[#52525B]";
}
