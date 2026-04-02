"use client";

import { cn, getColorHex, isGradient } from "@/lib/utils";

interface ColorSwatchProps {
  colorName: string;
  hex?: string;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  showTooltip?: boolean;
  onClick?: () => void;
}

const sizeMap = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
} as const;

export function ColorSwatch({
  colorName,
  hex,
  size = "sm",
  selected = false,
  showTooltip = true,
  onClick,
}: ColorSwatchProps) {
  const color = getColorHex(colorName, hex);
  const isGrad = isGradient(color);
  const isWhiteish =
    color.toUpperCase() === "#FFFFFF" || color.toUpperCase() === "#FFFFF0";

  return (
    <button
      type="button"
      onClick={onClick}
      title={showTooltip ? colorName : undefined}
      className={cn(
        "relative shrink-0 rounded-full transition-all",
        sizeMap[size],
        isWhiteish && "border border-sols-border",
        selected &&
          "ring-2 ring-sols-accent ring-offset-1 ring-offset-white",
        onClick && "cursor-pointer hover:scale-110",
        !onClick && "cursor-default",
      )}
      style={
        isGrad
          ? { background: color }
          : { backgroundColor: color }
      }
    >
      <span className="sr-only">{colorName}</span>
    </button>
  );
}
