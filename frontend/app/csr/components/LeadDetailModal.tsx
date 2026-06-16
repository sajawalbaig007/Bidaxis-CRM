"use client";

import { useEffect, useState } from "react";
import {
  X, Phone, Mail, Building2, Pencil, Check,
  Briefcase, CalendarDays, Globe, User2, MapPin, Plus, Trash2, Users,
} from "lucide-react";
import API from "@/lib/api";
import { NoteEntry, SubContact } from "../hooks/useLeadsData";

export type DetailLead = {
  id: string;
  name: string;
  company?: string;
  rawCompany?: string;
  phone?: string;
  email?: string;
  state?: string;
  status?: string;
  interestedService?: string;
  followUpNotes?: string;
  nextSchedule?: string;
  nextTime?: string;
  timezone?: string;
  noteHistory?: NoteEntry[];
  subContacts?: SubContact[];
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
  onNoteAdded?: (id: string, note: NoteEntry) => void;
  onSubContactAdded?: (id: string, sub: SubContact) => void;
  onSubContactDeleted?: (id: string, subId: string) => void;
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

/* US state → timezone (best-effort, primary timezone per state) */
const STATE_TIMEZONES: Record<string, { label: string; abbreviation: string }> = {
  "washington d c": { label: "Eastern Time",          abbreviation: "ET"   },
  "washington dc":  { label: "Eastern Time",          abbreviation: "ET"   },
  "district of columbia": { label: "Eastern Time",    abbreviation: "ET"   },
  "north carolina": { label: "Eastern Time",          abbreviation: "ET"   },
  "south carolina": { label: "Eastern Time",          abbreviation: "ET"   },
  "new hampshire":  { label: "Eastern Time",          abbreviation: "ET"   },
  "rhode island":   { label: "Eastern Time",          abbreviation: "ET"   },
  "west virginia":  { label: "Eastern Time",          abbreviation: "ET"   },
  "north dakota":   { label: "Central Time",          abbreviation: "CT"   },
  "south dakota":   { label: "Central Time",          abbreviation: "CT"   },
  "new jersey":     { label: "Eastern Time",          abbreviation: "ET"   },
  "new mexico":     { label: "Mountain Time",         abbreviation: "MT"   },
  "new york":       { label: "Eastern Time",          abbreviation: "ET"   },
  alabama:          { label: "Central Time",          abbreviation: "CT"   },
  alaska:           { label: "Alaska Time",           abbreviation: "AKT"  },
  arizona:          { label: "Mountain Time (no DST)",abbreviation: "MST"  },
  arkansas:         { label: "Central Time",          abbreviation: "CT"   },
  california:       { label: "Pacific Time",          abbreviation: "PT"   },
  colorado:         { label: "Mountain Time",         abbreviation: "MT"   },
  connecticut:      { label: "Eastern Time",          abbreviation: "ET"   },
  delaware:         { label: "Eastern Time",          abbreviation: "ET"   },
  florida:          { label: "Eastern Time",          abbreviation: "ET"   },
  georgia:          { label: "Eastern Time",          abbreviation: "ET"   },
  hawaii:           { label: "Hawaii Time",           abbreviation: "HST"  },
  idaho:            { label: "Mountain Time",         abbreviation: "MT"   },
  illinois:         { label: "Central Time",          abbreviation: "CT"   },
  indiana:          { label: "Eastern Time",          abbreviation: "ET"   },
  iowa:             { label: "Central Time",          abbreviation: "CT"   },
  kansas:           { label: "Central Time",          abbreviation: "CT"   },
  kentucky:         { label: "Eastern Time",          abbreviation: "ET"   },
  louisiana:        { label: "Central Time",          abbreviation: "CT"   },
  maine:            { label: "Eastern Time",          abbreviation: "ET"   },
  maryland:         { label: "Eastern Time",          abbreviation: "ET"   },
  massachusetts:    { label: "Eastern Time",          abbreviation: "ET"   },
  michigan:         { label: "Eastern Time",          abbreviation: "ET"   },
  minnesota:        { label: "Central Time",          abbreviation: "CT"   },
  mississippi:      { label: "Central Time",          abbreviation: "CT"   },
  missouri:         { label: "Central Time",          abbreviation: "CT"   },
  montana:          { label: "Mountain Time",         abbreviation: "MT"   },
  nebraska:         { label: "Central Time",          abbreviation: "CT"   },
  nevada:           { label: "Pacific Time",          abbreviation: "PT"   },
  ohio:             { label: "Eastern Time",          abbreviation: "ET"   },
  oklahoma:         { label: "Central Time",          abbreviation: "CT"   },
  oregon:           { label: "Pacific Time",          abbreviation: "PT"   },
  pennsylvania:     { label: "Eastern Time",          abbreviation: "ET"   },
  tennessee:        { label: "Central Time",          abbreviation: "CT"   },
  texas:            { label: "Central Time",          abbreviation: "CT"   },
  utah:             { label: "Mountain Time",         abbreviation: "MT"   },
  vermont:          { label: "Eastern Time",          abbreviation: "ET"   },
  virginia:         { label: "Eastern Time",          abbreviation: "ET"   },
  washington:       { label: "Pacific Time",          abbreviation: "PT"   },
  wisconsin:        { label: "Central Time",          abbreviation: "CT"   },
  wyoming:          { label: "Mountain Time",         abbreviation: "MT"   },
};

/* 2-letter state code → full state name (for "TX", "Dallas, TX", etc.) */
const STATE_ABBREVIATIONS: Record<string, string> = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california",
  co: "colorado", ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia",
  hi: "hawaii", id: "idaho", il: "illinois", in: "indiana", ia: "iowa",
  ks: "kansas", ky: "kentucky", la: "louisiana", me: "maine", md: "maryland",
  ma: "massachusetts", mi: "michigan", mn: "minnesota", ms: "mississippi", mo: "missouri",
  mt: "montana", ne: "nebraska", nv: "nevada", nh: "new hampshire", nj: "new jersey",
  nm: "new mexico", ny: "new york", nc: "north carolina", nd: "north dakota", oh: "ohio",
  ok: "oklahoma", or: "oregon", pa: "pennsylvania", ri: "rhode island", sc: "south carolina",
  sd: "south dakota", tn: "tennessee", tx: "texas", ut: "utah", vt: "vermont",
  va: "virginia", wa: "washington", wv: "west virginia", wi: "wisconsin", wy: "wyoming",
  dc: "district of columbia",
};

