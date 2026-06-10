"use client";

import { useState } from "react";
import {
  X, Phone, Mail, Building2, History, Pencil, Check,
  Briefcase, CalendarDays, Globe, User2, MapPin, Plus, Clock3,
} from "lucide-react";
import API from "@/lib/api";

export type DetailLead = {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  state?: string;
  status?: string;
  interestedService?: string;
  followUpNotes?: string;
  nextSchedule?: string;
  nextTime?: string;
  timezone?: string;
};

export type DetailLeadUpdates = Partial<{
  name: string;
  phone: string;
  email: string;
  state: string;
  followUpNotes: string;
}>;

interface LeadDetailModalProps {
  lead: DetailLead;
  onClose: () => void;
  onSaved?: (id: string, updates: DetailLeadUpdates) => void;
}

const statusLabel = (s?: string) => {
  if (!s) return "—";
  if (s === "Not Interested" || s === "completed") return "Not Interested";
  if (s === "not picked" || s === "not completed") return "Not Picked";
  return s;
};

const statusBadgeClass = (s?: string) => {
  if (s === "important")    return "bg-pink-400/25 text-pink-100 border border-pink-300/30";
  if (s === "interested")   return "bg-amber-400/25 text-amber-100 border border-amber-300/30";
  if (s === "not picked" || s === "not completed") return "bg-orange-400/25 text-orange-100 border border-orange-300/30";
  if (s === "Not Interested" || s === "completed") return "bg-white/15 text-white/75 border border-white/20";
  if (s === "Close Client") return "bg-green-500/25 text-green-100 border border-green-400/30";
  return "bg-white/15 text-white/75 border border-white/20";
};

const inputClass    = "w-full h-11 rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors placeholder:text-gray-300";
const textareaClass = "w-full rounded-2xl border-2 border-gray-200 bg-[#FAFAFA] px-4 py-3 text-sm outline-none focus:border-[#B8112D] focus:bg-white transition-colors resize-none placeholder:text-gray-300";
const labelClass    = "text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5";

/* Parse "[timestamp] note text" lines into sticky-note entries */
const parseNotes = (raw?: string): { tag: string | null; text: string }[] => {
  if (!raw) return [];
  return raw.trim().split("\n").filter(Boolean).map(line => {
    const m = line.match(/^\[(.+?)\]\s*(.*)$/);
    return m ? { tag: m[1], text: m[2] } : { tag: null, text: line };
  });
};

