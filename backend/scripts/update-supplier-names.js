/**
 * Update supplier names from Promidata Dashboard PDF
 * Maps supplier codes to their actual company names
 */

require('dotenv').config();
const { Client } = require('pg');

const supplierNames = {
  'A81': 'ANDA Western Europe B.V.',
  'A86': 'Araco International BV',
  'A42': 'Bic Graphic Europe S.A.',
  'A109': 'Blooms out of the box',
  'A360': 'Bosscher International BV',
  'A73': 'Buttonboss',
  'A267': 'Care Concepts BV',
  'A301': 'Clipfactory',
  'A24': 'Clipper Interall',
  'A616': 'Colorissimo',
  'A407': 'Commercial Sweets',
  'A558': 'Deonet',
  'A190': 'elasto GmbH & Co. KG',
  'A141': 'Falk & Ross',
  'A434': 'FARE - Guenter Fassbender GmbH',
  'A186': 'GC Footwear GmbH',
  'A58': 'Giving Europe BV',
  'A257': 'HEPLA-Kunststofftechnik GmbH & Co. KG',
  'A389': 'HMZ FASHIONGROUP B.V.',
  'A127': 'Hypon BV',
  'A233': 'IMPLIVA B.V.',
  'A38': 'Inspirion GmbH Germany',
  'A511': 'Linotex GmbH',
  'A556': 'LoGolf',
  'A480': 'L-SHOP-TEAM GmbH',
  'A529': 'MACMA Werbeartikel oHG',
  'A605': 'MAGNA sweets GmbH (complet)',
  'A467': 'Makito Western Europe',
  'A113': 'Malfini',
  'A134': 'Marvin\'s',
  'A36': 'Midocean',
  'A420': 'New Wave - Craft',
  'A479': 'New Wave - Cutter and Buck',
  'A390': 'New Wave Sportswear BV Clique',
  'A288': 'Paul Stricker, S.A.',
  'A34': 'PF - Concept',
  'A33': 'PF - Concept World Source',
  'A525': 'POLYCLEAN International GmbH',
  'A565': 'Premium Square Europe B.V.',
  'A618': 'Premiums4Cars',
  'A130': 'PREMO bv',
  'A572': 'Prodir BV',
  'A168': 'PromoPlants',
  'A261': 'Promotion4u',
  'A82': 'REFLECTS GmbH',
  'A510': 'Samdam',
  'A30': 'Senator GmbH',
  'A521': 'Texam',
  'A461': 'Texet Promo',
  'A185': 'The Outdoors Company',
  'A37': 'THE PEPPERMINT COMPANY',
  'A403': 'Top Tex Group',
  'A53': 'Toppoint B.V.',
  'A398': 'Tricorp BV',
  'A227': 'Troika Germany GmbH',
  'A173': 'Tubes Gifts',
  'A251': 'Vespo - Santino',
  'A371': 'Wisa',
  'A23': 'XD Connects (Xindao)'
};

async function updateSupplierNames() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    let updated = 0;
    let notFound = 0;

    for (const [code, name] of Object.entries(supplierNames)) {
      const result = await client.query(
        'UPDATE suppliers SET name = $1 WHERE code = $2 RETURNING code, name',
        [name, code]
      );

      if (result.rowCount > 0) {
        console.log(`✅ ${code}: ${name}`);
        updated++;
      } else {
        console.log(`❌ ${code}: Not found in database`);
        notFound++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Not found: ${notFound}`);
    console.log(`   Total: ${Object.keys(supplierNames).length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateSupplierNames();
