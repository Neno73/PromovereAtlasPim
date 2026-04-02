"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface PriceRangeFilterProps {
  min?: number;
  max?: number;
  onChange: (min?: number, max?: number) => void;
}

function PriceRangeInputs({
  initialMin,
  initialMax,
  onChange,
}: {
  initialMin: string;
  initialMax: string;
  onChange: (min?: number, max?: number) => void;
}) {
  const [localMin, setLocalMin] = useState(initialMin);
  const [localMax, setLocalMax] = useState(initialMax);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commit = (nextMin: string, nextMax: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const parsedMin = nextMin ? parseFloat(nextMin) : undefined;
      const parsedMax = nextMax ? parseFloat(nextMax) : undefined;
      onChange(
        parsedMin != null && !isNaN(parsedMin) ? parsedMin : undefined,
        parsedMax != null && !isNaN(parsedMax) ? parsedMax : undefined,
      );
    }, 500);
  };

  const inputCls = cn(
    "h-9 w-full rounded border border-sols-border bg-white px-2.5",
    "text-xs text-sols-dark placeholder:text-sols-muted/60",
    "focus:border-sols-accent focus:outline-none",
  );

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          type="number"
          min={0}
          step="0.01"
          value={localMin}
          placeholder="Min"
          onChange={(e) => {
            setLocalMin(e.target.value);
            commit(e.target.value, localMax);
          }}
          className={inputCls}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sols-muted">
          EUR
        </span>
      </div>

      <span className="text-xs text-sols-muted">&ndash;</span>

      <div className="relative flex-1">
        <input
          type="number"
          min={0}
          step="0.01"
          value={localMax}
          placeholder="Max"
          onChange={(e) => {
            setLocalMax(e.target.value);
            commit(localMin, e.target.value);
          }}
          className={inputCls}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-sols-muted">
          EUR
        </span>
      </div>
    </div>
  );
}

export function PriceRangeFilter({
  min,
  max,
  onChange,
}: PriceRangeFilterProps) {
  // Use a key to reset the inner component when parent values change externally
  const resetKey = `${min ?? ""}-${max ?? ""}`;

  return (
    <PriceRangeInputs
      key={resetKey}
      initialMin={min != null ? String(min) : ""}
      initialMax={max != null ? String(max) : ""}
      onChange={onChange}
    />
  );
}
