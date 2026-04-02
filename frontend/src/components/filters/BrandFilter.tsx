"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

interface BrandFilterProps {
  facets?: Record<string, number>;
  selected: string;
  onChange: (value: string) => void;
}

const INITIAL_SHOW = 10;

export function BrandFilter({ facets, selected, onChange }: BrandFilterProps) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const sorted = useMemo(() => {
    if (!facets) return [];
    return Object.entries(facets)
      .sort((a, b) => b[1] - a[1]) // sort by count desc
      .filter(
        ([name]) =>
          !search || name.toLowerCase().includes(search.toLowerCase()),
      );
  }, [facets, search]);

  const visible = expanded ? sorted : sorted.slice(0, INITIAL_SHOW);
  const hasMore = sorted.length > INITIAL_SHOW;

  if (sorted.length === 0 && !search) {
    return <p className="text-xs text-sols-muted">No brands available</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Search within brands */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search brands..."
        className={cn(
          "h-8 w-full rounded border border-sols-border bg-white px-2.5",
          "text-xs text-sols-dark placeholder:text-sols-muted/60",
          "focus:border-sols-accent focus:outline-none",
        )}
      />

      <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
        {visible.map(([name, count]) => {
          const isSelected = selected === name;
          return (
            <label
              key={name}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors",
                isSelected
                  ? "bg-sols-light-gray"
                  : "hover:bg-sols-light-gray/60",
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onChange(isSelected ? "" : name)}
                className="h-3.5 w-3.5 rounded border-sols-border text-sols-accent accent-sols-accent focus:ring-sols-accent/30"
              />
              <span
                className={cn(
                  "flex-1 truncate",
                  isSelected && "font-semibold text-sols-accent",
                )}
              >
                {name}
              </span>
              <span className="text-sols-muted">({count})</span>
            </label>
          );
        })}
      </div>

      {hasMore && !search && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="self-start text-xs font-medium text-sols-accent hover:text-sols-accent-hover"
        >
          {expanded ? "Show less" : `Show all (${sorted.length})`}
        </button>
      )}

      {search && sorted.length === 0 && (
        <p className="text-xs text-sols-muted">
          No brands match &quot;{search}&quot;
        </p>
      )}
    </div>
  );
}
