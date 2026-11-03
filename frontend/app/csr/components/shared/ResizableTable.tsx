"use client";

import { useEffect, useRef, useState } from "react";

const MIN_COL = 72;
const EDGE = 12;

function resizeEdgeIndex(th: HTMLTableCellElement, clientX: number): number | null {
  const rect = th.getBoundingClientRect();
  const cells = Array.from(th.parentElement?.children ?? []);
  const index = cells.indexOf(th);
  if (index < 0) return null;
  if (rect.right - clientX <= EDGE) return index;
  if (clientX - rect.left <= EDGE && index > 0) return index - 1;
  return null;
}

function storageKey(tableId: string, count: number) {
  return `crm-colw2:${tableId}:${count}`;
}

function percentsToPixels(widths: readonly string[], containerWidth: number): number[] {
  const total = Math.max(containerWidth, 320);
  return widths.map(w => {
    const n = parseFloat(w);
    const px = Number.isFinite(n) ? Math.round((n / 100) * total) : 120;
    return Math.max(MIN_COL, px);
  });
}

/** Fill the screen when columns are narrow: the last column takes the spare room. Wider tables scroll. */
function fillColumns(cols: number[], box: number): number[] {
  if (!cols.length || box <= 0) return cols;
  const sum = cols.reduce((total, n) => total + n, 0);
  if (sum >= box) return cols;
  const next = cols.slice();
  next[next.length - 1] += box - sum;
  return next;
}

function readSaved(tableId: string, count: number): number[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(tableId, count));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== count) return null;
    const nums = parsed.map(n => Number(n));
    if (nums.some(n => !Number.isFinite(n) || n < MIN_COL)) return null;
    return nums;
  } catch {
    return null;
  }
}

/** Excel-style column drag. Widths are saved in this browser. */
export default function ResizableTable({
  tableId,
  defaultWidths,
  className,
  children,
}: {
  tableId: string;
  defaultWidths: readonly string[];
  className?: string;
  children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const widthsRef = useRef<number[]>([]);
  const [widths, setWidths] = useState<number[] | null>(null);
  const [box, setBox] = useState(0);
  const count = defaultWidths.length;
  const defaultsKey = defaultWidths.join("|");

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setBox(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const saved = readSaved(tableId, count);
    const width = box || wrapRef.current?.clientWidth || 1100;
    const next = saved ?? percentsToPixels(defaultWidths, width);
    widthsRef.current = next;
    setWidths(next);
  }, [tableId, count, defaultsKey, box]);

  const onMouseDown = (event: React.MouseEvent) => {
    if (!widthsRef.current.length) return;
    const th = (event.target as HTMLElement).closest("th");
    if (!th) return;
    const index = resizeEdgeIndex(th, event.clientX);
    if (index == null || index >= widthsRef.current.length) return;
    event.preventDefault();
    const startX = event.clientX;
    /* Start from the width on screen (the last column may be stretched to fill). */
    const startW = th.getBoundingClientRect().width || widthsRef.current[index] || MIN_COL;
    /* Like Excel: only the dragged column changes; columns after it shift right/left. */
    const move = (ev: MouseEvent) => {
      const next = widthsRef.current.slice();
      next[index] = Math.max(MIN_COL, Math.round(startW + ev.clientX - startX));
      widthsRef.current = next;
      setWidths(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      try {
        localStorage.setItem(storageKey(tableId, count), JSON.stringify(widthsRef.current));
      } catch {
        /* ignore quota */
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onMouseMove = (event: React.MouseEvent) => {
    const th = (event.target as HTMLElement).closest("th");
    const table = event.currentTarget as HTMLTableElement;
    if (!th || resizeEdgeIndex(th, event.clientX) == null) {
      table.style.cursor = "";
      return;
    }
    table.style.cursor = "col-resize";
  };

  const px = fillColumns(widths ?? percentsToPixels(defaultWidths, box || 1100), box);
  const sum = px.reduce((total, n) => total + n, 0);

  return (
    <div ref={wrapRef} className="w-full min-w-0 overflow-x-auto crm-col-scroll">
      <table
        className={`${className ?? ""} crm-col-resize`}
        style={{ width: sum, minWidth: sum, tableLayout: "fixed" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
      >
        <colgroup>
          {px.map((w, i) => (
            <col key={i} style={{ width: w }} />
          ))}
        </colgroup>
        {children}
      </table>
    </div>
  );
}

export function useIsLargeScreen(minWidth = 1024) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${minWidth}px)`);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [minWidth]);
  return matches;
}

export function useResizableColumns(tableId: string, defaults: number[]) {
  const [widths, setWidths] = useState<number[]>(defaults);
  const widthsRef = useRef(defaults);
  const count = defaults.length;
  const defaultsKey = defaults.join(",");

  useEffect(() => {
    const saved = readSaved(tableId, count);
    const next = saved ?? defaultsKey.split(",").map(Number);
    widthsRef.current = next;
    setWidths(next);
  }, [tableId, count, defaultsKey]);

  const startResize = (index: number, clientX: number) => {
    const startW = widthsRef.current[index] ?? MIN_COL;
    const move = (ev: MouseEvent) => {
      const next = widthsRef.current.slice();
      next[index] = Math.max(MIN_COL, Math.round(startW + ev.clientX - clientX));
      widthsRef.current = next;
      setWidths(next);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      try {
        localStorage.setItem(storageKey(tableId, count), JSON.stringify(widthsRef.current));
      } catch {
        /* ignore quota */
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return {
    template: widths.map(w => `${w}px`).join(" "),
    startResize,
  };
}
