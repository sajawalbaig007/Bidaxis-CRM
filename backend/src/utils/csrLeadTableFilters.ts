/** Same rules as the CSR Client Calls filters (state, phone area code, timezone, source, trade, search). */

export type CsrTableFilters = {
  q?: string;
  state?: string;
  tz?: string;
  phone?: string;
  source?: string;
  trade?: string;
};

export type FilterableLead = {
  name?: string | null;
  company?: string | null;
  phone?: string | null;
  state?: string | null;
  trade?: string | null;
  subTrades?: string | null;
  status?: string | null;
  nextSchedule?: string | null;
  hiddenOnMain?: boolean | null;
  notPickedCount?: number | null;
  notInterestedCount?: number | null;
  uploadFile?: { source?: { sudoName?: string | null } | null } | null;
};

export function hasCsrTableFilters(f?: CsrTableFilters | null): boolean {
  if (!f) return false;
  return Boolean(
    f.q?.trim() || f.state?.trim() || f.tz?.trim() || f.phone?.trim() || f.source?.trim() || f.trade?.trim(),
  );
}

export function csrTableFilterKey(f?: CsrTableFilters | null): string {
  if (!hasCsrTableFilters(f)) return "";
  return [f!.q, f!.state, f!.tz, f!.phone, f!.source, f!.trade]
    .map(v => (v ?? "").trim())
    .join("|");
}

const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" }, { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" }, { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" }, { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" }, { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "DC", name: "Washington D.C." },
];

const CA_PROVINCES: { code: string; name: string }[] = [
  { code: "AB", name: "Alberta" }, { code: "BC", name: "British Columbia" }, { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" }, { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" }, { code: "NT", name: "Northwest Territories" }, { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" }, { code: "PE", name: "Prince Edward Island" }, { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" }, { code: "YT", name: "Yukon" },
];

const ALL_LOCATIONS = [...US_STATES, ...CA_PROVINCES];

const STATE_AREA_CODES: Record<string, string[]> = {
  Alabama: ["205", "251", "256", "334", "938"],
  Alaska: ["907"],
  Arizona: ["480", "520", "602", "623", "928"],
  Arkansas: ["479", "501", "870"],
  California: ["209", "213", "310", "323", "408", "415", "424", "442", "510", "530", "559", "562", "619", "626", "628", "650", "657", "661", "669", "707", "714", "747", "760", "805", "818", "820", "831", "858", "909", "916", "925", "949", "951"],
  Colorado: ["303", "719", "720", "970"],
  Connecticut: ["203", "475", "860", "959"],
  Delaware: ["302"],
  Florida: ["239", "305", "321", "352", "386", "407", "561", "727", "754", "772", "786", "813", "850", "863", "904", "941", "954"],
  Georgia: ["229", "404", "470", "478", "678", "706", "762", "770", "912"],
  Hawaii: ["808"],
  Idaho: ["208", "986"],
  Illinois: ["217", "224", "309", "312", "331", "618", "630", "708", "773", "779", "815", "847", "872"],
  Indiana: ["219", "260", "317", "463", "574", "765", "812", "930"],
  Iowa: ["319", "515", "563", "641", "712"],
  Kansas: ["316", "620", "785", "913"],
  Kentucky: ["270", "364", "502", "606", "859"],
  Louisiana: ["225", "318", "337", "504", "985"],
  Maine: ["207"],
  Maryland: ["240", "301", "410", "443", "667"],
  Massachusetts: ["339", "351", "413", "508", "617", "774", "781", "857", "978"],
  Michigan: ["231", "248", "269", "313", "517", "586", "616", "734", "810", "906", "947", "989"],
  Minnesota: ["218", "320", "507", "612", "651", "763", "952"],
  Mississippi: ["228", "601", "662", "769"],
  Missouri: ["314", "417", "573", "636", "660", "816"],
  Montana: ["406"],
  Nebraska: ["308", "402", "531"],
  Nevada: ["702", "725", "775"],
  "New Hampshire": ["603"],
  "New Jersey": ["201", "551", "609", "640", "732", "848", "856", "862", "908", "973"],
  "New Mexico": ["505", "575"],
  "New York": ["212", "315", "332", "347", "516", "518", "585", "607", "631", "646", "680", "716", "718", "838", "845", "914", "917", "929", "934"],
  "North Carolina": ["252", "336", "704", "743", "828", "910", "919", "980", "984"],
  "North Dakota": ["701"],
  Ohio: ["216", "220", "234", "283", "326", "330", "380", "419", "440", "513", "567", "614", "740", "937"],
  Oklahoma: ["405", "539", "572", "580", "918"],
  Oregon: ["458", "503", "541", "971"],
  Pennsylvania: ["215", "223", "267", "272", "412", "445", "484", "570", "582", "610", "717", "724", "814", "878"],
  "Rhode Island": ["401"],
  "South Carolina": ["803", "839", "843", "854", "864"],
  "South Dakota": ["605"],
  Tennessee: ["423", "615", "629", "731", "865", "901", "931"],
  Texas: ["210", "214", "254", "281", "325", "346", "361", "409", "430", "432", "469", "512", "682", "713", "726", "737", "806", "817", "830", "832", "903", "915", "936", "940", "945", "956", "972", "979"],
  Utah: ["385", "435", "801"],
  Vermont: ["802"],
  Virginia: ["276", "434", "540", "571", "703", "757", "804"],
  Washington: ["206", "253", "360", "425", "509", "564"],
  "Washington D.C.": ["202"],
  "West Virginia": ["304", "681"],
  Wisconsin: ["262", "414", "534", "608", "715", "920"],
  Wyoming: ["307"],
  Alberta: ["403", "587", "780", "825"],
  "British Columbia": ["236", "250", "604", "672", "778"],
  Manitoba: ["204", "431"],
  "New Brunswick": ["506"],
  "Newfoundland and Labrador": ["709"],
  "Nova Scotia": ["782", "902"],
  "Northwest Territories": ["867"],
  Nunavut: ["867"],
  Ontario: ["226", "249", "289", "343", "365", "416", "437", "519", "548", "613", "647", "705", "807", "905"],
  "Prince Edward Island": ["782", "902"],
  Quebec: ["367", "418", "438", "450", "514", "579", "581", "819", "873"],
  Saskatchewan: ["306", "639"],
  Yukon: ["867"],
};

