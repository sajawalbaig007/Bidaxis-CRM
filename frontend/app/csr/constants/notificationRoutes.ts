export function getLeadPageForStatus(status: string): string {
  switch (status) {
    case "important":
      return "/csr/potential-clients";
    case "interested":
      return "/csr/potential-clients";
    case "Not Interested":
    case "completed":
      return "/csr/not-interested";
    case "not picked":
    case "not completed":
      return "/csr/bin";
    case "Close Client":
      return "/csr/active-projects";
    default:
      return "/csr";
  }
}

export function formatNotificationStatus(status: string): string {
  if (status === "Not Interested" || status === "completed") return "Not Interested";
  if (status === "not picked" || status === "not completed") return "Not Picked";
  if (status === "Close Client") return "Close Client";
  if (status === "important") return "Important";
  if (status === "interested") return "Interested";
  if (status === "pending") return "Pending";
  return status;
}

export const STATUS_BADGE_COLORS: Record<string, string> = {
  important:        "bg-[#FFF1F3] text-[#B8112D]",
  interested:       "bg-emerald-50 text-emerald-700",
  pending:          "bg-blue-50 text-blue-700",
  "Close Client":   "bg-violet-50 text-violet-700",
  "Not Interested": "bg-gray-100 text-gray-600",
  "not picked":     "bg-orange-50 text-orange-700",
};

export function statusBadgeColor(status: string): string {
  return STATUS_BADGE_COLORS[status] ?? "bg-gray-100 text-gray-600";
}

export function leadUrlForStatus(status: string, leadId: string): string {
  const params = new URLSearchParams({ leadId });
  if (status === "interested") params.set("tab", "interested");
  if (status === "important") params.set("tab", "important");
  return `${getLeadPageForStatus(status)}?${params.toString()}`;
}
