require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const PORT = process.env.PORT || 8787;

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

// DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // required for Neon
});


const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (!ADMIN_API_KEY || key !== ADMIN_API_KEY) {
    return res.status(401).json({ error: 'admin key required' });
  }
  next();
}


app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'SpiceFlow API is healthy 🚀' });
});


app.get('/api/spiceflow/tasks', async (_req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM tasks ORDER BY id ASC`);
    res.json(r.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});


app.post('/api/spiceflow/claim', async (req, res) => {
  const { userId, taskId, txHash } = req.body || {};
  if (!userId || !taskId) return res.status(400).json({ error: 'userId and taskId required' });

  try {
    
    await pool.query(
      `INSERT INTO users (id, role, points)
       VALUES ($1, 'user', 0)
       ON CONFLICT (id) DO NOTHING`,
      [userId]
    );

    
    const t = await pool.query(`SELECT id, type, points FROM tasks WHERE id=$1`, [taskId]);
    if (!t.rowCount) return res.status(404).json({ error: 'task not found' });

    
    const exists = await pool.query(
      `SELECT 1 FROM claims WHERE user_id=$1 AND task_id=$2`,
      [userId, taskId]
    );
    if (exists.rowCount) return res.json({ message: 'Already claimed ✅' });

    
    await pool.query(
      `INSERT INTO claims (user_id, task_id, tx_hash) VALUES ($1,$2,$3)`,
      [userId, taskId, txHash || null]
    );

    
    await pool.query(
      `UPDATE users SET points = points + $2 WHERE id = $1`,
      [userId, t.rows[0].points]
    );

    res.json({ message: 'Task claimed ✅' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to claim task' });
  }
});


app.get('/api/spiceflow/progress/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await pool.query(`SELECT id, role, points FROM users WHERE id=$1`, [userId]);
    const claims = await pool.query(
      `SELECT c.task_id, c.created_at, t.name, t.points
       FROM claims c
       JOIN tasks t ON c.task_id = t.id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );
    res.json({ user: user.rows[0] || { id: userId, role: 'user', points: 0 }, claims: claims.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

app.post('/api/admin/tasks', requireAdmin, async (req, res) => {
  const { name, type = 'social', points = 100, href = null, description = null } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO tasks (name, type, points, href, description)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [name, type, points, href, description]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to create task' });
  }
});


app.patch('/api/admin/tasks/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, type, points, href, description } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE tasks SET
         name = COALESCE($2, name),
         type = COALESCE($3, type),
         points = COALESCE($4, points),
         href = COALESCE($5, href),
         description = COALESCE($6, description)
       WHERE id = $1
       RETURNING *`,
      [id, name, type, points, href, description]
    );
    if (!rows.length) return res.status(404).json({ error: 'task not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to update task' });
  }
});


app.delete('/api/admin/tasks/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  try {
    const r = await pool.query(`DELETE FROM tasks WHERE id=$1`, [id]);
    res.json({ deleted: r.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to delete task' });
  }
});

app.get('/api/admin/users', requireAdmin, async (_req, res) => {
  const { rows } = await pool.query(`SELECT id, role, points FROM users ORDER BY id ASC`);
  res.json(rows);
});


app.patch('/api/admin/users/:id/role', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const { role } = req.body || {};
  if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: 'role must be admin|user' });
  try {
    const { rows } = await pool.query(
      `UPDATE users SET role=$2 WHERE id=$1 RETURNING id, role, points`,
      [id, role]
    );
    if (!rows.length) return res.status(404).json({ error: 'user not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'failed to update role' });
  }
});


app.listen(PORT, () => {
  console.log(`🚀 SpiceFlow running on http://localhost:${PORT}`);
});