const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const needsSSL = connectionString && /sslmode=require/i.test(connectionString);

const pool = new Pool({
  connectionString,
  max: 10,
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};