const SORTED_STATE_NAMES = Object.keys(STATE_TIMEZONES).sort((a, b) => b.length - a.length);

/* Derive a US timezone from a free-form location string (state name, abbreviation, "City, State", etc.) */
const getTimezoneForState = (state?: string): { label: string; abbreviation: string } | null => {
  if (!state) return null;
  const normalized = state.toLowerCase().replace(/[^a-z]+/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  for (const name of SORTED_STATE_NAMES) {
    if (normalized.includes(name)) return STATE_TIMEZONES[name];
  }

  for (const token of normalized.split(" ")) {
    const fullName = STATE_ABBREVIATIONS[token];
    if (fullName) return STATE_TIMEZONES[fullName];
  }

  return null;
};

export default function LeadDetailModal({ lead, onClose, onSaved, onSubContactAdded, onSubContactDeleted }: LeadDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name,  setName]  = useState(lead.name ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [state, setState] = useState(lead.state ?? "");
  const [saving, setSaving] = useState(false);

  /* Sub-contacts — lazy-loaded on mount if not pre-populated */
  const [subs,       setSubs]       = useState<SubContact[]>(lead.subContacts ?? []);

  useEffect(() => {
    if ((lead.subContacts ?? []).length > 0) return; // already populated
    API.get(`/csr/lead/${lead.id}`)
      .then(res => setSubs(res.data.lead?.subContacts ?? []))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);
  const [showSubForm,setShowSubForm] = useState(false);
  const [subName,    setSubName]    = useState("");
  const [subDesig,   setSubDesig]   = useState("");
  const [subPhone,   setSubPhone]   = useState("");
  const [subEmail,   setSubEmail]   = useState("");
  const [addingSub,  setAddingSub]  = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const addSubContact = async () => {
    if (!subName.trim()) return;
    setAddingSub(true);
    try {
      const res = await API.post(`/csr/lead/${lead.id}/subcontacts`, {
        name: subName.trim(), designation: subDesig.trim(), phone: subPhone.trim(), email: subEmail.trim(),
      });
      const sub: SubContact = res.data.subContact ?? { id: Date.now().toString(), name: subName.trim(), designation: subDesig.trim(), phone: subPhone.trim(), email: subEmail.trim() };
      setSubs(prev => [...prev, sub]);
      onSubContactAdded?.(lead.id, sub);
      setSubName(""); setSubDesig(""); setSubPhone(""); setSubEmail(""); setShowSubForm(false);
    } catch (err) { console.log(err); }
    finally { setAddingSub(false); }
  };

  const deleteSubContact = async (subId: string) => {
    setDeletingId(subId);
    try {
      await API.delete(`/csr/lead/${lead.id}/subcontacts/${subId}`);
      setSubs(prev => prev.filter(s => s.id !== subId));
      onSubContactDeleted?.(lead.id, subId);
    } catch (err) { console.log(err); }
    finally { setDeletingId(null); }
  };

  const title = lead.company || lead.name;
  const locationDisplay = lead.state || lead.rawCompany || "N/A";
  const locationTimezone = getTimezoneForState(lead.state);

  const infoItems: { label: string; value: string; Icon: typeof Phone }[] = [
    { label: "Contact Person", value: lead.name, Icon: User2 },
    { label: "Phone", value: lead.phone || "N/A", Icon: Phone },
    { label: "Email", value: lead.email || "N/A", Icon: Mail },
    { label: "Location", value: locationDisplay, Icon: MapPin },
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
              {locationTimezone && (
                <p className="text-white/55 text-[11px] mt-0.5 truncate flex items-center gap-1">
                  <Globe size={10}/> {locationTimezone.label} ({locationTimezone.abbreviation})
                </p>
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

            {/* ══ SUB-CONTACTS ══ */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className={labelClass}><Users size={11} className="text-[#B8112D]"/>Sub Contacts</label>
                <button
                  onClick={() => { setShowSubForm(v => !v); setSubName(""); setSubDesig(""); setSubPhone(""); setSubEmail(""); }}
                  className="w-7 h-7 rounded-full bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center hover:bg-[#B8112D] hover:text-white transition-colors">
                  <Plus size={14}/>
                </button>
              </div>

              {showSubForm && (
                <div className="mb-3 bg-[#F8F9FC] rounded-2xl p-3 space-y-2">
                  <input
                    type="text" value={subName} onChange={e => setSubName(e.target.value)}
                    placeholder="Name *" className={inputClass}
                  />
                  <input
                    type="text" value={subDesig} onChange={e => setSubDesig(e.target.value)}
                    placeholder="Designation (e.g. Manager)" className={inputClass}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text" value={subPhone} onChange={e => setSubPhone(e.target.value)}
                      placeholder="Phone" className={inputClass}
                    />
                    <input
                      type="email" value={subEmail} onChange={e => setSubEmail(e.target.value)}
                      placeholder="Email" className={inputClass}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowSubForm(false)}
                      className="flex-1 h-9 rounded-xl bg-white border border-gray-200 text-gray-600 text-xs font-semibold">
                      Cancel
                    </button>
                    <button onClick={addSubContact} disabled={!subName.trim() || addingSub}
                      className="flex-1 h-9 rounded-xl bg-[#B8112D] text-white text-xs font-semibold disabled:opacity-50">
                      {addingSub ? "Adding…" : "Add Contact"}
                    </button>
                  </div>
                </div>
              )}

              {subs.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {subs.map(sub => (
                    <div key={sub.id} className="bg-[#F8F9FC] rounded-2xl p-3 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#B8112D] text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {sub.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-[#0F172A] truncate">{sub.name}</p>
                        {sub.designation && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub.designation}</p>}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {sub.phone && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                              <Phone size={9}/>{sub.phone}
                            </span>
                          )}
                          {sub.email && (
                            <span className="flex items-center gap-1 text-[11px] text-gray-500">
                              <Mail size={9}/>{sub.email}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSubContact(sub.id)}
                        disabled={deletingId === sub.id}
                        className="w-7 h-7 rounded-lg bg-[#FFF1F3] text-[#B8112D] flex items-center justify-center hover:bg-[#B8112D] hover:text-white transition-colors disabled:opacity-40 shrink-0">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                !showSubForm && <p className="text-gray-400 text-[13px]">No sub-contacts yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
