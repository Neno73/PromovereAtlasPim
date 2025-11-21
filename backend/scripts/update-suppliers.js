// Update suppliers with correct names from Promidata Dashboard
const suppliers = [
  { code: 'A81', name: 'ANDA Western Europe B.V.' },
  { code: 'A86', name: 'Araco International BV' },
  { code: 'A42', name: 'Bic Graphic Europe S.A.' },
  { code: 'A109', name: 'Blooms out of the box' },
  { code: 'A360', name: 'Bosscher International BV' },
  { code: 'A73', name: 'Buttonboss' },
  { code: 'A267', name: 'Care Concepts BV' },
  { code: 'A301', name: 'Clipfactory' },
  { code: 'A24', name: 'Clipper Interall' },
  { code: 'A616', name: 'Colorissimo' },
  { code: 'A407', name: 'Commercial Sweets' },
  { code: 'A558', name: 'Deonet' },
  { code: 'A190', name: 'elasto GmbH & Co. KG' },
  { code: 'A141', name: 'Falk & Ross' },
  { code: 'A434', name: 'FARE - Guenter Fassbender GmbH' },
  { code: 'A186', name: 'GC Footwear GmbH' },
  { code: 'A58', name: 'Giving Europe BV' },
  { code: 'A257', name: 'HEPLA-Kunststofftechnik GmbH & Co. KG' },
  { code: 'A389', name: 'HMZ FASHIONGROUP B.V.' },
  { code: 'A127', name: 'Hypon BV' },
  { code: 'A233', name: 'IMPLIVA B.V.' },
  { code: 'A38', name: 'Inspirion GmbH Germany' },
  { code: 'A511', name: 'Linotex GmbH' },
  { code: 'A556', name: 'LoGolf' },
  { code: 'A480', name: 'L-SHOP-TEAM GmbH' },
  { code: 'A529', name: 'MACMA Werbeartikel oHG' },
  { code: 'A605', name: 'MAGNA sweets GmbH (complet)' },
  { code: 'A467', name: 'Makito Western Europe' },
  { code: 'A113', name: 'Malfini' },
  { code: 'A134', name: "Marvin's" },
  { code: 'A36', name: 'Midocean' },
  { code: 'A420', name: 'New Wave - Craft' },
  { code: 'A479', name: 'New Wave - Cutter and Buck' },
  { code: 'A390', name: 'New Wave Sportswear BV Clique' },
  { code: 'A288', name: 'Paul Stricker, S.A.' },
  { code: 'A34', name: 'PF - Concept' },
  { code: 'A33', name: 'PF - Concept World Source' },
  { code: 'A525', name: 'POLYCLEAN International GmbH' },
  { code: 'A565', name: 'Premium Square Europe B.V.' },
  { code: 'A618', name: 'Premiums4Cars' },
  { code: 'A130', name: 'PREMO bv' },
  { code: 'A572', name: 'Prodir BV' },
  { code: 'A168', name: 'PromoPlants' },
  { code: 'A261', name: 'Promotion4u' },
  { code: 'A82', name: 'REFLECTS GmbH' },
  { code: 'A510', name: 'Samdam' },
  { code: 'A30', name: 'Senator GmbH' },
  { code: 'A521', name: 'Texam' },
  { code: 'A461', name: 'Texet Promo' },
  { code: 'A185', name: 'The Outdoors Company' },
  { code: 'A37', name: 'THE PEPPERMINT COMPANY' },
  { code: 'A403', name: 'Top Tex Group' },
  { code: 'A53', name: 'Toppoint B.V.' },
  { code: 'A398', name: 'Tricorp BV' },
  { code: 'A227', name: 'Troika Germany GmbH' },
  { code: 'A173', name: 'Tubes Gifts' },
  { code: 'A251', name: 'Vespo - Santino' },
  { code: 'A371', name: 'Wisa' },
  { code: 'A23', name: 'XD Connects (Xindao)' }
];

async function updateSuppliers() {
  const { Client } = require('pg');

  const client = new Client({
    host: 'localhost',
    port: 5435,
    user: 'postgres',
    password: 'promoatlas123',
    database: 'promoatlas_pim'
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    let updated = 0;
    let created = 0;

    for (const supplier of suppliers) {
      // Check if supplier exists
      const checkResult = await client.query(
        'SELECT id, name FROM suppliers WHERE code = $1',
        [supplier.code]
      );

      if (checkResult.rows.length > 0) {
        // Update existing supplier
        await client.query(
          'UPDATE suppliers SET name = $1, is_active = true WHERE code = $2',
          [supplier.name, supplier.code]
        );
        console.log(`✅ Updated ${supplier.code}: ${supplier.name}`);
        updated++;
      } else {
        // Create new supplier
        await client.query(
          'INSERT INTO suppliers (code, name, is_active, created_at, updated_at) VALUES ($1, $2, true, NOW(), NOW())',
          [supplier.code, supplier.name]
        );
        console.log(`✨ Created ${supplier.code}: ${supplier.name}`);
        created++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Created: ${created}`);
    console.log(`   Total: ${suppliers.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateSuppliers();
