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
  return `crm-colw:${tableId}:${count}`;
}

function percentsToPixels(widths: readonly string[], containerWidth: number): number[] {
  const total = Math.max(containerWidth, 640);
  return widths.map(w => {
    const n = parseFloat(w);
    const px = Number.isFinite(n) ? Math.round((n / 100) * total) : 120;
    return Math.max(MIN_COL, px);
  });
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
  const count = defaultWidths.length;
  const defaultsKey = defaultWidths.join("|");

  useEffect(() => {
    const saved = readSaved(tableId, count);
    const box = wrapRef.current?.clientWidth ?? 1100;
    const next = saved ?? percentsToPixels(defaultWidths, box);
    widthsRef.current = next;
    setWidths(next);
  }, [tableId, count, defaultsKey]);

  const onMouseDown = (event: React.MouseEvent) => {
    if (!widthsRef.current.length) return;
    const th = (event.target as HTMLElement).closest("th");
    if (!th) return;
    const index = resizeEdgeIndex(th, event.clientX);
    if (index == null || index >= widthsRef.current.length) return;
    event.preventDefault();
    const startX = event.clientX;
    const startW = widthsRef.current[index] ?? MIN_COL;
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

  const px = widths ?? percentsToPixels(defaultWidths, 1100);
  const sum = px.reduce((total, n) => total + n, 0);

  return (
    <div ref={wrapRef} className="w-full min-w-0 overflow-x-auto">
      <table
        className={`${className ?? ""} crm-col-resize`}
        style={{ width: sum, minWidth: "100%" }}
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
