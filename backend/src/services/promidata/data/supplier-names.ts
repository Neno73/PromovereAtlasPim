/**
 * Promidata Supplier Names Mapping
 * Source: Promidata Dashboard (2025-11-16)
 *
 * Maps supplier A-numbers to their official company names
 */

export const SUPPLIER_NAMES: Record<string, string> = {
  A23: 'XD Connects (Xindao)',
  A24: 'Clipper Interall',
  A30: 'Senator GmbH',
  A33: 'PF - Concept World Source',
  A34: 'PF - Concept',
  A36: 'Midocean',
  A37: 'THE PEPPERMINT COMPANY',
  A38: 'Inspirion GmbH Germany',
  A42: 'Bic Graphic Europe S.A.',
  A53: 'Toppoint B.V.',
  A58: 'Giving Europe BV',
  A73: 'Buttonboss',
  A81: 'ANDA Western Europe B.V.',
  A82: 'REFLECTS GmbH',
  A86: 'Araco International BV',
  A109: 'Blooms out of the box',
  A113: 'Malfini',
  A127: 'Hypon BV',
  A130: 'PREMO bv',
  A134: "Marvin's",
  A141: 'Falk & Ross',
  A168: 'PromoPlants',
  A173: 'Tubes Gifts',
  A185: 'The Outdoors Company',
  A186: 'GC Footwear GmbH',
  A190: 'elasto GmbH & Co. KG',
  A227: 'Troika Germany GmbH',
  A233: 'IMPLIVA B.V.',
  A251: 'Vespo - Santino',
  A257: 'HEPLA-Kunststofftechnik GmbH & Co. KG',
  A261: 'Promotion4u',
  A267: 'Care Concepts BV',
  A288: 'Paul Stricker, S.A.',
  A301: 'Clipfactory',
  A360: 'Bosscher International BV',
  A371: 'Wisa',
  A389: 'HMZ FASHIONGROUP B.V.',
  A390: 'New Wave Sportswear BV Clique',
  A398: 'Tricorp BV',
  A403: 'Top Tex Group',
  A407: 'Commercial Sweets',
  A420: 'New Wave - Craft',
  A434: 'FARE - Guenter Fassbender GmbH',
  A461: 'Texet Promo',
  A467: 'Makito Western Europe',
  A479: 'New Wave - Cutter and Buck',
  A480: 'L-SHOP-TEAM GmbH',
  A510: 'Samdam',
  A511: 'Linotex GmbH',
  A521: 'Texam',
  A525: 'POLYCLEAN International GmbH',
  A529: 'MACMA Werbeartikel oHG',
  A556: 'LoGolf',
  A558: 'Deonet',
  A565: 'Premium Square Europe B.V.',
  A572: 'Prodir BV',
  A605: 'MAGNA sweets GmbH (complet)',
  A616: 'Colorissimo',
  A618: 'Premiums4Cars',
};

/**
 * Get supplier name by code
 * Falls back to placeholder if code not found
 */
export function getSupplierName(code: string): string {
  return SUPPLIER_NAMES[code] || `Supplier ${code}`;
}

/**
 * Get all supplier codes
 */
export function getAllSupplierCodes(): string[] {
  return Object.keys(SUPPLIER_NAMES).sort();
}

/**
 * Get total count of mapped suppliers
 */
export function getSupplierCount(): number {
  return Object.keys(SUPPLIER_NAMES).length;
}
