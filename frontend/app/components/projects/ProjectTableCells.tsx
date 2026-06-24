"use client";

import PaymentStatusCircle from "@/app/csr/components/shared/PaymentStatusCircle";
import {
  formatPaymentWhen,
  formatQuotedAmount,
  latestPaidPayment,
  parseMoney,
  parsePayments,
  paymentPercent,
  phaseLabel,
  ProjectPayment,
} from "@/lib/projectFields";
import { User2, Briefcase, Calendar } from "lucide-react";

export type ProjectTableRow = {
  id: string;
  name: string | null;
  ownerName?: string | null;
  phone: string | null;
  email: string | null;
  projectCode?: string | null;
  projectTitle: string | null;
  projectScope?: string | null;
  interestedService: string | null;
  projectBudget: string | null;
  projectDeadline: string | null;
  projectPhase?: string | null;
  projectPayments?: ProjectPayment[] | string | null;
};

const phaseStyle: Record<string, string> = {
  not_started:       "bg-gray-100 text-gray-600",
  takeoff_started:   "bg-amber-50 text-amber-700 border border-amber-200",
  takeoff_completed: "bg-orange-50 text-orange-700 border border-orange-200",
  pricing_phase:     "bg-violet-50 text-violet-700 border border-violet-200",
  qa_phase:          "bg-blue-50 text-blue-700 border border-blue-200",
  delivery_phase:    "bg-[#ECFDF5] text-[#065F46] border border-emerald-200",
};

export function ClientDetailCell({ p }: { p: ProjectTableRow }) {
  const initial = (p.name ?? "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-start gap-2.5 min-w-0">
      <div className="w-9 h-9 rounded-xl bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center shrink-0 font-bold text-sm">
        {initial}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-[#0F172A] text-xs xl:text-sm truncate">{p.name ?? "—"}</p>
        {p.phone && p.phone !== "N/A" && (
          <p className="text-[10px] xl:text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <User2 size={9} className="shrink-0" />{p.phone}
          </p>
        )}
        {p.ownerName && (
          <p className="text-[10px] text-[#B8112D]/80 mt-0.5 truncate font-medium">Owner: {p.ownerName}</p>
        )}
      </div>
    </div>
  );
}

export function ProjectDetailCell({ p }: { p: ProjectTableRow }) {
  const scope = p.projectScope || p.interestedService;
  return (
    <div className="min-w-0 bg-[#F8F9FC] rounded-xl px-2.5 py-2 border border-gray-100/80">
      {p.projectCode && (
        <span className="inline-flex bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-2 py-0.5 rounded-lg mb-1">
          {p.projectCode}
        </span>
      )}
      <p className="text-xs font-semibold text-[#0F172A] truncate flex items-center gap-1">
        <Briefcase size={10} className="text-[#B8112D] shrink-0" />
        {p.projectTitle ?? "—"}
      </p>
      {scope && scope !== "N/A" && (
        <p className="text-[10px] text-gray-500 truncate mt-0.5 pl-[14px]">{scope}</p>
      )}
    </div>
  );
}

export function QuotedAmountCell({ p }: { p: ProjectTableRow }) {
  const amount = parseMoney(p.projectBudget);
  return (
    <div className="min-w-0">
      {amount > 0 ? (
        <span className="inline-flex items-center bg-[#FFF1F3] text-[#B8112D] text-xs font-bold px-2.5 py-1 rounded-xl border border-[#f5c5ce] whitespace-nowrap">
          {formatQuotedAmount(p.projectBudget)}
        </span>
      ) : (
        <span className="text-[10px] text-gray-400">Not set</span>
      )}
    </div>
  );
}

export function PaymentDetailCell({ p }: { p: ProjectTableRow }) {
  const payments = parsePayments(p.projectPayments);
  const latest = latestPaidPayment(payments);
  const pct = paymentPercent(payments, p.projectBudget);
  const paidNum = payments.length > 0
    ? payments.filter((x) => x.isPaid).reduce((s, x) => s + parseMoney(x.amount), 0)
    : 0;

  return (
    <div className="flex items-start gap-2 min-w-0">
      <PaymentStatusCircle percent={pct} size={36} strokeWidth={3} />
      <div className="min-w-0 flex-1">
        {latest ? (
          <>
            <p className="text-[10px] xl:text-xs font-semibold text-[#065F46]">
              ${parseMoney(latest.amount).toLocaleString()} · {latest.type}
            </p>
            <p className="text-[9px] text-gray-400 truncate">{formatPaymentWhen(latest.paidAt)}</p>
          </>
        ) : paidNum > 0 ? (
          <p className="text-[10px] text-[#065F46] font-semibold">${paidNum.toLocaleString()} received</p>
        ) : (
          <p className="text-[10px] text-gray-400">No payments yet</p>
        )}
        {parseMoney(p.projectBudget) > 0 && (
          <p className="text-[9px] text-gray-400 mt-0.5">{Math.round(pct)}% collected</p>
        )}
      </div>
    </div>
  );
}

export function FulfillmentCell({ p }: { p: ProjectTableRow }) {
  const deadline = p.projectDeadline?.split("T")[0];
  const phase = p.projectPhase ?? "not_started";
  const phaseCls = phaseStyle[phase] ?? phaseStyle.not_started;

  return (
    <div className="min-w-0">
      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-lg mb-1.5 ${phaseCls}`}>
        {phaseLabel(phase)}
      </span>
      {deadline && deadline !== "N/A" && (
        <p className="text-[10px] xl:text-xs text-gray-600 flex items-center gap-1">
          <Calendar size={9} className="text-[#B8112D] shrink-0" />
          {deadline}
        </p>
      )}
    </div>
  );
}

export const PROJECT_TABLE_HEAD =
  "text-[10px] xl:text-[11px] font-semibold text-gray-400 uppercase tracking-wider";

export const PROJECT_TABLE_CARD =
  "bg-white rounded-2xl sm:rounded-[30px] border border-white shadow-sm overflow-hidden";
