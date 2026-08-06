/**
 * Three salary-slip PDF layouts matching company templates:
 * - gps_technical  → Global / GPS technical team (purple invoice style)
 * - bem_sales      → BEM sales team reps
 * - bem_csr_full   → BEM CSR / Hammad team-lead full invoice
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { SalarySlipCompany } from "./salarySlipCompanies";
import {
  BEM_NAVY,
  FIELD_BLUE,
  GPS_INK,
  GPS_PURPLE,
  earningsTotal,
  fitLogoBox,
  hexToRgb,
  loadLogoForPdf,
  money,
  type JsPdfWithAutoTable,
  type SalarySlipPayload,
} from "./salarySlipShared";

const margin = 14;

async function drawLogo(
  doc: JsPdfWithAutoTable,
  company: SalarySlipCompany,
  key: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
) {
  if (!company.logoUrl) return 0;
  const logo = await loadLogoForPdf(company.logoUrl, { stripWhite: key === "BEM" });
  if (!logo) return 0;
  const { w, h } = fitLogoBox(logo.width, logo.height, maxW, maxH);
  doc.addImage(logo.dataUrl, logo.format, x, y, w, h);
  return w;
}

function drawEmployeeFields(
  doc: JsPdfWithAutoTable,
  payload: SalarySlipPayload,
  startY: number,
  pageW: number,
  withBlueFields: boolean,
): number {
  const labelW = 38;
  const valueX = margin + labelW;
  const valueW = pageW - margin * 2 - labelW;
  const rows: [string, string][] = [
    ["Employee Name", payload.employeeName || ""],
    ["Employee ID", payload.employeeId || ""],
    ["Employee address", payload.address || ""],
    ["Phone", payload.phone || ""],
    ["CNIC", payload.cnic || ""],
    [
      payload.projectCount != null ? "No. of projects" : "No of projects",
      payload.projectCount != null ? `${Math.max(0, Number(payload.projectCount) || 0)}` : "",
    ],
  ];

  let y = startY;
  doc.setFontSize(9);
  for (const [label, value] of rows) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40, 40, 40);
    doc.text(`${label}:`, margin, y);

    const rowH = label.toLowerCase().includes("address") ? 10 : 7;
    if (withBlueFields) {
      doc.setFillColor(...FIELD_BLUE);
      doc.rect(valueX, y - 4.5, valueW, rowH, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    const lines = doc.splitTextToSize(value || " ", valueW - 2);
    doc.text(lines, valueX + 1.5, y);
    y += label.toLowerCase().includes("address") ? 12 : 8;
  }
  return y + 2;
}

function earningsDeductionTables(
  doc: JsPdfWithAutoTable,
  payload: SalarySlipPayload,
  y: number,
  pageW: number,
  headColor: [number, number, number],
  deductionHeadColor: [number, number, number] = BEM_NAVY,
) {
  const earningsSum = earningsTotal(payload.earnings);
  const deductionsTotal = payload.deductions.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const mid = pageW / 2;
  const colW = mid - margin - 2;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: mid + 2 },
    tableWidth: colW,
    head: [
      [{ content: "Earnings", colSpan: 3, styles: { halign: "center" } }],
      ["Pays", "Days/QTY", "Amount"],
    ],
    body: [
      ...payload.earnings.map(r => [r.label, r.qty || "—", money(r.amount)]),
      [{ content: "Total Earnings", colSpan: 2, styles: { fontStyle: "bold" } }, money(earningsSum)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: headColor,
      textColor: headColor === GPS_PURPLE ? GPS_INK : 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: colW * 0.46 },
      1: { cellWidth: colW * 0.24, halign: "center" },
      2: { cellWidth: colW * 0.3, halign: "right" },
    },
    didParseCell: data => {
      if (data.section === "body" && data.row.index === payload.earnings.length) {
        data.cell.styles.fontStyle = "bold";
        if (data.column.index === 0) {
          data.cell.styles.fillColor = headColor;
          data.cell.styles.textColor = headColor === GPS_PURPLE ? GPS_INK : 255;
        }
      }
    },
  });

  const leftY = doc.lastAutoTable?.finalY ?? y;

  autoTable(doc, {
    startY: y,
    margin: { left: mid + 2, right: margin },
    tableWidth: colW,
    head: [
      [{ content: "Deductions", colSpan: 2, styles: { halign: "center" } }],
      ["Deduction", "Amount"],
    ],
    body: [
      ...payload.deductions.map(r => [r.label, money(r.amount)]),
      [{ content: "Total Deduction", styles: { fontStyle: "bold" } }, money(deductionsTotal)],
    ],
    theme: "grid",
    headStyles: {
      fillColor: deductionHeadColor,
      textColor: deductionHeadColor === GPS_INK ? 255 : 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    bodyStyles: { fontSize: 8, textColor: [40, 40, 40] },
    columnStyles: {
      0: { cellWidth: colW * 0.62 },
      1: { cellWidth: colW * 0.38, halign: "right" },
    },
    didParseCell: data => {
      if (data.section === "body" && data.row.index === payload.deductions.length) {
        data.cell.styles.fontStyle = "bold";
        if (data.column.index === 0) {
          data.cell.styles.fillColor = deductionHeadColor;
          data.cell.styles.textColor = 255;
        }
      }
    },
  });

  const rightY = doc.lastAutoTable?.finalY ?? y;
  return { y: Math.max(leftY, rightY) + 6, earningsSum, deductionsTotal };
}

function summaryRows(
  doc: JsPdfWithAutoTable,
  y: number,
  pageW: number,
  rows: [string, string][],
  labelColor: [number, number, number],
  highlightRow?: number,
  highlightRgb?: [number, number, number],
) {
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    body: rows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: {
      0: {
        cellWidth: pageW - margin * 2 - 45,
        fillColor: labelColor,
        textColor: labelColor === GPS_PURPLE ? GPS_INK : 255,
        fontStyle: "bold",
      },
      1: { halign: "right", fontStyle: "bold", fillColor: FIELD_BLUE, textColor: [20, 32, 57] },
    },
    didParseCell: data => {
      if (highlightRow != null && data.row.index === highlightRow && highlightRgb) {
        data.cell.styles.textColor = highlightRgb;
        data.cell.styles.fontSize = 9;
      }
    },
  });
  return (doc.lastAutoTable?.finalY ?? y) + 6;
}

/** Global / GPS — technical team (purple invoice reference). */
export async function renderGpsTechnicalSlip(
  doc: JsPdfWithAutoTable,
  payload: SalarySlipPayload,
  company: SalarySlipCompany,
): Promise<void> {
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(...GPS_PURPLE);
  doc.circle(pageW - 8, 8, 22, "F");

  await drawLogo(doc, company, "GPS", margin, 8, 68, 22);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(30, 30, 30);
  doc.text("Salary Slip ", pageW / 2 - 18, 18, { align: "left" });
  doc.setTextColor(...GPS_INK);
  doc.text("Invoice:", pageW / 2 + 14, 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...GPS_INK);
  doc.text(payload.monthLabel, pageW - margin, 18, { align: "right" });

  let y = drawEmployeeFields(doc, payload, 32, pageW, false);
  const { y: tableY, earningsSum, deductionsTotal } = earningsDeductionTables(
    doc,
    payload,
    y,
    pageW,
    GPS_PURPLE,
    GPS_INK,
  );
  const netPay = earningsSum - deductionsTotal;
  const empPf = Number(payload.employeePf) || 0;
  const erPf = payload.employerPf != null ? Number(payload.employerPf) : empPf;

  summaryRows(
    doc,
    tableY,
    pageW,
    [
      ["Net Employee PF Contribution", money(empPf)],
      ["Net Employer PF Contribution", money(erPf)],
      ["Total Earnings", money(earningsSum)],
      ["Total Deduction", money(deductionsTotal)],
      ["Net Payment", money(netPay)],
    ],
    GPS_PURPLE,
    4,
    GPS_INK,
  );
}