const AREA_CODE_TZ: Record<string, string> = {
  "201": "ET", "202": "ET", "203": "ET", "207": "ET", "212": "ET", "215": "ET", "216": "ET",
  "220": "ET", "223": "ET", "229": "ET", "231": "ET", "234": "ET", "239": "ET", "240": "ET",
  "248": "ET", "252": "ET", "260": "ET", "267": "ET", "269": "ET", "272": "ET", "276": "ET",
  "278": "ET", "301": "ET", "302": "ET", "304": "ET", "305": "ET", "313": "ET", "315": "ET",
  "317": "ET", "321": "ET", "330": "ET", "332": "ET", "336": "ET", "339": "ET", "347": "ET",
  "351": "ET", "352": "ET", "380": "ET", "386": "ET", "401": "ET", "404": "ET", "407": "ET",
  "410": "ET", "412": "ET", "413": "ET", "419": "ET", "423": "ET", "434": "ET", "440": "ET",
  "443": "ET", "445": "ET", "463": "ET", "470": "ET", "475": "ET", "478": "ET", "484": "ET",
  "502": "ET", "508": "ET", "513": "ET", "516": "ET", "517": "ET", "518": "ET", "540": "ET",
  "551": "ET", "561": "ET", "567": "ET", "570": "ET", "571": "ET", "574": "ET", "585": "ET",
  "586": "ET", "603": "ET", "606": "ET", "607": "ET", "610": "ET", "614": "ET", "616": "ET",
  "617": "ET", "631": "ET", "646": "ET", "667": "ET", "678": "ET", "680": "ET", "681": "ET",
  "689": "ET", "703": "ET", "704": "ET", "706": "ET", "716": "ET", "717": "ET", "718": "ET",
  "724": "ET", "727": "ET", "734": "ET", "740": "ET", "743": "ET", "754": "ET", "757": "ET",
  "762": "ET", "765": "ET", "770": "ET", "772": "ET", "774": "ET", "781": "ET", "786": "ET",
  "802": "ET", "803": "ET", "804": "ET", "810": "ET", "812": "ET", "813": "ET", "814": "ET",
  "828": "ET", "835": "ET", "839": "ET", "843": "ET", "845": "ET", "856": "ET", "857": "ET",
  "859": "ET", "860": "ET", "862": "ET", "863": "ET", "864": "ET", "865": "ET", "878": "ET",
  "904": "ET", "906": "ET", "908": "ET", "910": "ET", "912": "ET", "914": "ET", "917": "ET",
  "919": "ET", "929": "ET", "934": "ET", "937": "ET", "941": "ET", "947": "ET", "954": "ET",
  "959": "ET", "973": "ET", "978": "ET", "980": "ET", "984": "ET", "989": "ET",
  "205": "CT", "210": "CT", "214": "CT", "217": "CT", "218": "CT", "219": "CT", "224": "CT",
  "225": "CT", "228": "CT", "251": "CT", "254": "CT", "256": "CT", "262": "CT", "270": "CT",
  "281": "CT", "309": "CT", "312": "CT", "314": "CT", "316": "CT", "318": "CT", "319": "CT",
  "320": "CT", "325": "CT", "331": "CT", "334": "CT", "337": "CT", "346": "CT", "361": "CT",
  "364": "CT", "402": "CT", "405": "CT", "409": "CT", "414": "CT", "417": "CT", "430": "CT",
  "447": "CT", "464": "CT", "469": "CT", "479": "CT", "501": "CT", "504": "CT", "507": "CT",
  "512": "CT", "515": "CT", "531": "CT", "534": "CT", "539": "CT", "563": "CT", "573": "CT",
  "580": "CT", "601": "CT", "605": "CT", "608": "CT", "612": "CT", "615": "CT", "618": "CT",
  "620": "CT", "629": "CT", "630": "CT", "636": "CT", "641": "CT", "651": "CT", "659": "CT",
  "660": "CT", "662": "CT", "682": "CT", "701": "CT", "708": "CT", "712": "CT", "713": "CT",
  "715": "CT", "726": "CT", "731": "CT", "737": "CT", "763": "CT", "769": "CT", "773": "CT",
  "779": "CT", "785": "CT", "806": "CT", "815": "CT", "816": "CT", "817": "CT", "830": "CT",
  "832": "CT", "847": "CT", "850": "CT", "870": "CT", "872": "CT", "901": "CT", "903": "CT",
  "913": "CT", "918": "CT", "920": "CT", "931": "CT", "936": "CT", "938": "CT", "940": "CT",
  "952": "CT", "956": "CT", "972": "CT", "979": "CT", "985": "CT",
  "208": "MT", "303": "MT", "307": "MT", "385": "MT", "406": "MT", "432": "MT", "435": "MT",
  "480": "MT", "505": "MT", "520": "MT", "575": "MT", "602": "MT", "623": "MT", "719": "MT",
  "720": "MT", "801": "MT", "915": "MT", "928": "MT", "970": "MT", "986": "MT",
  "206": "PT", "209": "PT", "213": "PT", "253": "PT", "279": "PT", "310": "PT", "323": "PT",
  "360": "PT", "408": "PT", "415": "PT", "424": "PT", "425": "PT", "442": "PT", "458": "PT",
  "503": "PT", "509": "PT", "510": "PT", "530": "PT", "541": "PT", "559": "PT", "562": "PT",
  "564": "PT", "619": "PT", "626": "PT", "628": "PT", "650": "PT", "657": "PT", "661": "PT",
  "669": "PT", "702": "PT", "707": "PT", "714": "PT", "725": "PT", "747": "PT", "760": "PT",
  "775": "PT", "805": "PT", "818": "PT", "820": "PT", "831": "PT", "858": "PT", "909": "PT",
  "916": "PT", "925": "PT", "949": "PT", "951": "PT", "971": "PT",
  "907": "AKT", "808": "HST",
};

