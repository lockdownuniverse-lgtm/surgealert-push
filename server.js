// server.js
// Standalone push notification microservice.
// Can also be integrated directly into the main surgealert-api server
// by requiring pushService.js and calling pushAlertToNearbyDevices() 
// from alertService.js after firing an alert.

// dotenv not needed on Railway
const express = require('express');
const axios   = require('axios');

const push         = require('./src/pushService');
const devicesRoute = require('./src/routes/devices');

const app  = express();
const PORT = process.env.PUSH_PORT || 3001;

// The main SurgeAlert API base URL — we'll poll it for new alerts
const API_BASE = process.env.SURGEALERT_API_URL || 'http://localhost:3000/api';

app.use(express.json());

// Device registration endpoints
app.use('/devices', devicesRoute);

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', devices: push.deviceRegistry.size }));

// Webhook endpoint — main API calls this when a new alert fires
// POST /webhook/alert  Body: { alert }
app.post('/webhook/alert', async (req, res) => {
  const { alert } = req.body;
  if (!alert) return res.status(400).json({ error: 'alert payload required' });

  console.log('[webhook] Received alert ' + alert.id + ' severity=' + alert.severity);
  const db2 = require('./src/db');
  const tokens = await db2.getTokensNear(alert.lat, alert.lon, 1.5);
  console.log('[webhook] Found ' + tokens.length + ' devices nearby');
  if (tokens.length === 0) return res.json({ success: true, push: { sent: 0, failed: 0 } });
  const axios = require('axios');
  const messages = tokens.map(token => ({
    to: token,
    title: alert.severity === 'HIGH' ? '🚨 Crowd Surge Alert' : alert.severity === 'MED' ? '⚠️ Crowd Activity' : '📍 Crowd Report',
    body: alert.message || 'Crowd activity detected near you.',
    data: { alertId: String(alert.id), severity: alert.severity },
    sound: 'default', priority: 'high',
  }));
  const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
    headers: { 'Content-Type': 'application/json' }
  });
  const results = Array.isArray(response.data.data) ? response.data.data : [];
  const sent = results.filter(r => r.status === 'ok').length;
  const failed = results.filter(r => r.status !== 'ok').length;
  results.forEach((r, i) => { if (r.status !== 'ok') console.error('[push] Error token ' + i + ':', JSON.stringify(r)); });
  console.log('[push] Alert ' + alert.id + ': ' + sent + ' sent, ' + failed + ' failed');
  res.json({ success: true, push: { sent, failed } });
});

// Initialize Firebase and start server
push.init();
const db2 = require("./src/db");
db2.init().catch(console.error);

app.listen(PORT, () => {
  console.log(`SurgeAlert Push Service running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/alert`);
});

module.exports = app;
