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

async function captureOne(el: HTMLElement, scale = 2): Promise<ReportShot> {
  const width = Math.max(el.scrollWidth, el.offsetWidth, 1);
  const height = Math.max(el.scrollHeight, el.offsetHeight, 1);
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-export-hide]").forEach(n => n.remove());
  inlineSafeColors(el, clone);
  clone.style.position = "fixed";
  clone.style.left = "-12000px";
  clone.style.top = "0";
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.zIndex = "-1";
  clone.style.pointerEvents = "none";
  clone.style.background = "#ffffff";
  document.body.appendChild(clone);
  try {
    const canvas = await withTimeout(
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
      15000,
      "section capture",
    );
    return {
      dataUrl: canvas.toDataURL("image/jpeg", 0.92),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    clone.remove();
  }
}

/** One screenshot per report card — same look as the earlier Word/PDF export. */
export async function captureReportBlocks(root: HTMLElement): Promise<ReportShot[]> {
  restoreExportButtons();
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-report-block]")).filter(
    el => !el.parentElement?.closest("[data-report-block]"),
  );
  const shots: ReportShot[] = [];
  for (const el of blocks) {
    try {
      shots.push(await captureOne(el));
    } catch {
      try {
        shots.push(await captureOne(el, 1));
      } catch (err) {
        console.warn("Report section capture skipped", err);
      }
    }
  }
  restoreExportButtons();
  return shots;
}

/** Pack cards onto A4 — a card is not split; it scales if taller than the page. */
export function shotsToPdfDoc(shots: ReportShot[]): jsPDF {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const gap = 4;
  const maxW = pageW - margin * 2;
  const pageInnerH = pageH - margin * 2;
  let y = margin;
  let used = false;

  for (const shot of shots) {
    const ratio = shot.height / Math.max(shot.width, 1);
    let w = maxW;
    let h = w * ratio;
    if (h > pageInnerH) {
      h = pageInnerH;
      w = h / ratio;
    }

    const remaining = pageH - margin - y;
    if (used && h > remaining) {
      pdf.addPage();
      y = margin;
    }

    pdf.addImage(shot.dataUrl, "JPEG", margin, y, w, h, undefined, "FAST");
    y += h + gap;
    used = true;
  }

  return pdf;
}

export function shotsToPdfBlob(shots: ReportShot[]): Blob {
  return shotsToPdfDoc(shots).output("blob");
}

export function shotsToWordHtml(shots: ReportShot[], title: string): string {
  const imgs = shots
    .map(s => `<div class="block"><img src="${s.dataUrl}" width="100%" /></div>`)
    .join("");
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Calibri, Arial, sans-serif; margin: 0; background: #fff; }
  .block { page-break-inside: avoid; break-inside: avoid; margin: 0 0 10px; }
  .block img { width: 100%; height: auto; display: block; max-height: 250mm; object-fit: contain; }
</style></head>
<body>${imgs}</body></html>`;
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