/** BEM — sales team reps. */
export async function renderBemSalesSlip(
  doc: JsPdfWithAutoTable,
  payload: SalarySlipPayload,
  company: SalarySlipCompany,
): Promise<void> {
  const pageW = doc.internal.pageSize.getWidth();
  const [ar, ag, ab] = hexToRgb(company.accent);

  await drawLogo(doc, company, "BEM", margin, 10, 42, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  const titleMid = pageW / 2;
  doc.text("Salary Slip ", titleMid - 16, 16, { align: "left" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(ar, ag, ab);
  doc.text("INVOICE:", titleMid + 10, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(ar, ag, ab);
  doc.text(payload.monthLabel, pageW - margin, 16, { align: "right" });

  const y0 = drawEmployeeFields(doc, payload, 28, pageW, false);
  const { y: tableY, earningsSum, deductionsTotal } = earningsDeductionTables(doc, payload, y0, pageW, BEM_NAVY);
  const netPay = earningsSum - deductionsTotal;
  const empPf = Number(payload.employeePf) || 0;
  const erPf = payload.employerPf != null ? Number(payload.employerPf) : empPf;

  let y = summaryRows(
    doc,
    tableY,
    pageW,
    [
      ["Net Employee PF Contribution", money(empPf)],
      ["Net Employer PF Contribution", money(erPf)],
      ["Total Earnings", money(earningsSum)],
      ["Total Deduction", money(deductionsTotal)],
      ["Net Payment", money(netPay)],
    ],
    BEM_NAVY,
    4,
    [ar, ag, ab],
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Comments:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(payload.comments?.trim() || "—", pageW - margin * 2), margin, y + 5);

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(ar, ag, ab);
  doc.text("THANK YOU SO MUCH FOR YOUR EFFORTS!", pageW / 2, y, { align: "center" });
}

/** BEM — CSR / Hammad team-lead full invoice. */
export async function renderBemCsrFullSlip(
  doc: JsPdfWithAutoTable,
  payload: SalarySlipPayload,
  company: SalarySlipCompany,
): Promise<void> {
  const pageW = doc.internal.pageSize.getWidth();
  const [ar, ag, ab] = hexToRgb(company.accent);
  const monthBox = payload.monthCompact || payload.monthLabel;

  await drawLogo(doc, company, "BEM", margin, 8, 44, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  const titleX = pageW / 2;
  doc.text("Salary Slip ", titleX - 22, 14, { align: "left" });
  doc.setFont("helvetica", "bold");
  doc.setTextColor(ar, ag, ab);
  doc.text("INVOICE:", titleX + 8, 14);

  const boxW = Math.max(28, doc.getTextWidth(monthBox) + 8);
  doc.setFillColor(...FIELD_BLUE);
  doc.rect(pageW - margin - boxW, 8, boxW, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(ar, ag, ab);
  doc.text(monthBox, pageW - margin - boxW / 2, 13.5, { align: "center" });

  const y0 = drawEmployeeFields(doc, payload, 26, pageW, true);
  const { y: tableY, earningsSum, deductionsTotal } = earningsDeductionTables(doc, payload, y0, pageW, BEM_NAVY);
  const netPay = earningsSum - deductionsTotal;
  const empPf = Number(payload.employeePf) || 0;
  const erPf = payload.employerPf != null ? Number(payload.employerPf) : empPf;

  let y = summaryRows(
    doc,
    tableY,
    pageW,
    [
      ["Net Employee PF Contribution", money(empPf)],
      ["Net Employer PF Contribution", money(erPf)],
      ["Total Earnings", money(earningsSum)],
      ["Total Deduction", money(deductionsTotal)],
      ["Net Payment", money(netPay)],
    ],
    BEM_NAVY,
    4,
    [ar, ag, ab],
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 40, 40);
  doc.text("Comments :", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(doc.splitTextToSize(payload.comments?.trim() || " ", pageW - margin * 2), margin + 24, y);

  y += 14;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  const thanks = "THANK YOU SO MUCH FOR YOUR ";
  const efforts = "EFFORTS!";
  const thanksW = doc.getTextWidth(thanks);
  const totalW = thanksW + doc.getTextWidth(efforts);
  const startX = (pageW - totalW) / 2;
  doc.text(thanks, startX, y);
  doc.setTextColor(ar, ag, ab);
  doc.text(efforts, startX + thanksW, y);

  y += 12;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.text("Approved by: Account Officer", margin, y);
  y += 5;
  doc.text(company.accountOfficer || "Muhammad Bilal", margin, y);
  doc.setFillColor(...FIELD_BLUE);
  doc.rect(margin, y + 2, 52, 14, "F");

  const footerY = doc.internal.pageSize.getHeight() - 18;
  doc.setFillColor(245, 242, 235);
  doc.rect(0, footerY, pageW, 18, "F");
  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.text(`Tel: ${company.phone}`, margin, footerY + 6);
  doc.text(company.address || "", margin, footerY + 11);
  doc.setFont("helvetica", "bold");
  doc.text("HEAD OFFICE", margin + 52, footerY + 11);
  doc.setFont("helvetica", "normal");
  doc.text("YouTube · Facebook · Instagram · LinkedIn", pageW / 2, footerY + 9, { align: "center" });
  await drawLogo(doc, company, "BEM", pageW - margin - 16, footerY + 3, 14, 10);
}

export async function renderSalarySlipByTemplate(
  payload: SalarySlipPayload,
  company: SalarySlipCompany,
  key: string,
): Promise<JsPdfWithAutoTable> {
  const doc = new jsPDF({ unit: "mm", format: "a4" }) as JsPdfWithAutoTable;
  const template = payload.template ?? "bem_sales";

  if (template === "gps_technical") {
    await renderGpsTechnicalSlip(doc, payload, company);
  } else if (template === "bem_csr_full") {
    await renderBemCsrFullSlip(doc, payload, company);
  } else {
    await renderBemSalesSlip(doc, payload, company);
  }

  return doc;
}
