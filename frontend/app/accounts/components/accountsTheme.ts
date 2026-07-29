/** Brand-aligned accents for accounts tables & cards */
export type AccountsTableVariant = "assets" | "equity" | "liability" | "cashflow" | "neutral";

export const TABLE_VARIANT: Record<
  AccountsTableVariant,
  {
    card: string;
    header: string;
    headerText: string;
    rowHover: string;
    footer: string;
    input: string;
    badge: string;
    accent: string;
  }
> = {
  assets: {
    card: "border-[#0B84F3]/25 shadow-[0_4px_24px_-4px_rgba(11,132,243,0.15)]",
    header: "bg-gradient-to-r from-[#EAF5FF] to-[#F0F9FF]",
    headerText: "text-[#0369A1]",
    rowHover: "hover:bg-[#F8FBFF]",
    footer: "bg-[#EAF5FF]/80 border-t-2 border-[#0B84F3]/30",
    input: "focus:ring-[#0B84F3]/25 focus:border-[#0B84F3]",
    badge: "bg-[#0B84F3]",
    accent: "#0B84F3",
  },
  equity: {
    card: "border-[#0D9488]/25 shadow-[0_4px_24px_-4px_rgba(13,148,136,0.15)]",
    header: "bg-gradient-to-r from-[#F0FDFA] to-[#F0F9FF]",
    headerText: "text-[#0F766E]",
    rowHover: "hover:bg-[#F8FFFE]",
    footer: "bg-[#F0FDFA]/80 border-t-2 border-[#0D9488]/30",
    input: "focus:ring-[#0D9488]/25 focus:border-[#0D9488]",
    badge: "bg-[#0D9488]",
    accent: "#0D9488",
  },
  liability: {
    card: "border-[#B8112D]/25 shadow-[0_4px_24px_-4px_rgba(184,17,45,0.12)]",
    header: "bg-gradient-to-r from-[#FFF1F3] to-[#FFF8F9]",
    headerText: "text-[#B8112D]",
    rowHover: "hover:bg-[#FFFBFC]",
    footer: "bg-[#FFF1F3]/80 border-t-2 border-[#B8112D]/30",
    input: "focus:ring-[#B8112D]/25 focus:border-[#B8112D]",
    badge: "bg-[#B8112D]",
    accent: "#B8112D",
  },
  cashflow: {
    card: "border-[#B8112D]/20 shadow-[0_4px_24px_-4px_rgba(184,17,45,0.1)]",
    header: "bg-gradient-to-r from-[#FFF8F9] to-[#FFFBFC]",
    headerText: "text-[#B8112D]",
    rowHover: "hover:bg-[#FFFBFC]",
    footer: "bg-[#FFF8F2] border-t-2 border-[#B8112D]/25",
    input: "focus:ring-[#B8112D]/25 focus:border-[#B8112D]",
    badge: "bg-[#B8112D]",
    accent: "#B8112D",
  },
  neutral: {
    card: "border-gray-200/80 shadow-sm",
    header: "bg-[#F8FAFC]",
    headerText: "text-gray-700",
    rowHover: "hover:bg-gray-50/80",
    footer: "bg-gray-50 border-t border-gray-200",
    input: "focus:ring-[#B8112D]/20 focus:border-[#B8112D]/40",
    badge: "bg-gray-600",
    accent: "#64748B",
  },
};

export const BANK_COLORS = ["#0B84F3", "#B8112D", "#12B76A", "#F59E0B", "#0D9488", "#EA580C"];

export function bankColor(index: number): string {
  return BANK_COLORS[index % BANK_COLORS.length];
}
