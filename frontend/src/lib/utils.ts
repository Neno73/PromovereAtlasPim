// ---------------------------------------------------------------------------
// PromoAtlas PIM -- utility helpers
// ---------------------------------------------------------------------------

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MultilingualText } from "./types";

/** Merge Tailwind classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Multilingual
// ---------------------------------------------------------------------------

/** Extract best available locale string with fallback chain */
export function getLocalizedText(
  text: MultilingualText | string | null | undefined,
  lang: string = "en",
): string {
  if (!text) return "";
  if (typeof text === "string") return text;

  return (
    text[lang] ||
    text.en ||
    text.de ||
    text.fr ||
    text.es ||
    Object.values(text).find((v) => typeof v === "string" && v.length > 0) ||
    ""
  );
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

const EUR_FMT = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPrice(
  price: number | undefined | null,
  currency: string = "EUR",
): string {
  if (price == null) return "";
  if (currency === "EUR") return EUR_FMT.format(price);
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(price);
}

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

const COLOR_MAP: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  red: "#DC2626",
  blue: "#2563EB",
  green: "#16A34A",
  yellow: "#FACC15",
  orange: "#F97316",
  purple: "#9333EA",
  pink: "#EC4899",
  grey: "#6B7280",
  gray: "#6B7280",
  brown: "#92400E",
  navy: "#1E3A5F",
  beige: "#D2B48C",
  gold: "#D4AF37",
  silver: "#C0C0C0",
  multicolor: "conic-gradient(red, orange, yellow, green, blue, purple, red)",
  transparent: "transparent",
  natural: "#F5F0E6",
  turquoise: "#40E0D0",
  magenta: "#FF00FF",
  lime: "#84CC16",
  khaki: "#C3B091",
  ivory: "#FFFFF0",
  coral: "#FF7F50",
  cyan: "#06B6D4",
  teal: "#0D9488",
  maroon: "#800000",
  olive: "#808000",
  sand: "#C2B280",
  bordeaux: "#4A0020",
  royal: "#4169E1",
  anthracite: "#383838",
  cream: "#FFFDD0",
  mint: "#98FF98",
  violet: "#8B5CF6",
  rose: "#FB7185",
  petrol: "#006E6D",
  champagne: "#F7E7CE",
  cobalt: "#0047AB",
  fuchsia: "#D946EF",
};

const HEX_RE = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/** Map a color name to a hex value. Prefer existingHex if it looks valid. */
export function getColorHex(
  colorName: string,
  existingHex?: string,
): string {
  if (existingHex && HEX_RE.test(existingHex)) return existingHex;

  const key = colorName.toLowerCase().trim();
  if (COLOR_MAP[key]) return COLOR_MAP[key];

  // Try partial match (e.g. "light blue" -> blue)
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (key.includes(name)) return hex;
  }

  // Fallback
  return "#9CA3AF";
}

/** Check if a color value is a gradient (like multicolor) */
export function isGradient(hex: string): boolean {
  return hex.includes("gradient");
}
