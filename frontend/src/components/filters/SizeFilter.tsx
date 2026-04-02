"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface SizeFilterProps {
  facets?: Record<string, number>;
  selected: string[];
  onChange: (values: string[]) => void;
}

export function SizeFilter({ facets, selected, onChange }: SizeFilterProps) {
  const sizes = useMemo(() => {
    if (!facets) return [];
    return Object.entries(facets).sort((a, b) => b[1] - a[1]);
  }, [facets]);

  if (sizes.length === 0) {
    return <p className="text-xs text-sols-muted">No sizes available</p>;
  }

  const toggle = (size: string) => {
    if (selected.includes(size)) {
      onChange(selected.filter((s) => s !== size));
    } else {
      onChange([...selected, size]);
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {sizes.map(([name, count]) => {
        const isSelected = selected.includes(name);
        return (
          <button
            key={name}
            type="button"
            onClick={() => toggle(name)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
              isSelected
                ? "border-sols-accent bg-sols-accent text-white"
                : "border-sols-border bg-white text-sols-dark hover:border-sols-accent/40",
            )}
          >
            {name}
            <span
              className={cn(
                "ml-1 text-[10px]",
                isSelected ? "text-white/70" : "text-sols-muted",
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