function phoneNationalDigits(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length >= 11 && digits.startsWith("1")) return digits.slice(1, 11);
  if (digits.length >= 10) return digits.slice(0, 10);
  return digits;
}

function phoneAreaCode(phone: string | null | undefined): string | null {
  const national = phoneNationalDigits(phone);
  if (national.length < 10) return null;
  return national.slice(0, 3);
}

function isPlaceholderState(state: string): boolean {
  const s = state.trim().toLowerCase();
  return !s || s === "n/a" || s === "na" || s === "unknown" || s === "-";
}

function stateMatches(itemState: string, filterName: string): boolean {
  const s = (itemState ?? "").trim().toLowerCase();
  if (!s || !filterName.trim()) return false;
  const f = filterName.trim().toLowerCase();
  if (s === f) return true;
  const target =
    ALL_LOCATIONS.find(l => l.name.toLowerCase() === f) ??
    ALL_LOCATIONS.find(l => l.code.toLowerCase() === f);
  if (!target) return s.includes(f);
  const code = target.code.toLowerCase();
  const name = target.name.toLowerCase();
  const filterIsDC = code === "dc" || name.includes("d.c.");
  const itemIsDC =
    /\bd\.?\s*c\.?\b/.test(s) ||
    s.includes("district of columbia") ||
    s.endsWith(", dc") ||
    s.endsWith(" dc");
  if (filterIsDC !== itemIsDC && (code === "wa" || code === "dc" || name.startsWith("washington"))) {
    return false;
  }
  if (s === code || s === name) return true;
  const parts = s.split(/[,/|·]/).map(p => p.trim()).filter(Boolean);
  if (parts.some(p => p === code || p === name)) return true;
  if (parts.some(p => p.includes(name) || name.includes(p))) return true;
  if (s.endsWith(` ${code}`) || s.endsWith(`, ${code}`)) return true;
  if (s.includes(name)) return true;
  return false;
}

