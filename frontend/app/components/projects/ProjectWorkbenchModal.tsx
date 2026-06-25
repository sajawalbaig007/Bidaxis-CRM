"use client";

import { useEffect, useState } from "react";
import {
  X, ChevronDown, User2, Briefcase, DollarSign, Truck,
  Plus, Trash2, Save, Loader2, Link2, StickyNote, Hash, Calendar,
} from "lucide-react";
import ServicePicker from "@/app/csr/components/shared/ServicePicker";
import CommentCell from "@/app/csr/components/shared/CommentCell";
import { NoteEntry } from "@/app/csr/hooks/useLeadsData";
import {
  PAYMENT_TYPE_OPTIONS,
  PROJECT_PHASE_OPTIONS,
  ProjectPayment,
  ProjectWorkbenchData,
  CSR_ASSIGN_OTHER,
  newPaymentId,
  paidTotal,
  paymentPercent,
  parseMoney,
  stripBudgetForInput,
} from "@/lib/projectFields";
import PaymentStatusCircle from "@/app/csr/components/shared/PaymentStatusCircle";

type CSROption = { id: string; name: string; csrCode?: string | null };

type PhoneLookupProps = {
  phoneLookupLoading?: boolean;
  returningClient?: boolean;
  onPhoneValueChange?: (value: string) => void;
  onPhoneBlur?: (value: string) => void;
  onPhonePaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initial: ProjectWorkbenchData;
  mode: "admin" | "csr";
  createMode?: boolean;
  csrs?: CSROption[];
  saving?: boolean;
  onSave: (data: ProjectWorkbenchData) => Promise<void>;
  noteHistory?: NoteEntry[];
  onAddNote?: (text: string) => Promise<void>;
  phoneLookup?: PhoneLookupProps;
};

const inputCls =
  "w-full h-10 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-3 sm:px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors";
const labelCls =
  "text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 sm:mb-2 block";

