import { MultilingualText } from '../types';

// Default language preference
export const DEFAULT_LANGUAGE = 'en';
export const FALLBACK_LANGUAGES = ['en', 'de', 'fr', 'es'];

/**
 * Extract text from multilingual JSON field
 */
export function getLocalizedText(
  multilingualText: MultilingualText | string | undefined,
  preferredLanguage: string = DEFAULT_LANGUAGE
): string {
  if (!multilingualText) return '';
  
  if (typeof multilingualText === 'string') {
    return multilingualText;
  }

  // Try preferred language first
  if (multilingualText[preferredLanguage]) {
    return multilingualText[preferredLanguage] as string;
  }

  // Try fallback languages
  for (const lang of FALLBACK_LANGUAGES) {
    if (multilingualText[lang]) {
      return multilingualText[lang] as string;
    }
  }

  // Return first available value
  const firstValue = Object.values(multilingualText).find(value => value && value.trim());
  return firstValue || '';
}

/**
 * Get all available languages from multilingual text
 */
export function getAvailableLanguages(multilingualText: MultilingualText): string[] {
  if (!multilingualText) return [];
  return Object.keys(multilingualText).filter(key => multilingualText[key]);
}

/**
 * Format price with currency
 */
export function formatPrice(price: number, currency: string = 'EUR'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(price);
  } catch (error) {
    return `${price} ${currency}`;
  }
}

/**
 * Format dimensions
 */
export function formatDimensions(dimensions: any): string | null {
  if (!dimensions) return null;
  
  const { length, width, height, diameter, unit = 'cm' } = dimensions;
  
  if (diameter) {
    return `⌀ ${diameter} ${unit}`;
  }
  
  const parts = [length, width, height].filter(val => val !== null && val !== undefined);
  if (parts.length === 0) return null;
  
  return `${parts.join(' × ')} ${unit}`;
}

/**
 * Format weight
 */
export function formatWeight(weight: number, unit: string = 'g'): string {
  return `${weight} ${unit}`;
}

/**
 * Common color name to hex mapping for product display
 * Supports multiple languages and variations
 */
const COLOR_NAME_TO_HEX: Record<string, string> = {
  // Basic colors - English
  'black': '#000000',
  'white': '#FFFFFF',
  'red': '#FF0000',
  'blue': '#0066CC',
  'green': '#008000',
  'yellow': '#FFD700',
  'orange': '#FF8C00',
  'purple': '#800080',
  'pink': '#FFC0CB',
  'brown': '#8B4513',
  'grey': '#808080',
  'gray': '#808080',
  'navy': '#000080',
  'beige': '#F5F5DC',
  'gold': '#FFD700',
  'silver': '#C0C0C0',
  'maroon': '#800000',
  'olive': '#808000',
  'teal': '#008080',
  'cyan': '#00FFFF',
  'magenta': '#FF00FF',
  'coral': '#FF7F50',
  'turquoise': '#40E0D0',
  'khaki': '#C3B091',
  'ivory': '#FFFFF0',
  'cream': '#FFFDD0',
  'tan': '#D2B48C',
  'burgundy': '#800020',
  'charcoal': '#36454F',
  'mint': '#98FF98',
  'lavender': '#E6E6FA',
  'peach': '#FFCBA4',
  'salmon': '#FA8072',
  'indigo': '#4B0082',
  'violet': '#EE82EE',
  'aqua': '#00FFFF',
  'lime': '#00FF00',
  // German colors
  'schwarz': '#000000',
  'weiss': '#FFFFFF',
  'weiß': '#FFFFFF',
  'rot': '#FF0000',
  'blau': '#0066CC',
  'grün': '#008000',
  'gruen': '#008000',
  'gelb': '#FFD700',
  'braun': '#8B4513',
  'grau': '#808080',
  'rosa': '#FFC0CB',
  'lila': '#800080',
  // French colors
  'noir': '#000000',
  'blanc': '#FFFFFF',
  'rouge': '#FF0000',
  'bleu': '#0066CC',
  'vert': '#008000',
  'jaune': '#FFD700',
  'brun': '#8B4513',
  'gris': '#808080',
  'rose': '#FFC0CB',
  // Dutch colors
  'zwart': '#000000',
  'wit': '#FFFFFF',
  'rood': '#FF0000',
  'blauw': '#0066CC',
  'groen': '#008000',
  'geel': '#FFD700',
  // Light/Dark variations
  'light blue': '#ADD8E6',
  'dark blue': '#00008B',
  'light green': '#90EE90',
  'dark green': '#006400',
  'light grey': '#D3D3D3',
  'dark grey': '#A9A9A9',
  'light gray': '#D3D3D3',
  'dark gray': '#A9A9A9',
  'light pink': '#FFB6C1',
  'dark red': '#8B0000',
  // Special product colors
  'natural': '#F5F5DC',
  'natur': '#F5F5DC',
  'transparent': 'transparent',
  'multicolor': 'linear-gradient(135deg, red, orange, yellow, green, blue, purple)',
  'multi': 'linear-gradient(135deg, red, orange, yellow, green, blue, purple)',
};

