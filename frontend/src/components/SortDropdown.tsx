"use client";

import { cn } from "@/lib/utils";

export const SORT_OPTIONS = [
  { label: "Newest", value: "updatedAt:desc" },
  { label: "Price: Low to High", value: "price_min:asc" },
  { label: "Price: High to Low", value: "price_min:desc" },
  { label: "Name A-Z", value: "name_en:asc" },
  { label: "Most Variants", value: "total_variants_count:desc" },
] as const;

interface SortDropdownProps {
  value: string;
  onChange: (value: string) => void;
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-10 appearance-none rounded-lg border border-sols-border bg-white",
          "pl-3 pr-8 text-sm font-medium text-sols-dark",
          "transition-colors focus:border-sols-accent focus:outline-none focus:ring-1 focus:ring-sols-accent/30",
          "cursor-pointer",
        )}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Chevron */}
      <svg
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sols-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
