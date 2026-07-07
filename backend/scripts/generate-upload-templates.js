/**
 * Generates Excel upload templates for the admin Uploads page.
 * Run: node scripts/generate-upload-templates.js
 */
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "../../frontend/public/upload-templates");
fs.mkdirSync(outDir, { recursive: true });

const BASE_HEADERS = [
  "Client Name",
  "Client Company",
  "Phone",
  "Email",
  "State",
  "Interested Service",
];

const BASE_SAMPLES = [
  {
    "Client Name": "John Smith",
    "Client Company": "JC Air Conditioning",
    Phone: "2145550100",
    Email: "john@jcair.com",
    State: "Texas",
    "Interested Service": "HVAC Estimating",
  },
  {
    "Client Name": "Maria Garcia",
    "Client Company": "Sunrise Builders",
    Phone: "5125550199",
    Email: "maria@sunrise.com",
    State: "Austin, TX",
    "Interested Service": "Construction Takeoff",
  },
  {
    "Client Name": "Robert Chen",
    "Client Company": "Metro Electric Co",
    Phone: "7135550144",
    Email: "rchen@metroelectric.com",
    State: "Houston, TX",
    "Interested Service": "Electrical Estimating",
  },
];

const ACTIVE_HEADERS = [
  ...BASE_HEADERS,
  "Client Code",
  "Project Detail",
  "Quotation",
];

const ACTIVE_SAMPLES = [
  {
    "Client Name": "John Smith",
    "Client Company": "JC Air Conditioning",
    Phone: "2145550100",
    Email: "john@jcair.com",
    State: "Texas",
    "Interested Service": "HVAC Estimating",
    "Client Code": "JC-001",
    "Project Detail": "Commercial HVAC Bid — Dallas Office",
    Quotation: "4500",
  },
  {
    "Client Name": "Maria Garcia",
    "Client Company": "Sunrise Builders",
    Phone: "5125550199",
    Email: "maria@sunrise.com",
    State: "Austin, TX",
    "Interested Service": "Construction Takeoff",
    "Client Code": "SB-102",
    "Project Detail": "Residential framing takeoff",
    Quotation: "2800",
  },
];

const TEMPLATES = [
  {
    file: "CRM-Call-Data-Template.xlsx",
    sheet: "Call Data",
    headers: BASE_HEADERS,
    samples: BASE_SAMPLES,
    instructions: [
      "Upload box: Upload New Leads",
      "Step 1 in modal: Call Data (daily call list)",
      "Leads go to CSR Call Data / Today Links as pending",
      "Required per row: Client Name OR Phone (7+ digits)",
      "Optional: Client Company, Email, State, Interested Service",
      "Delete sample rows and add your own data before upload",
    ],
  },
  {
    file: "CRM-New-Clients-Template.xlsx",
    sheet: "New Clients",
    headers: BASE_HEADERS,
    samples: BASE_SAMPLES,
    instructions: [
      "Upload box: Upload New Leads",
      "Step 1 in modal: Clients → New Client (first-time)",
      "Leads go to CSR Clients tab as won / Close Client",
      "Required per row: Client Name OR Phone",
      "Same columns as Call Data template",
      "Delete sample rows before upload",
    ],
  },
  {
    file: "CRM-Old-Clients-Template.xlsx",
    sheet: "Old Clients",
    headers: BASE_HEADERS,
    samples: BASE_SAMPLES,
    instructions: [
      "Upload box: Upload New Leads",
      "Step 1 in modal: Clients → Old Client (returning / repeat)",
      "Leads go to CSR Old Clients tab",
      "Required per row: Client Name OR Phone",
      "Use for clients who already worked with you before",
      "Delete sample rows before upload",
    ],
  },
  {
    file: "CRM-Interested-Clients-Template.xlsx",
    sheet: "Interested",
    headers: BASE_HEADERS,
    samples: BASE_SAMPLES,
    instructions: [
      "Upload box: Interested Clients",
      "Status after upload: interested (new client pipeline)",
      "Required per row: Client Name OR Phone",
      "Optional: Client Company, Email, State, Interested Service",
      "Delete sample rows before upload",
    ],
  },
  {
    file: "CRM-Important-Clients-Template.xlsx",
    sheet: "Important",
    headers: BASE_HEADERS,
    samples: BASE_SAMPLES,
    instructions: [
      "Upload box: Previous Important Clients",
      "Status after upload: important (old / known clients)",
      "Required per row: Client Name OR Phone",
      "Optional: Client Company, Email, State, Interested Service",
      "Delete sample rows before upload",
    ],
  },
  {
    file: "CRM-Active-Projects-Template.xlsx",
    sheet: "Active Projects",
    headers: ACTIVE_HEADERS,
    samples: ACTIVE_SAMPLES,
    instructions: [
      "Upload box: Active Projects",
      "Extra columns: Client Code, Project Detail, Quotation",
      "Client Code: unique code per project (updates existing if same code)",
      "Project Detail: project title / description",
      "Quotation: budget or quote amount (numbers only, no $ sign)",
      "Required: Client Name",
      "Delete sample rows before upload",
    ],
  },
];

function writeTemplate({ file, sheet, headers, samples, instructions }) {
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.json_to_sheet(samples, { header: headers });
  ws["!cols"] = headers.map(h => ({
    wch: Math.max(h.length, ...samples.map(r => String(r[h] ?? "").length)) + 2,
  }));
  XLSX.utils.book_append_sheet(wb, ws, sheet);

  const instrData = instructions.map((line, i) => ({
    Step: i + 1,
    Instruction: line,
  }));
  const wsInstr = XLSX.utils.json_to_sheet(instrData);
  wsInstr["!cols"] = [{ wch: 6 }, { wch: 72 }];
  XLSX.utils.book_append_sheet(wb, wsInstr, "How to Use");

  const outPath = path.join(outDir, file);
  XLSX.writeFile(wb, outPath);
  console.log("Created:", outPath);
}

for (const t of TEMPLATES) writeTemplate(t);
console.log(`\nDone — ${TEMPLATES.length} templates in ${outDir}`);
