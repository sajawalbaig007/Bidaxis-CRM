"use client";

import PaymentStatusCircle from "@/app/csr/components/shared/PaymentStatusCircle";
import type { ReactNode } from "react";
import {
  formatPaymentWhen,
  formatQuotedAmount,
  latestPaidPayment,
  parseMoney,
  parsePayments,
  paymentPercent,
  ProjectPayment,
} from "@/lib/projectFields";
import { User2, Briefcase, Building2, Phone, Mail, MapPin, Calendar } from "lucide-react";

export type ProjectTableRow = {
  id: string;
  name: string | null;
  company?: string | null;
  ownerName?: string | null;
  phone: string | null;
  email: string | null;
  projectCode?: string | null;
  clientCode?: string | null;
  projectTitle: string | null;
  projectScope?: string | null;
  interestedService: string | null;
  projectBudget: string | null;
  projectDeadline: string | null;
  projectPhase?: string | null;
  projectPayments?: ProjectPayment[] | string | null;
  state?: string | null;
  timezone?: string | null;
};

function cleanVal(v?: string | null): string | null {
  const s = v?.trim();
  if (!s || s === "N/A" || s === "—") return null;
  return s;
}

function DetailLine({
  icon,
  children,
  className = "text-gray-600",
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[10px] xl:text-[11px] truncate flex items-center gap-1 min-w-0 ${className}`}>
      {icon}
      <span className="truncate">{children}</span>
    </p>
  );
}

export function ClientDetailCell({ p }: { p: ProjectTableRow }) {
  const company = cleanVal(p.company);
  const client = cleanVal(p.name);
  const phone = cleanVal(p.phone);
  const email = cleanVal(p.email);

  return (
    <div className="min-w-0 space-y-0.5">
      {company && (
        <DetailLine icon={<Building2 size={9} className="text-[#B8112D] shrink-0" />} className="font-semibold text-[#0F172A]">
          {company}
        </DetailLine>
      )}
      {client && (
        <DetailLine icon={<User2 size={9} className="text-gray-400 shrink-0" />} className="font-medium text-[#0F172A]">
          {client}
        </DetailLine>
      )}
      {phone && (
        <DetailLine icon={<Phone size={9} className="text-gray-400 shrink-0" />}>
          {phone}
        </DetailLine>
      )}
      {email && (
        <DetailLine icon={<Mail size={9} className="text-gray-400 shrink-0" />} className="text-gray-500">
          {email}
        </DetailLine>
      )}
      {!company && !client && !phone && !email && (
        <span className="text-[10px] text-gray-400">—</span>
      )}
    </div>
  );
}

export function ProjectDetailCell({ p }: { p: ProjectTableRow }) {
  const code = cleanVal(p.projectCode) || cleanVal(p.clientCode);
  const title = cleanVal(p.projectTitle);
  const scope = cleanVal(p.projectScope);
  const state = cleanVal(p.state);

  return (
    <div className="min-w-0 bg-[#F8F9FC] dark:bg-crm-muted rounded-xl px-2.5 py-2 border border-gray-100/80 dark:border-crm-border-subtle space-y-1">
      {code && (
        <div>
          <p className="text-[8px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Project Code</p>
          <span className="inline-flex bg-[#B8112D]/10 text-[#B8112D] text-[10px] font-bold px-2 py-0.5 rounded-lg">
            {code}
          </span>
        </div>
      )}
      {title && (
        <div>
          <p className="text-[8px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Project Detail</p>
          <p className="text-xs font-semibold text-[#0F172A] dark:text-crm-text truncate flex items-center gap-1">
            <Briefcase size={10} className="text-[#B8112D] shrink-0" />
            {title}
          </p>
        </div>
      )}
      {state && (
        <div>
          <p className="text-[8px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">State</p>
          <p className="text-[10px] text-gray-600 dark:text-crm-text-muted truncate">{state}</p>
        </div>
      )}
      {scope && (
        <div>
          <p className="text-[8px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">Scope</p>
          <DetailLine icon={<MapPin size={9} className="text-gray-400 shrink-0" />}>
            {scope}
          </DetailLine>
        </div>
      )}
      {!code && !title && !state && !scope && (
        <span className="text-[10px] text-gray-400">—</span>
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

  return (
    <div className="min-w-0">
      <p className="text-[8px] font-bold uppercase tracking-wide text-gray-400 mb-1">Client Deadline</p>
      {deadline && deadline !== "N/A" ? (
        <p className="text-[10px] xl:text-xs text-gray-700 font-semibold flex items-center gap-1">
          <Calendar size={9} className="text-[#B8112D] shrink-0" />
          {deadline}
        </p>
      ) : (
        <span className="text-[10px] text-gray-400">—</span>
      )}
    </div>
  );
}

export const PROJECT_TABLE_HEAD =
  "text-[10px] xl:text-[11px] font-semibold text-crm-text-faint uppercase tracking-wider";

export const PROJECT_TABLE_CARD =
  "crm-table-card rounded-2xl sm:rounded-[30px] border shadow-sm overflow-hidden";