function Section({
  title,
  icon: Icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl overflow-hidden border-2 transition-all ${
      open ? "border-[#B8112D]/30 shadow-sm shadow-[#B8112D]/5" : "border-gray-100"
    }`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${
          open ? "bg-gradient-to-r from-[#FFF1F3] to-white" : "bg-[#FAFAFA] hover:bg-gray-50"
        }`}
      >
        <span className="flex items-center gap-2.5 text-sm font-bold text-[#0F172A]">
          <span className={`w-8 h-8 rounded-xl flex items-center justify-center ${
            open ? "bg-[#B8112D] text-white" : "bg-[#FFF1F3] text-[#B8112D]"
          }`}>
            <Icon size={15} />
          </span>
          {title}
        </span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? "rotate-180 text-[#B8112D]" : ""}`} />
      </button>
      {open && <div className="p-4 sm:p-5 space-y-3 border-t border-[#B8112D]/10 bg-white">{children}</div>}
    </div>
  );
}

export default function ProjectWorkbenchModal({
  open,
  onClose,
  initial,
  mode,
  createMode = false,
  csrs = [],
  saving = false,
  onSave,
  noteHistory,
  onAddNote,
  phoneLookup,
}: Props) {
  const [data, setData] = useState<ProjectWorkbenchData>(initial);
  const [openSection, setOpenSection] = useState<string>("client");

  useEffect(() => {
    if (open) {
      setData(initial);
      setOpenSection("client");
    }
  }, [open, initial]);

  if (!open) return null;

  const budgetNum = parseMoney(data.projectBudget);
  const paidNum = paidTotal(data.projectPayments);
  const pct = paymentPercent(data.projectPayments, data.projectBudget);
  const remaining = Math.max(0, budgetNum - paidNum);

  const addPayment = () => {
    setData((d) => ({
      ...d,
      projectPayments: [
        ...d.projectPayments,
        { id: newPaymentId(), type: "Partial", amount: "", link: "", isPaid: false },
      ],
    }));
  };

  const updatePayment = (id: string, patch: Partial<ProjectPayment>) => {
    setData((d) => ({
      ...d,
      projectPayments: d.projectPayments.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...patch };
        if (patch.isPaid === true && !next.paidAt) next.paidAt = new Date().toISOString();
        if (patch.isPaid === false) next.paidAt = undefined;
        return next;
      }),
    }));
  };

  const removePayment = (id: string) => {
    setData((d) => ({ ...d, projectPayments: d.projectPayments.filter((p) => p.id !== id) }));
  };

  const toggleSection = (key: string) => setOpenSection((s) => (s === key ? "" : key));

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-[24px] sm:rounded-[28px] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-4 sm:px-6 pt-5 pb-5 shrink-0 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white z-10"
          >
            <X size={15} />
          </button>
          <div className="flex items-center gap-3 pr-10">
            <div className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {(data.projectTitle || data.name || "P").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">
                {createMode ? "Add New Project" : (data.projectTitle || data.name || "Project")}
              </h2>
              <p className="text-white/70 text-xs mt-0.5 truncate">
                {createMode
                  ? "Fill in client, project, payment & fulfillment details"
                  : `${data.name}${data.projectCode ? ` · ${data.projectCode}` : ""}`}
              </p>
            </div>
          </div>
          {data.projectCode && (
            <span className="inline-flex items-center gap-1 mt-3 bg-white/20 text-white px-2.5 py-1 rounded-full text-[11px] font-semibold">
              <Hash size={10} /> {data.projectCode}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3 bg-[#F5F6FA]">
          <Section
            title="Client Detail"
            icon={User2}
            open={openSection === "client"}
            onToggle={() => toggleSection("client")}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Client Name</label>
                <input className={inputCls} value={data.name}
                  onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Owner Name</label>
                <input className={inputCls} value={data.ownerName} placeholder="If available"
                  onChange={(e) => setData((d) => ({ ...d, ownerName: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Company</label>
                <input className={inputCls} value={data.company}
                  onChange={(e) => setData((d) => ({ ...d, company: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>
                  Phone
                  {createMode && phoneLookup && (
                    <span className="text-gray-300 normal-case font-normal"> (paste to auto-fill)</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    className={inputCls}
                    value={data.phone}
                    onChange={(e) => {
                      const value = e.target.value;
                      setData((d) => ({ ...d, phone: value }));
                      phoneLookup?.onPhoneValueChange?.(value);
                    }}
                    onBlur={(e) => phoneLookup?.onPhoneBlur?.(e.target.value)}
                    onPaste={phoneLookup?.onPhonePaste}
                  />
                  {phoneLookup?.phoneLookupLoading && (
                    <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B8112D] animate-spin" />
                  )}
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={data.email}
                  onChange={(e) => setData((d) => ({ ...d, email: e.target.value }))} />
              </div>
              {phoneLookup?.returningClient && (
                <div className="sm:col-span-2 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-xl">
                  <User2 size={12} className="shrink-0" />
                  Returning client — details auto-filled from previous record
                </div>
              )}
              {mode === "admin" ? (
                <>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>
                      Assigned CSR
                      {createMode && <span className="text-gray-300 normal-case font-normal"> (optional)</span>}
                    </label>
                    <select
                      className={inputCls}
                      value={data.assignedTo ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const csr = csrs.find((c) => c.id === val);
                        setData((d) => ({
                          ...d,
                          assignedTo: val,
                          csrName: csr?.name ?? d.csrName,
                          csrCode: csr?.csrCode ?? d.csrCode,
                          projectSource: val === CSR_ASSIGN_OTHER ? d.projectSource : "",
                        }));
                      }}
                    >
                      <option value="">— No CSR —</option>
                      <option value={CSR_ASSIGN_OTHER}>Other / External resource…</option>
                      {csrs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.csrCode ? `${c.csrCode} — ` : ""}{c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {data.assignedTo === CSR_ASSIGN_OTHER && (
                    <div className="sm:col-span-2">
                      <label className={labelCls}>Resource name *</label>
                      <input
                        className={inputCls}
                        value={data.projectSource ?? ""}
                        placeholder="e.g. Freelancer, Partner agency…"
                        onChange={(e) => setData((d) => ({ ...d, projectSource: e.target.value }))}
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="sm:col-span-2 bg-[#ECFDF5] rounded-xl px-3 py-2.5 border border-emerald-100">
                  <label className={labelCls}>CSR</label>
                  <p className="text-sm font-semibold text-[#065F46]">
                    {data.csrCode ? `${data.csrCode} · ` : ""}{data.csrName || "—"}
                  </p>
                </div>
              )}
            </div>
          </Section>

          <Section
            title="Project Detail"
            icon={Briefcase}
            open={openSection === "project"}
            onToggle={() => toggleSection("project")}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Project Code</label>
                <input className={inputCls} value={data.projectCode}
                  onChange={(e) => setData((d) => ({ ...d, projectCode: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Project Title</label>
                <input className={inputCls} value={data.projectTitle}
                  onChange={(e) => setData((d) => ({ ...d, projectTitle: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Service</label>
                <ServicePicker
                  value={data.interestedService}
                  onChange={(v) => setData((d) => ({ ...d, interestedService: v }))}
                />
              </div>
              <div>
                <label className={labelCls}>State</label>
                <input className={inputCls} value={data.state}
                  onChange={(e) => setData((d) => ({ ...d, state: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Scope</label>
                <textarea
                  className={`${inputCls} h-20 py-2.5 resize-none`}
                  value={data.projectScope}
                  placeholder="Project scope / deliverables"
                  onChange={(e) => setData((d) => ({ ...d, projectScope: e.target.value }))}
                />
              </div>
            </div>
          </Section>

          <Section
            title="Payment Detail"
            icon={DollarSign}
            open={openSection === "payment"}
            onToggle={() => toggleSection("payment")}
          >
            <div className="bg-gradient-to-br from-[#F8F9FC] to-white rounded-2xl border border-gray-100 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex justify-center sm:justify-start shrink-0">
                  <PaymentStatusCircle percent={pct} size={56} strokeWidth={4} />
                </div>
                <div className="grid grid-cols-3 gap-2 flex-1 min-w-0">
                  <div className="bg-emerald-50 rounded-xl px-2 py-2.5 text-center border border-emerald-100">
                    <p className="text-[9px] text-emerald-600 font-medium uppercase">Paid</p>
                    <p className="text-sm font-bold text-emerald-700">${paidNum.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#FFF1F3] rounded-xl px-2 py-2.5 text-center border border-[#f5c5ce]">
                    <p className="text-[9px] text-[#B8112D] font-medium uppercase">Quote</p>
                    <p className="text-sm font-bold text-[#B8112D]">${budgetNum.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl px-2 py-2.5 text-center border border-gray-100">
                    <p className="text-[9px] text-gray-500 font-medium uppercase">Due</p>
                    <p className="text-sm font-bold text-gray-700">${remaining.toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Quotation / Budget ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none select-none">$</span>
                  <input
                    className={`${inputCls} pl-8 font-semibold text-[#0F172A]`}
                    value={stripBudgetForInput(data.projectBudget)}
                    placeholder="0.00"
                    inputMode="decimal"
                    onChange={(e) => setData((d) => ({ ...d, projectBudget: e.target.value.replace(/[^0-9.]/g, "") }))}
                  />
                </div>
              </div>
            </div>

            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-1">
              Payment entries
            </p>
            <div className="space-y-3">
              {data.projectPayments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4 bg-[#FAFAFA] rounded-xl">
                  No payment entries yet — add one below
                </p>
              )}
              {data.projectPayments.map((p) => (
                <div
                  key={p.id}
                  className={`rounded-2xl p-3 sm:p-4 space-y-2.5 border-2 transition-colors ${
                    p.isPaid ? "border-emerald-200 bg-emerald-50/40" : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      className={inputCls}
                      value={p.type}
                      onChange={(e) => updatePayment(p.id, { type: e.target.value })}
                    >
                      {PAYMENT_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                      <input
                        className={`${inputCls} pl-6`}
                        placeholder="Amount"
                        value={p.amount}
                        onChange={(e) => updatePayment(p.id, { amount: e.target.value })}
                      />
                    </div>
                    <label className={`flex items-center justify-center gap-2 h-10 sm:h-11 rounded-xl border-2 text-xs font-bold cursor-pointer transition-colors ${
                      p.isPaid
                        ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                        : "border-gray-200 bg-[#FAFAFA] text-gray-500"
                    }`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={p.isPaid}
                        onChange={(e) => updatePayment(p.id, { isPaid: e.target.checked })}
                      />
                      {p.isPaid ? "✓ Paid" : "Unpaid"}
                    </label>
                    <button
                      type="button"
                      onClick={() => removePayment(p.id)}
                      className="h-10 sm:h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 border border-red-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link2 size={14} className="text-[#B8112D] shrink-0" />
                    <input
                      className={inputCls}
                      placeholder="Payment link (invoice / receipt URL)"
                      value={p.link ?? ""}
                      onChange={(e) => updatePayment(p.id, { link: e.target.value })}
                    />
                  </div>
                  {p.isPaid && p.paidAt && (
                    <p className="text-[10px] text-emerald-700 font-medium flex items-center gap-1">
                      <Calendar size={10} />
                      Paid on {new Date(p.paidAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addPayment}
              className="w-full h-10 rounded-xl border-2 border-dashed border-[#B8112D]/30 text-[#B8112D] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#FFF1F3] transition-colors"
            >
              <Plus size={14} /> Add payment entry
            </button>
          </Section>

          <Section
            title="Fulfillment & Milestones"
            icon={Truck}
            open={openSection === "fulfillment"}
            onToggle={() => toggleSection("fulfillment")}
          >
            <div>
              <label className={labelCls}>Project Status</label>
              <select
                className={inputCls}
                value={data.projectPhase}
                onChange={(e) => setData((d) => ({ ...d, projectPhase: e.target.value }))}
              >
                {PROJECT_PHASE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: "takeoffDeadline", label: "Takeoff Deadline" },
                { key: "pricingDeadline", label: "Pricing Deadline" },
                { key: "qaDeadline", label: "QA Deadline" },
                { key: "projectDeadline", label: "Client Delivery Date *" },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className={labelCls}>{label}</label>
                  <input
                    type="date"
                    className={inputCls}
                    value={data[key]}
                    onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </Section>

          {(createMode || (noteHistory && onAddNote)) && (
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <StickyNote size={12} className="text-[#B8112D]" /> Notes
              </p>
              {createMode ? (
                <textarea
                  className={`${inputCls} h-24 py-2.5 resize-none`}
                  value={data.projectNotes ?? ""}
                  placeholder="Project notes…"
                  onChange={(e) => setData((d) => ({ ...d, projectNotes: e.target.value }))}
                />
              ) : noteHistory && onAddNote ? (
                <CommentCell
                  id={data.id}
                  apiRole={mode === "admin" ? "admin" : "csr"}
                  noteHistory={noteHistory}
                  onAddNote={async (_id, text) => { await onAddNote(text); }}
                />
              ) : null}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100"
          >
            Close
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave(data)}
            className="flex-1 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#B8112D] to-[#d4173a] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-red-200"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? (createMode ? "Adding…" : "Saving…") : (createMode ? "Add Project" : "Save Changes")}
          </button>
        </div>
      </div>
    </div>
  );
}
