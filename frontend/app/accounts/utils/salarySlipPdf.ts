/**
 * Salary-slip PDF shared by BEM Solutions and GPS (Global Pre Construction Solution).
 * Company branding, officer and signature details come from SALARY_SLIP_COMPANIES.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  DEFAULT_SALARY_SLIP_COMPANY,
  SALARY_SLIP_COMPANIES,
  type SalarySlipCompanyKey,
} from "./salarySlipCompanies";

export type SalarySlipLine = {
  label: string;
  amount: number;
  qty?: string;
  /** Display-only rows (e.g. Total Commission) — excluded from earnings sum */
  includeInTotal?: boolean;
};

export type SalarySlipPayload = {
  companyKey?: SalarySlipCompanyKey;
  monthLabel: string;
  employeeName: string;
  employeeId?: string;
  address?: string;
  phone?: string;
  cnic?: string;
  earnings: SalarySlipLine[];
  deductions: SalarySlipLine[];
  comments?: string;
  employeePf?: number;
  employerPf?: number;
  projectCount?: number;
};

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function money(n: number): string {
  return (Number(n) || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 });
}

export function salarySlipMonthLabel(recordDate: string): string {
  const d = new Date(`${recordDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return recordDate;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function signatureTimestamp(d: Date): string {
  const pad = (n: number) => `${n}`.padStart(2, "0");
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const offsetMinutes = -d.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const tzH = pad(Math.floor(abs / 60));
  const tzM = pad(abs % 60);
  return `${year}.${month}.${day} ${hh}:${mm}:${ss}${sign}${tzH}'${tzM}'`;
}

function earningsTotal(lines: SalarySlipLine[]): number {
  return lines.reduce(
    (a, r) => a + (r.includeInTotal === false ? 0 : Number(r.amount) || 0),
    0,
  );
}

async function loadLogoForPdf(
  url: string,
  opts?: { stripWhite?: boolean },
): Promise<{ dataUrl: string; format: "PNG" | "JPEG"; width: number; height: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);

    const shouldStrip =
      opts?.stripWhite ?? (blob.type.includes("jpeg") || blob.type.includes("jpg"));
    if (shouldStrip) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i];
        const g = d[i + 1];
        const b = d[i + 2];
        const avg = (r + g + b) / 3;
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        if (avg > 248 && spread < 18) {
          d[i + 3] = 0;
        } else if (avg > 228 && spread < 28) {
          d[i + 3] = Math.min(d[i + 3], Math.round((255 - avg) * 10));
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }

    const dataUrl = canvas.toDataURL(shouldStrip ? "image/png" : blob.type.includes("png") ? "image/png" : "image/jpeg");
    const format: "PNG" | "JPEG" = shouldStrip || blob.type.includes("png") ? "PNG" : "JPEG";
    return { dataUrl, format, width: canvas.width, height: canvas.height };
  } catch {
    return null;
  }
}

function fitLogoBox(imgW: number, imgH: number, maxW: number, maxH: number): { w: number; h: number } {
  if (imgW <= 0 || imgH <= 0) return { w: maxW, h: maxH };
  const ratio = imgW / imgH;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return { w, h };
}

export async function downloadSalarySlipPdf(payload: SalarySlipPayload): Promise<void> {
  const key = payload.companyKey ?? DEFAULT_SALARY_SLIP_COMPANY;
  const company = SALARY_SLIP_COMPANIES[key];
  if (!company.slipReady) {
    throw new Error(`${company.label} salary-slip format is not ready yet.`);
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsPdfWithAutoTable;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const [ar, ag, ab] = hexToRgb(company.accent);

  const headerH = 28;
  const logoMaxW = key === "BEM" ? 36 : 22;
  const logoMaxH = key === "BEM" ? 14 : 18;

  doc.setFillColor(ar, ag, ab);
  doc.rect(0, 0, pageW, headerH, "F");

  const logo = company.logoUrl
    ? await loadLogoForPdf(company.logoUrl, { stripWhite: key === "BEM" })
    : null;

  let logoEndX = margin;
  if (logo) {
    const { w, h } = fitLogoBox(logo.width, logo.height, logoMaxW, logoMaxH);
    const logoY = (headerH - h) / 2;
    doc.addImage(logo.dataUrl, logo.format, margin, logoY, w, h);
    logoEndX = margin + w + 5;
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(company.brandLine, margin, 11);
    logoEndX = margin + 42;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const addrMaxW = pageW / 2 - logoEndX + 4;
  const addr = doc.splitTextToSize(company.address || "—", Math.max(40, addrMaxW));
  doc.text(addr, logoEndX, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("HEAD OFFICE", logoEndX, 19);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Tel: ${company.phone}`, pageW - margin, 11, { align: "right" });
  doc.text(company.email, pageW - margin, 16, { align: "right" });
  if (company.website) {
    doc.text(`Visit: ${company.website}`, pageW - margin, 21, { align: "right" });
  }

  let y = 36;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Salary Slip INVOICE", margin, y);
  doc.setFontSize(10);
  doc.setTextColor(ar, ag, ab);
  doc.text(payload.monthLabel, pageW - margin, y, { align: "right" });

  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  const info: [string, string][] = [
    ["Employee Name", payload.employeeName || "—"],
    ["Employee ID", payload.employeeId || "—"],
    ["Employee Address", payload.address || "—"],
    ["Phone", payload.phone || "—"],
    ["CNIC", payload.cnic || "—"],
    [
      "No of projects",
      payload.projectCount != null ? `${Math.max(0, Number(payload.projectCount) || 0)}` : "—",
    ],
  ];
  for (const [k, v] of info) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margin, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(v, pageW - margin * 2 - 42);
    doc.text(lines, margin + 42, y);
    y += Math.max(5.5, lines.length * 4.5);
  }

  y += 3;
  const earningsSum = earningsTotal(payload.earnings);
  const deductionsTotal = payload.deductions.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const netPay = earningsSum - deductionsTotal;
  const empPf = Number(payload.employeePf) || 0;
  const erPf = payload.employerPf != null ? Number(payload.employerPf) : empPf;

  const mid = pageW / 2;
  const colW = mid - margin - 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: mid + 2 },
    tableWidth: colW,
    head: [["Earnings", "Days/QTY", "Amount"]],
    body: [
      ...payload.earnings.map(r => [r.label, r.qty || "—", money(r.amount)]),
      ["Total Earnings", "", money(earningsSum)],
    ],
    theme: "grid",
    headStyles: { fillColor: [ar, ag, ab], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: colW * 0.48 },
      1: { cellWidth: colW * 0.24, halign: "center" },
      2: { cellWidth: colW * 0.28, halign: "right" },
    },
    didParseCell: data => {
      if (data.section === "body") {
        const row = payload.earnings[data.row.index];
        if (row?.includeInTotal === false) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [ar, ag, ab];
        }
        if (data.row.index === payload.earnings.length) {
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const leftFinalY = doc.lastAutoTable?.finalY ?? y;

  autoTable(doc, {
    startY: y,
    margin: { left: mid + 2, right: margin },
    tableWidth: colW,
    head: [["Deduction", "Amount"]],
    body: [
      ...payload.deductions.map(r => [r.label, money(r.amount)]),
      ["Total Deduction", money(deductionsTotal)],
    ],
    theme: "grid",
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: colW * 0.62 },
      1: { cellWidth: colW * 0.38, halign: "right" },
    },
    didParseCell: data => {
      if (data.section === "body" && data.row.index === payload.deductions.length) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const rightFinalY = doc.lastAutoTable?.finalY ?? y;
  y = Math.max(leftFinalY, rightFinalY) + 8;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Summary", "Amount"]],
    body: [
      ["Total Earnings", money(earningsSum)],
      ["Total Deduction", money(deductionsTotal)],
      ["Net Payment", money(netPay)],
      ["Net Employee PF Contribution", money(empPf)],
      ["Net Employer PF Contribution", money(erPf)],
    ],
    theme: "grid",
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: "bold" },
    bodyStyles: { fontSize: 9, textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
    },
    didParseCell: data => {
      if (data.section === "body" && data.row.index === 2) {
        data.cell.styles.textColor = [ar, ag, ab];
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 10;
      }
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Comments:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  const comments = doc.splitTextToSize(payload.comments?.trim() || "—", pageW - margin * 2);
  doc.text(comments, margin, y + 5);

  y += 5 + comments.length * 4.2 + 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(ar, ag, ab);
  doc.text("THANK YOU SO MUCH FOR YOUR EFFORTS!", pageW / 2, y, { align: "center" });

  y += 12;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Approved by:", margin, y);
  y += 5;
  doc.text("Account Officer", margin, y);
  y += 5;
  const accountOfficerName = company.accountOfficer || "Account Officer";
  doc.text(accountOfficerName, margin, y);

  const signedAt = signatureTimestamp(new Date());
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(22, 85, 153);
  const signatureLines = [
    `Digitally signed by ${accountOfficerName}`,
    "DN: C=PK,",
    `E=${company.email || "accounts@bemsolutions.io"},`,
    `O=${company.legalName}, OU=${company.key},`,
    `CN=${accountOfficerName}`,
    `Date: ${signedAt}`,
  ];
  doc.text(signatureLines, margin + 48, y - 7);

  y += 14;
  doc.setDrawColor(230);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `${company.legalName} · Confidential salary slip · Generated for month-end payroll`,
    pageW / 2,
    y,
    { align: "center" },
  );

  const safeName = (payload.employeeName || "Employee").replace(/[^\w\s-]/g, "").trim() || "Employee";
  const fileName = `${safeName} Salary Slip ${payload.monthLabel} — ${company.label}.pdf`;
  doc.save(fileName);
}