function resolveKnownState(state: string): string | null {
  if (isPlaceholderState(state)) return null;
  for (const loc of ALL_LOCATIONS) {
    if (stateMatches(state, loc.name)) return loc.name;
  }
  return null;
}

function matchesState(state: string | null | undefined, phone: string | null | undefined, filterName: string): boolean {
  if (!filterName.trim()) return true;
  const stateVal = (state ?? "").trim();
  if (!isPlaceholderState(stateVal) && stateMatches(stateVal, filterName)) return true;
  const known = resolveKnownState(stateVal);
  if (known && known !== filterName) return false;
  const area = phoneAreaCode(phone);
  if (!area) return false;
  return (STATE_AREA_CODES[filterName] ?? []).includes(area);
}

function matchesPhone(phone: string | null | undefined, query: string): boolean {
  const typed = query.replace(/\D/g, "");
  if (!typed) return true;
  const national = phoneNationalDigits(phone);
  if (!national) return false;
  return national.startsWith(typed);
}

function standardTimezone(phone: string | null | undefined): string | null {
  const area = phoneAreaCode(phone);
  if (!area) return null;
  const abbr = AREA_CODE_TZ[area];
  if (!abbr) return null;
  if (abbr === "MST") return "MT";
  if (abbr === "ET" || abbr === "CT" || abbr === "MT" || abbr === "PT") return abbr;
  return null;
}

function matchesTimezone(phone: string | null | undefined, filterAbbr: string): boolean {
  if (!filterAbbr.trim()) return true;
  return standardTimezone(phone) === filterAbbr.trim();
}

function matchesTrade(trade: string | null | undefined, subTrades: string | null | undefined, filter: string): boolean {
  const want = filter.trim().toLowerCase();
  if (!want) return true;
  const parts = `${trade ?? ""}\n${subTrades ?? ""}`
    .split(/\s*(?:,|;|\||\n|·|•)\s*/)
    .map(p => p.replace(/^\d{1,2}\s+/, "").trim().toLowerCase())
    .filter(Boolean);
  if (parts.some(p => p === want)) return true;
  return parts.some(p => p.includes(want));
}

function matchesSearch(lead: FilterableLead, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const digits = query.replace(/\D/g, "");
  const hay = [lead.name, lead.company, lead.phone].some(v => (v ?? "").toLowerCase().includes(query));
  if (hay) return true;
  return digits.length >= 3 && (lead.phone ?? "").replace(/\D/g, "").includes(digits);
}

export function leadMatchesTableFilters(lead: FilterableLead, filters?: CsrTableFilters | null): boolean {
  if (!hasCsrTableFilters(filters)) return true;
  const f = filters!;
  if (!matchesState(lead.state, lead.phone, f.state ?? "")) return false;
  if (!matchesPhone(lead.phone, f.phone ?? "")) return false;
  if (!matchesTimezone(lead.phone, f.tz ?? "")) return false;
  if (f.source?.trim()) {
    const sudo = lead.uploadFile?.source?.sudoName?.trim().toLowerCase() ?? "";
    if (sudo !== f.source.trim().toLowerCase()) return false;
  }
  if (!matchesTrade(lead.trade, lead.subTrades, f.trade ?? "")) return false;
  if (!matchesSearch(lead, f.q ?? "")) return false;
  return true;
}

export const CSR_FILTER_LEAD_SELECT = {
  id: true,
  name: true,
  company: true,
  phone: true,
  state: true,
  trade: true,
  subTrades: true,
  status: true,
  nextSchedule: true,
  hiddenOnMain: true,
  notPickedCount: true,
  notInterestedCount: true,
  createdAt: true,
  uploadFile: { select: { source: { select: { sudoName: true } } } },
} as const;
