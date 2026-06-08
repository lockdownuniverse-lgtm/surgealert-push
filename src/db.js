
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_devices (
      token TEXT PRIMARY KEY,
      lat DOUBLE PRECISION,
      lon DOUBLE PRECISION,
      platform TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  console.log('[db] push_devices table ready');
}

async function registerDevice({ token, lat, lon, platform }) {
  await pool.query(
    `INSERT INTO push_devices (token, lat, lon, platform)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token) DO UPDATE SET lat=$2, lon=$3, updated_at=NOW()`,
    [token, lat, lon, platform || 'unknown']
  );
}

async function unregisterDevice(token) {
  await pool.query('DELETE FROM push_devices WHERE token = $1', [token]);
}

async function getTokensNear(lat, lon, radiusKm = 1.5) {
  const r = radiusKm * 1000;
  const { rows } = await pool.query(
    `SELECT token FROM push_devices
     WHERE (6371000 * acos(
       cos(radians($1)) * cos(radians(lat)) * cos(radians(lon) - radians($2)) +
       sin(radians($1)) * sin(radians(lat))
     )) < $3`,
    [lat, lon, r]
  );
  return rows.map(r => r.token);
}

async function count() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM push_devices');
  return rows[0].count;
}

module.exports = { init, registerDevice, unregisterDevice, getTokensNear, count };
