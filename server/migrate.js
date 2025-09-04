// server/migrate.js
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  try {
    // Create users table with role
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'user'
      )
    `);

    // Create tasks table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        points INT NOT NULL
      )
    `);

    // Create claims table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS claims (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id),
        task_id INT REFERENCES tasks(id),
        UNIQUE(user_id, task_id)
      )
    `);

    console.log("✅ Migration complete");
  } catch (err) {
    console.error("Migration failed ❌", err);
  } finally {
    await pool.end();
  }
}

migrate();