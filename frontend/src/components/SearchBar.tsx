"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search products, SKUs, brands...",
}: SearchBarProps) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from parent when it changes externally
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleChange = (next: string) => {
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onChange(next);
    }, 300);
  };

  const clear = () => {
    setLocal("");
    onChange("");
  };

  return (
    <div className="relative w-full">
      {/* Magnifying glass */}
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sols-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      <input
        type="text"
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-10 w-full rounded-lg border border-sols-border bg-white pl-10 pr-9",
          "text-sm text-sols-dark placeholder:text-sols-muted/60",
          "transition-colors focus:border-sols-accent focus:outline-none focus:ring-1 focus:ring-sols-accent/30",
        )}
      />

      {/* Clear button */}
      {local.length > 0 && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-sols-muted transition-colors hover:text-sols-dark"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
