import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export type ReportShot = { dataUrl: string; width: number; height: number };

const COLOR_PROPS = [
  "color",
  "background-color",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "fill",
  "stroke",
  "box-shadow",
] as const;

function isModernColor(v: string) {
  return /oklch|oklab|lab\(|lch\(|color\(/.test(v);
}

function inlineSafeColors(orig: Element, clone: Element) {
  const cs = getComputedStyle(orig);
  if (clone instanceof HTMLElement || clone instanceof SVGElement) {
    for (const prop of COLOR_PROPS) {
      const val = cs.getPropertyValue(prop);
      if (val && !isModernColor(val)) {
        (clone as HTMLElement).style.setProperty(prop, val);
      }
    }
    const bg = cs.backgroundColor;
    if (bg && !isModernColor(bg)) (clone as HTMLElement).style.backgroundColor = bg;
    const fg = cs.color;
    if (fg && !isModernColor(fg)) (clone as HTMLElement).style.color = fg;
  }
  const oc = orig.children;
  const cc = clone.children;
  for (let i = 0; i < oc.length && i < cc.length; i++) {
    inlineSafeColors(oc[i], cc[i]);
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    p.then(
      v => {
        window.clearTimeout(t);
        resolve(v);
      },
      e => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function restoreExportButtons() {
  document.querySelectorAll<HTMLElement>("[data-export-hide]").forEach(el => {
    el.style.display = "";
    el.style.visibility = "";
  });
}

/** A4 content box in mm (portrait, 10mm margins). */
const PAGE_W_MM = 190;
const PAGE_H_MM = 277;

function findRowBreak(canvas: HTMLCanvasElement, startY: number, idealH: number): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return idealH;
  const yMax = Math.min(startY + idealH, canvas.height - 1);
  const yMin = Math.max(startY + Math.floor(idealH * 0.72), startY + 24);
  for (let y = yMax; y >= yMin; y -= 2) {
    const row = ctx.getImageData(0, y, canvas.width, 1).data;
    let white = 0;
    let samples = 0;
    for (let i = 0; i < row.length; i += 64) {
      samples++;
      if (row[i] > 248 && row[i + 1] > 248 && row[i + 2] > 248) white++;
    }
    if (samples > 0 && white / samples > 0.9) return y - startY;
  }
  return Math.min(idealH, canvas.height - startY);
}

function sliceCanvasToPages(canvas: HTMLCanvasElement): ReportShot[] {
  const pagePx = Math.max(1, Math.round(canvas.width * (PAGE_H_MM / PAGE_W_MM)));
  const shots: ReportShot[] = [];
  let y = 0;
  while (y < canvas.height) {
    const left = canvas.height - y;
    let sliceH = Math.min(pagePx, left);
    if (left > pagePx + 8) sliceH = findRowBreak(canvas, y, sliceH);
    sliceH = Math.max(24, Math.min(sliceH, left));
    const piece = document.createElement("canvas");
    piece.width = canvas.width;
    piece.height = sliceH;
    const ctx = piece.getContext("2d");
    if (!ctx) break;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, piece.width, piece.height);
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    shots.push({
      dataUrl: piece.toDataURL("image/jpeg", 0.92),
      width: piece.width,
      height: piece.height,
    });
    y += sliceH;
  }
  return shots.length ? shots : [{ dataUrl: canvas.toDataURL("image/jpeg", 0.92), width: canvas.width, height: canvas.height }];
}

async function canvasFromElement(el: HTMLElement, scale: number, timeoutMs: number): Promise<HTMLCanvasElement> {
  const width = Math.max(el.scrollWidth, el.offsetWidth, 1);
  const height = Math.max(el.scrollHeight, el.offsetHeight, 1);
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-export-hide]").forEach(n => n.remove());
  inlineSafeColors(el, clone);
  clone.style.position = "fixed";
  clone.style.left = "-14000px";
  clone.style.top = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.maxHeight = "none";
  clone.style.overflow = "visible";
  clone.style.zIndex = "-1";
  clone.style.pointerEvents = "none";
  clone.style.background = "#ffffff";
  document.body.appendChild(clone);
  try {
    return await withTimeout(
      html2canvas(clone, {
        backgroundColor: "#ffffff",
        scale,
        logging: false,
        useCORS: true,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        onclone: clonedDoc => {
          clonedDoc.querySelectorAll("[data-export-hide]").forEach(n => n.remove());
        },
      }),
      timeoutMs,
      "report capture",
    );
  } finally {
    clone.remove();
  }
}

/**
 * Full-page clone of the report (buttons stripped), then sliced into A4 pages
 * at card gaps so nothing is dropped.
 */
export async function captureReportBlocks(root: HTMLElement): Promise<ReportShot[]> {
  restoreExportButtons();
  const height = Math.max(root.scrollHeight, root.offsetHeight, 1);
  const scale = height > 9000 ? 1.25 : height > 6000 ? 1.5 : 2;
  try {
    const canvas = await canvasFromElement(root, scale, 90000);
    restoreExportButtons();
    return sliceCanvasToPages(canvas);
  } catch (err) {
    console.warn("Full report capture failed, falling back to sections", err);
  }

  const blocks = Array.from(root.children).filter((n): n is HTMLElement => n instanceof HTMLElement);
  const shots: ReportShot[] = [];
  for (const el of blocks) {
    try {
      const canvas = await canvasFromElement(el, Math.min(scale, 1.5), 20000);
      shots.push(...sliceCanvasToPages(canvas));
    } catch (err) {
      console.warn("Section capture failed", err);
    }
  }
  restoreExportButtons();
  return shots;
}

export function shotsToPdfDoc(shots: ReportShot[]): jsPDF {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const maxW = pageW - margin * 2;
  const pageInnerH = pageH - margin * 2;

  shots.forEach((shot, i) => {
    if (i > 0) pdf.addPage();
    const ratio = shot.height / Math.max(shot.width, 1);
    const w = maxW;
    const h = Math.min(pageInnerH, w * ratio);
    pdf.addImage(shot.dataUrl, "JPEG", margin, margin, w, h, undefined, "FAST");
  });

  return pdf;
}

export function shotsToPdfBlob(shots: ReportShot[]): Blob {
  return shotsToPdfDoc(shots).output("blob");
}

export function shotsToWordHtml(shots: ReportShot[], title: string, extraHtml = ""): string {
  const pages = shots
    .map(
      (s, i) =>
        `<div class="page"${i === shots.length - 1 ? ' style="page-break-after:auto;"' : ""}><img src="${s.dataUrl}" /></div>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: Calibri, Arial, sans-serif; margin: 0; background: #fff; }
  .page { page-break-after: always; break-after: page; }
  .page img { width: 100%; height: auto; display: block; }
</style></head>
<body>${pages}${extraHtml}</body></html>`;
}

export function triggerLocalDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
