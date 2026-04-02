"use client";

import { cn } from "@/lib/utils";

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

interface ActiveFiltersProps {
  filters: ActiveFilter[];
  onRemove: (key: string, value: string) => void;
  onClearAll: () => void;
}

export function ActiveFilters({
  filters,
  onRemove,
  onClearAll,
}: ActiveFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((f) => (
        <span
          key={`${f.key}-${f.value}`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full",
            "bg-sols-light-gray px-2.5 py-1 text-xs font-medium text-sols-dark",
          )}
        >
          <span className="text-sols-muted">{f.label}:</span>
          <span>{f.value}</span>
          <button
            type="button"
            onClick={() => onRemove(f.key, f.value)}
            className="ml-0.5 rounded-full p-0.5 text-sols-muted transition-colors hover:bg-sols-mid-gray hover:text-sols-dark"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-sols-accent transition-colors hover:text-sols-accent-hover"
      >
        Clear all
      </button>
    </div>
  );
}
