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
    card: "border-[#7C3AED]/25 shadow-[0_4px_24px_-4px_rgba(124,58,237,0.15)]",
    header: "bg-gradient-to-r from-[#F3EEFF] to-[#FAF5FF]",
    headerText: "text-[#6D28D9]",
    rowHover: "hover:bg-[#FAF8FF]",
    footer: "bg-[#F3EEFF]/80 border-t-2 border-[#7C3AED]/30",
    input: "focus:ring-[#7C3AED]/25 focus:border-[#7C3AED]",
    badge: "bg-[#7C3AED]",
    accent: "#7C3AED",
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

export const BANK_COLORS = ["#0B84F3", "#7C3AED", "#12B76A", "#D97706", "#B8112D", "#0891B2"];

export function bankColor(index: number): string {
  return BANK_COLORS[index % BANK_COLORS.length];
}
