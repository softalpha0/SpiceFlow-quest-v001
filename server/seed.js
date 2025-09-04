require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const X_URL = 'https://x.com/spicenetio?s=21';
const LI_URL = 'https://www.linkedin.com/company/spicenet/';
const CREST_URL = 'http://crest-fork.vercel.app';
const SEP_FAUCET = 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia';
const DiSCORD_RUL = 'https://discord.gg/sTNr3pKpcN';

(async () => {
  try {
    
    const adminId = process.env.ADMIN_ID || 'softalpha';
    await pool.query(
      `INSERT INTO users (id, role, points)
       VALUES ($1, 'admin', 0)
       ON CONFLICT (id) DO NOTHING`,
      [adminId]
    );

    
    const tasks = [
      { name: 'Follow us on X',         type: 'social', points: 100, href: X_URL,   description: 'Follow @spicenetio on X' },
      { name: 'Follow us on LinkedIn',  type: 'social', points: 100, href: LI_URL,  description: 'Follow SpiceNet on LinkedIn' },
      { name: 'Engage in Community Chat', type: 'social', points: 200, href: 'https://discord.gg/sTNr3pKpcN', description: 'give feedback on discord' },
      { name: 'Join SpiceFlow Testnet', type: 'tx',     points: 300, href: CREST_URL, description: 'Use the first Spice Flow integration on Crest testnet' },
      { name: 'Get Sepolia ETH',        type: 'special', points: 150, href: SEP_FAUCET, description: 'Fund your wallet via Google Cloud Sepolia faucet' }
    ];

    for (const t of tasks) {
      await pool.query(`
  INSERT INTO users (username, role) VALUES
  ('admin', 'admin'),
  ('alice', 'user'),
  ('bob', 'user')
  ON CONFLICT (username) DO NOTHING
`);
    }

    
    await pool.query(`UPDATE users SET points = 0 WHERE id = $1`, [adminId]);

    
    const { rows } = await pool.query(`SELECT id, name, points FROM tasks ORDER BY id ASC`);
    console.log(`Seeded tasks: ${rows.length} ✅`);
  } catch (err) {
    console.error('Seeding failed ❌', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();