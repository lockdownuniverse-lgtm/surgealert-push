// src/pushService.js
// Firebase Cloud Messaging (FCM) — covers both Android and iOS via APNs bridge.
// Devices register their FCM token + location on app open.
// When an alert fires, we query registered tokens within radius and push.

const admin = require('firebase-admin');
const { haversine } = require('./geoUtils');

let initialized = false;

function init() {
  if (initialized) return;
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.warn('[push] FIREBASE_SERVICE_ACCOUNT_PATH not set — push notifications disabled');
    return;
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  initialized = true;
  console.log('[push] Firebase Admin initialized');
}

// In-memory device registry — swap for Redis/Postgres in production
// Shape: { token, lat, lon, platform, updatedAt }
const deviceRegistry = new Map();

function registerDevice({ token, lat, lon, platform = 'unknown' }) {
  deviceRegistry.set(token, { token, lat, lon, platform, updatedAt: Date.now() });
}

function unregisterDevice(token) {
  deviceRegistry.delete(token);
}

// Get all tokens within radiusKm of a point
function getTokensNear(lat, lon, radiusKm = 1.5) {
  const tokens = [];
  for (const device of deviceRegistry.values()) {
    if (haversine(lat, lon, device.lat, device.lon) <= radiusKm) {
      tokens.push(device.token);
    }
  }
  return tokens;
}

const SEVERITY_TITLES = {
  HIGH: '🚨 Crowd Surge Alert',
  MED:  '⚠️ Crowd Activity Nearby',
  LOW:  '📍 Crowd Report Nearby',
};

const SEVERITY_BODIES = {
  HIGH: 'Large crowd surge detected near you. Consider avoiding the area.',
  MED:  'Elevated crowd activity detected nearby. Use caution.',
  LOW:  'Unusual crowd activity reported near your location.',
};

// Send push notifications for an alert to all nearby devices
async function pushAlertToNearbyDevices(alert) {
  if (!initialized) {
    console.log('[push] Skipping — Firebase not initialized');
    return { sent: 0, failed: 0 };
  }

  const tokens = getTokensNear(alert.lat, alert.lon);
  if (tokens.length === 0) {
    console.log(`[push] No registered devices near alert ${alert.id}`);
    return { sent: 0, failed: 0 };
  }

  const message = {
    notification: {
      title: SEVERITY_TITLES[alert.severity] ?? '⚠️ SurgeAlert',
      body:  SEVERITY_BODIES[alert.severity] ?? alert.message,
    },
    data: {
      alertId:   String(alert.id),
      severity:  alert.severity,
      score:     String(alert.score),
      lat:       String(alert.lat),
      lon:       String(alert.lon),
      location:  alert.locationLabel ?? '',
      type:      'surge_alert',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'surge_alerts',
        priority: 'max',
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: SEVERITY_TITLES[alert.severity],
            body:  SEVERITY_BODIES[alert.severity],
          },
          sound: 'default',
          badge: 1,
          'content-available': 1,
        },
      },
      headers: { 'apns-priority': '10' },
    },
    tokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`[push] Alert ${alert.id}: ${response.successCount} sent, ${response.failureCount} failed`);
    response.responses.forEach((r, i) => { if (!r.success) console.error('[push] Error:', JSON.stringify(r.error)); });

    // Clean up stale/invalid tokens
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          console.log(`[push] Removing stale token: ${tokens[idx].slice(0, 20)}…`);
          deviceRegistry.delete(tokens[idx]);
        }
      }
    });

    return {
      sent: response.successCount,
      failed: response.failureCount,
      total: tokens.length,
    };
  } catch (err) {
    console.error('[push] FCM error:', err.message);
    return { sent: 0, failed: tokens.length, error: err.message };
  }
}


async function pushAlertToNearbyDevices(alert) {
  const tokens = getTokensNear(alert.lat, alert.lon);
  if (tokens.length === 0) {
    console.log('[push] No registered devices near alert ' + alert.id);
    return { sent: 0, failed: 0 };
  }

  const messages = tokens.map(token => ({
    to: token,
    title: SEVERITY_TITLES[alert.severity] || 'SurgeAlert',
    body: SEVERITY_BODIES[alert.severity] || alert.message,
    data: { alertId: String(alert.id), severity: alert.severity, score: String(alert.score) },
    sound: 'default',
    priority: 'high',
  }));

  try {
    const axios = require('axios');
    const response = await axios.post('https://exp.host/--/api/v2/push/send', messages, {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    });
    const results = response.data.data || [];
    const sent = results.filter(r => r.status === 'ok').length;
    const failed = results.filter(r => r.status !== 'ok').length;
    console.log('[push] Alert ' + alert.id + ': ' + sent + ' sent, ' + failed + ' failed');
    return { sent, failed, total: tokens.length };
  } catch (err) {
    console.error('[push] Expo push error:', err.message);
    return { sent: 0, failed: tokens.length, error: err.message };
  }
}


module.exports = {
  init,
  registerDevice,
  unregisterDevice,
  getTokensNear,
  pushAlertToNearbyDevices,
  deviceRegistry,
};