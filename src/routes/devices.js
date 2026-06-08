// src/routes/devices.js
// Mobile app calls POST /devices/register on every launch with its FCM token + location.
// Called again whenever location changes significantly (>500m).

const express = require('express');
const router  = express.Router();
const push    = require('../pushService');

// POST /devices/register
// Body: { token, lat, lon, platform }
router.post('/register', (req, res) => {
  const { token, lat, lon, platform } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token is required' });
  }
  const latN = parseFloat(lat);
  const lonN = parseFloat(lon);
  if (isNaN(latN) || isNaN(lonN)) {
    return res.status(400).json({ error: 'lat and lon must be numeric' });
  }

  push.registerDevice({ token, lat: latN, lon: lonN, platform });
  console.log(`[devices] Registered ${platform} device near ${latN.toFixed(3)},${lonN.toFixed(3)}`);
  res.json({ success: true, registered: push.deviceRegistry.size });
});

// POST /devices/unregister  (called on logout or notification opt-out)
router.post('/unregister', (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  push.unregisterDevice(token);
  res.json({ success: true });
});

// GET /devices/count  (debug/admin)
router.get('/count', (req, res) => {
  res.json({ registered: push.deviceRegistry.size });
});

module.exports = router;
