import { toJpeg } from "html-to-image";
import { jsPDF } from "jspdf";

export type ReportShot = { dataUrl: string; width: number; height: number };

function hideExportControls(root: HTMLElement): () => void {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-export-hide]"));
  const prev = nodes.map(el => el.style.display);
  nodes.forEach(el => {
    el.style.display = "none";
  });
  return () => {
    nodes.forEach((el, i) => {
      el.style.display = prev[i] ?? "";
    });
  };
}

/** Capture each [data-report-block] as a JPEG — same layout and charts as on screen. */
export async function captureReportBlocks(root: HTMLElement): Promise<ReportShot[]> {
  const restore = hideExportControls(root);
  await new Promise(r => setTimeout(r, 250));
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("[data-report-block]")).filter(
    el => !el.parentElement?.closest("[data-report-block]"),
  );
  const shots: ReportShot[] = [];
  try {
    for (const el of blocks) {
      const width = Math.max(el.scrollWidth, el.offsetWidth, 1);
      const height = Math.max(el.scrollHeight, el.offsetHeight, 1);
      const dataUrl = await toJpeg(el, {
        quality: 0.92,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
        skipFonts: true,
        width,
        height,
      });
      shots.push({ dataUrl, width: width * 2, height: height * 2 });
    }
  } finally {
    restore();
  }
  return shots;
}

/** Place each block on a page without splitting — scale down if it would overflow. */
export function shotsToPdfBlob(shots: ReportShot[]): Blob {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const gap = 3;
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
    const minKeep = pageInnerH * 0.22;
    if (used && h > remaining) {
      if (remaining >= minKeep) {
        h = remaining;
        w = Math.min(maxW, h / ratio);
      } else {
        pdf.addPage();
        y = margin;
      }
    }

    pdf.addImage(shot.dataUrl, "JPEG", margin, y, w, h, undefined, "FAST");
    y += h + gap;
    used = true;
  }

  return pdf.output("blob");
}

export function shotsToWordHtml(shots: ReportShot[], title: string): string {
  const imgs = shots
    .map(
      s =>
        `<div class="block"><img src="${s.dataUrl}" width="100%" /></div>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>${title}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: Calibri, Arial, sans-serif; margin: 0; background: #fff; }
  .block { page-break-inside: avoid; break-inside: avoid; margin: 0 0 8px; }
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