/**
 * Valid CSS color names (allowlist for security)
 * Only these color names are allowed as CSS values to prevent injection attacks
 */
const VALID_CSS_COLORS = new Set([
  // Extended CSS color names not in our mapping
  'aliceblue', 'antiquewhite', 'aquamarine', 'azure', 'bisque', 'blanchedalmond',
  'blueviolet', 'burlywood', 'cadetblue', 'chartreuse', 'chocolate', 'cornflowerblue',
  'cornsilk', 'crimson', 'darkblue', 'darkcyan', 'darkgoldenrod', 'darkgray', 'darkgrey',
  'darkgreen', 'darkkhaki', 'darkmagenta', 'darkolivegreen', 'darkorange', 'darkorchid',
  'darkred', 'darksalmon', 'darkseagreen', 'darkslateblue', 'darkslategray', 'darkslategrey',
  'darkturquoise', 'darkviolet', 'deeppink', 'deepskyblue', 'dimgray', 'dimgrey',
  'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen', 'fuchsia', 'gainsboro',
  'ghostwhite', 'goldenrod', 'greenyellow', 'honeydew', 'hotpink', 'indianred',
  'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan', 'lightgoldenrodyellow',
  'lightgray', 'lightgrey', 'lightgreen', 'lightpink', 'lightsalmon', 'lightseagreen',
  'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue', 'lightyellow',
  'limegreen', 'linen', 'mediumaquamarine', 'mediumblue', 'mediumorchid', 'mediumpurple',
  'mediumseagreen', 'mediumslateblue', 'mediumspringgreen', 'mediumturquoise', 'mediumvioletred',
  'midnightblue', 'mintcream', 'mistyrose', 'moccasin', 'navajowhite', 'oldlace',
  'olivedrab', 'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise',
  'palevioletred', 'papayawhip', 'peachpuff', 'peru', 'plum', 'powderblue',
  'rosybrown', 'royalblue', 'saddlebrown', 'sandybrown', 'seagreen', 'seashell',
  'sienna', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow', 'springgreen',
  'steelblue', 'thistle', 'tomato', 'wheat', 'whitesmoke', 'yellowgreen',
  // Basic colors (also in our mapping but included for completeness)
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink',
  'brown', 'grey', 'gray', 'navy', 'beige', 'gold', 'silver', 'maroon', 'olive',
  'teal', 'cyan', 'magenta', 'coral', 'turquoise', 'khaki', 'ivory', 'cream',
  'tan', 'burgundy', 'charcoal', 'mint', 'lavender', 'peach', 'salmon', 'indigo',
  'violet', 'aqua', 'lime',
]);

/**
 * Get hex color from color name
 * Returns the hex code, CSS color name, or fallback color
 * SECURITY: All outputs are validated to prevent CSS injection attacks
 */
export function getColorHex(colorName: string | undefined | null, hexColor?: string | null): string {
  // First priority: provided hex color (validate format)
  if (hexColor && /^#[0-9A-Fa-f]{3,8}$/.test(hexColor)) {
    return hexColor;
  }

  if (!colorName) {
    return '#CCCCCC'; // Default grey for unknown
  }

  // Normalize color name: lowercase, trim, remove any non-alphanumeric characters except spaces
  const normalized = colorName.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');

  // Check our mapping first (safe - all values are hex codes)
  if (COLOR_NAME_TO_HEX[normalized]) {
    return COLOR_NAME_TO_HEX[normalized];
  }

  // Check for partial matches (e.g., "Navy Blue" matches "navy")
  for (const [key, hex] of Object.entries(COLOR_NAME_TO_HEX)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return hex;
    }
  }

  // SECURITY: Only allow validated CSS color names to prevent injection
  if (VALID_CSS_COLORS.has(normalized)) {
    return normalized;
  }

  // Safe fallback for unknown colors
  return '#CCCCCC';
}
