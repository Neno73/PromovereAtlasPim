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
