const express = require('express');
const router = express.Router();
const db = require('../db');

router.post('/register', async (req, res) => {
  const { token, lat, lon, platform } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  const latN = parseFloat(lat);
  const lonN = parseFloat(lon);
  if (isNaN(latN) || isNaN(lonN)) return res.status(400).json({ error: 'lat and lon required' });
  await db.registerDevice({ token, lat: latN, lon: lonN, platform });
  const count = await db.count();
  console.log('[devices] Registered ' + platform + ' device');
  res.json({ success: true, registered: count });
});

router.post('/unregister', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  await db.unregisterDevice(token);
  res.json({ success: true });
});

router.get('/count', async (req, res) => {
  const count = await db.count();
  res.json({ registered: count });
});

module.exports = router;
