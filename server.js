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

  console.log(`[webhook] Received alert ${alert.id} severity=${alert.severity}`);
  const result = await push.pushAlertToNearbyDevices(alert);
  res.json({ success: true, push: result });
});

// Initialize Firebase and start server
push.init();
db.init().catch(console.error);

app.listen(PORT, () => {
  console.log(`SurgeAlert Push Service running on port ${PORT}`);
  console.log(`Webhook URL: http://localhost:${PORT}/webhook/alert`);
});

module.exports = app;
