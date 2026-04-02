"use client";

import { useMemo } from "react";
import { ColorSwatch } from "../ColorSwatch";

interface ColorFilterProps {
  facets?: Record<string, number>;
  selected: string[];
  onChange: (values: string[]) => void;
}

export function ColorFilter({ facets, selected, onChange }: ColorFilterProps) {
  const colors = useMemo(() => {
    if (!facets) return [];
    return Object.entries(facets).sort((a, b) => b[1] - a[1]);
  }, [facets]);

  if (colors.length === 0) {
    return <p className="text-xs text-sols-muted">No colors available</p>;
  }

  const toggle = (color: string) => {
    if (selected.includes(color)) {
      onChange(selected.filter((c) => c !== color));
    } else {
      onChange([...selected, color]);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(([name, count]) => (
        <div key={name} className="flex flex-col items-center gap-0.5">
          <ColorSwatch
            colorName={name}
            size="md"
            selected={selected.includes(name)}
            onClick={() => toggle(name)}
            showTooltip
          />
          <span className="text-[9px] leading-tight text-sols-muted">
            {count}
          </span>
        </div>
      ))}
    </div>
  );
}
