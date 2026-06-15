export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

interface StatusGroup {
  name: string;
  color: string;
  match: (status: string) => boolean;
}

export const STATUS_GROUPS: StatusGroup[] = [
  { name: "Pending",        color: "#0B84F3", match: s => s === "pending" },
  { name: "Important",      color: "#B42318", match: s => s === "important" },
  { name: "Interested",     color: "#D97706", match: s => s === "interested" },
  { name: "Close Client",   color: "#065F46", match: s => s === "Close Client" },
  { name: "Not Interested", color: "#475569", match: s => s === "Not Interested" || s === "completed" },
  { name: "Not Picked",     color: "#F97316", match: s => s === "not picked" || s === "not completed" },
];

export function getStatusChartData(leads: { status: string }[]): StatusSlice[] {
  return STATUS_GROUPS
    .map(group => ({
      name: group.name,
      color: group.color,
      value: leads.filter(l => group.match(l.status)).length,
    }))
    .filter(slice => slice.value > 0);
}
