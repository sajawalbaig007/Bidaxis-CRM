"use client";

import { useMemo, useState, useCallback, type ReactNode } from "react";
import { X } from "lucide-react";

export function textColumnMatch(value: string | null | undefined, filter: string): boolean {
  const q = filter.trim().toLowerCase();
  if (!q) return true;
  return (value ?? "").toLowerCase().includes(q);
}

export function useColumnFilters<T>(
  rows: T[],
  predicates: Record<string, (row: T, filter: string) => boolean>,
) {
  const [filters, setFilters] = useState<Record<string, string>>({});

  const setFilter = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => setFilters({}), []);

  const filtered = useMemo(() => {
    return rows.filter(row =>
      Object.entries(filters).every(([key, val]) => {
        if (!val.trim()) return true;
        return predicates[key]?.(row, val) ?? true;
      }),
    );
  }, [rows, filters, predicates]);

  const hasActiveFilters = Object.values(filters).some(v => v.trim());

  return { filters, setFilter, clearFilters, filtered, hasActiveFilters };
}

export function ColumnFilterInput({
  value,
  onChange,
  placeholder = "Filter…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative mt-1">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onClick={e => e.stopPropagation()}
        className="w-full h-6 px-1.5 pr-5 text-[9px] sm:text-[10px] rounded-md border border-gray-200 dark:border-crm-border bg-white dark:bg-crm-input text-crm-text outline-none focus:border-[#B8112D] placeholder:text-gray-400"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
          aria-label="Clear filter"
        >
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export function FilterableTh({
  title,
  filter,
  onFilter,
  placeholder,
  className,
  headerExtra,
}: {
  title: string;
  filter: string;
  onFilter: (v: string) => void;
  placeholder?: string;
  className?: string;
  headerExtra?: ReactNode;
}) {
  return (
    <th className={className}>
      <span className="flex items-center gap-1">
        <span>{title}</span>
        {headerExtra}
      </span>
      <ColumnFilterInput value={filter} onChange={onFilter} placeholder={placeholder} />
    </th>
  );
}