export default function LeadDetailModal({ lead, onClose, onSaved }: LeadDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name,  setName]  = useState(lead.name ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [state, setState] = useState(lead.state ?? "");
  const [saving, setSaving] = useState(false);

  /* Sticky notes */
  const [notesRaw,    setNotesRaw]    = useState(lead.followUpNotes ?? "");
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote,     setNewNote]     = useState("");
  const [addingNote,  setAddingNote]  = useState(false);

  const startEdit = () => {
    setName(lead.name ?? "");
    setPhone(lead.phone ?? "");
    setEmail(lead.email ?? "");
    setState(lead.state ?? "");
    setIsEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await API.put(`/csr/lead/${lead.id}`, { name, phone, email, state });
      onSaved?.(lead.id, { name, phone, email, state });
      setIsEditing(false);
    } catch (err) {
      console.log(err);
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    const text = newNote.trim();
    if (!text) return;
    setAddingNote(true);
    const ts = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    const updated = [notesRaw, `[${ts}] ${text}`].filter(Boolean).join("\n");
    try {
      await API.put(`/csr/lead/${lead.id}`, { followUpNotes: updated });
      setNotesRaw(updated);
      setNewNote("");
      setShowAddNote(false);
      onSaved?.(lead.id, { followUpNotes: updated });
    } catch (err) {
      console.log(err);
    } finally {
      setAddingNote(false);
    }
  };

  const title = lead.company || lead.name;
  const noteEntries = parseNotes(notesRaw).reverse();

  const infoItems: { label: string; value: string; Icon: typeof Phone }[] = [
    { label: "Contact Person", value: lead.name, Icon: User2 },
    { label: "Phone", value: lead.phone || "N/A", Icon: Phone },
    { label: "Email", value: lead.email || "N/A", Icon: Mail },
    { label: "Location", value: lead.state || "N/A", Icon: MapPin },
  ];

  if (lead.company) {
    infoItems.push({ label: "Company", value: lead.company, Icon: Building2 });
  }
  if (lead.interestedService) {
    infoItems.push({ label: "Interested In", value: lead.interestedService, Icon: Briefcase });
  }
  if (lead.nextSchedule) {
    infoItems.push({
      label: "Next Schedule",
      value: lead.nextTime ? `${lead.nextSchedule} · ${lead.nextTime}` : lead.nextSchedule,
      Icon: CalendarDays,
    });
  }
  if (lead.timezone) {
    infoItems.push({ label: "Timezone", value: lead.timezone, Icon: Globe });
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-[540px] bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl flex flex-col overflow-hidden" style={{ maxHeight: "92vh" }}>

        {/* HEADER */}
        <div className="relative bg-gradient-to-br from-[#B8112D] to-[#8b0d22] px-5 sm:px-6 pt-5 pb-5 shrink-0 overflow-hidden">
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none"/>
          <div className="absolute -bottom-8 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none"/>
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors z-10">
            <X size={15}/>
          </button>
          <div className="flex items-center gap-3 pr-10">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {title.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight truncate">{title}</h2>
              {lead.company && lead.company !== lead.name && (
                <p className="text-white/65 text-xs mt-0.5 truncate">{lead.name}</p>
              )}
            </div>
          </div>
          {lead.status && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusBadgeClass(lead.status)}`}>
                {statusLabel(lead.status)}
              </span>
            </div>
          )}
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="px-5 sm:px-6 py-5 space-y-5">

            {!isEditing ? (
              <>
                <button onClick={startEdit}
                  className="w-full h-11 rounded-2xl bg-[#FFF1F3] border border-[#f5c5ce] text-[#B8112D] text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-[#fce8ec] transition-colors">
                  <Pencil size={13}/> Edit Details
                </button>

                {/* INFO GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {infoItems.map(({ label, value, Icon }) => (
                    <div key={label} className="bg-[#F8F9FC] rounded-2xl p-3.5">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon size={12} className="text-[#B8112D]"/>
                        <p className="text-gray-400 text-[11px]">{label}</p>
                      </div>
                      <p className="text-[#0F172A] text-[13px] font-semibold truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* CLIENT NAME */}
                <div>
                  <label className={`${labelClass} mb-2`}><User2 size={11} className="text-[#B8112D]"/>Client Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="e.g. John Smith" className={inputClass}/>
                </div>

                {/* PHONE + EMAIL */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`${labelClass} mb-2`}><Phone size={11} className="text-[#B8112D]"/>Phone Number</label>
                    <input type="text" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+1 234 567 890" className={inputClass}/>
                  </div>
                  <div>
                    <label className={`${labelClass} mb-2`}><Mail size={11} className="text-[#B8112D]"/>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="name@email.com" className={inputClass}/>
                  </div>
                </div>

                {/* LOCATION */}
                <div>
                  <label className={`${labelClass} mb-2`}><MapPin size={11} className="text-[#B8112D]"/>Location</label>
                  <input type="text" value={state} onChange={e => setState(e.target.value)}
                    placeholder="e.g. Texas, USA" className={inputClass}/>
                </div>

                {/* ACTIONS */}
                <div className="flex gap-3 pb-1">
                  <button onClick={() => setIsEditing(false)}
                    className="flex-1 h-12 rounded-2xl bg-[#F5F6FA] text-gray-600 font-semibold text-sm hover:bg-gray-100 transition-colors">
                    Cancel
                  </button>
                  <button onClick={save} disabled={saving}
                    className={`flex-1 h-12 rounded-2xl font-semibold text-sm text-white flex items-center justify-center gap-2 transition-all ${
                      !saving ? "bg-gradient-to-r from-[#B8112D] to-[#d4173a] shadow-md shadow-red-200" : "bg-gray-200 cursor-not-allowed text-gray-400"
                    }`}>
                    {saving ? (
                      <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"/>Saving...</>
                    ) : <><Check size={15}/>Save Changes</>}
                  </button>
                </div>
              </>
            )}

            {/* ══ STICKY NOTES ══ */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelClass}><History size={11} className="text-[#B8112D]"/>Notes</label>
                <button
                  onClick={() => { setShowAddNote(v => !v); setNewNote(""); }}
                  title="Add note"
                  className="w-7 h-7 rounded-full bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center hover:bg-[#B8112D] hover:text-white transition-colors">
                  <Plus size={14}/>
                </button>
              </div>

              {showAddNote && (
                <div className="mb-3 bg-[#F8F9FC] rounded-2xl p-3 space-y-2">
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={3}
                    placeholder="What was discussed in this call..." className={textareaClass}/>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowAddNote(false); setNewNote(""); }}
                      className="flex-1 h-9 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition-colors">
                      Cancel
                    </button>
                    <button onClick={addNote} disabled={!newNote.trim() || addingNote}
                      className="flex-1 h-9 rounded-xl bg-[#B8112D] text-white text-xs font-semibold disabled:opacity-50 hover:bg-[#a30f27] transition-colors">
                      {addingNote ? "Adding..." : "Add Note"}
                    </button>
                  </div>
                </div>
              )}

              {noteEntries.length > 0 ? (
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {noteEntries.map((entry, i) => (
                    <div key={i} className="bg-[#FFFBEB] border border-[#FDE9B0] rounded-2xl p-3">
                      {entry.tag && (
                        <div className="flex items-center gap-1 mb-1">
                          <Clock3 size={10} className="text-[#B8112D]"/>
                          <p className="text-[10px] font-semibold text-[#B8112D]">{entry.tag}</p>
                        </div>
                      )}
                      <p className="text-[#0F172A] text-[12px] leading-relaxed whitespace-pre-line">{entry.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-[13px]">No notes yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
