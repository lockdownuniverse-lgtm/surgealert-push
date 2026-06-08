// surgealert-app/src/services/pushNotifications.js
// Drop this into the React Native app.
// Call setup() once on app launch (in App.js useEffect).

import { Platform, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerDeviceToken } from './api';

const TOKEN_KEY = 'fcm_device_token';

// Request permission and register the device token with our backend
export async function setup(userLocation) {
  try {
    // Request permission (iOS shows a dialog, Android 13+ requires it too)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[push] Permission not granted');
      return;
    }

    // Get FCM token
    const token = await messaging().getToken();
    console.log('[push] FCM token:', token.slice(0, 20) + '…');

    // Store locally
    await AsyncStorage.setItem(TOKEN_KEY, token);

    // Register with our backend
    if (userLocation) {
      await registerDeviceToken({
        token,
        lat: userLocation.lat,
        lon: userLocation.lon,
        platform: Platform.OS,
      });
    }

    // Listen for token refresh
    messaging().onTokenRefresh(async newToken => {
      await AsyncStorage.setItem(TOKEN_KEY, newToken);
      if (userLocation) {
        await registerDeviceToken({
          token: newToken,
          lat: userLocation.lat,
          lon: userLocation.lon,
          platform: Platform.OS,
        });
      }
    });

  } catch (err) {
    console.error('[push] Setup error:', err.message);
  }
}

// Handle foreground notifications (app is open)
export function onForegroundMessage(callback) {
  return messaging().onMessage(async remoteMessage => {
    console.log('[push] Foreground message:', remoteMessage.data?.type);

    if (remoteMessage.data?.type === 'surge_alert') {
      // Show an in-app banner instead of a system notification
      // (system notifications only show when app is backgrounded)
      callback({
        alertId:   remoteMessage.data.alertId,
        severity:  remoteMessage.data.severity,
        score:     parseInt(remoteMessage.data.score),
        title:     remoteMessage.notification?.title,
        body:      remoteMessage.notification?.body,
        lat:       parseFloat(remoteMessage.data.lat),
        lon:       parseFloat(remoteMessage.data.lon),
        location:  remoteMessage.data.location,
      });
    }

    if (remoteMessage.data?.type === 'score_update') {
      // Silent update — just refresh the alerts state
      callback({ type: 'score_update', score: parseInt(remoteMessage.data.score) });
    }
  });
}

// Handle notification tap (app was backgrounded/killed)
export function onNotificationTap(navigationRef) {
  // App opened FROM a notification tap while killed
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage?.data?.alertId) {
        // Navigate to alert detail once navigation is ready
        setTimeout(() => {
          navigationRef.current?.navigate('AlertDetail', {
            alert: { id: parseInt(remoteMessage.data.alertId), ...remoteMessage.data },
          });
        }, 500);
      }
    });

  // App brought to foreground from background notification tap
  return messaging().onNotificationOpenedApp(remoteMessage => {
    if (remoteMessage?.data?.alertId) {
      navigationRef.current?.navigate('AlertDetail', {
        alert: { id: parseInt(remoteMessage.data.alertId), ...remoteMessage.data },
      });
    }
  });
}

// Background message handler — must be registered at the top level of index.js
// Add this to index.js: import { backgroundHandler } from './src/services/pushNotifications';
export function registerBackgroundHandler() {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('[push] Background message:', remoteMessage.data?.type);
    // Background processing here (e.g. update badge count)
    // Note: UI updates not possible in background — data only
  });
}
