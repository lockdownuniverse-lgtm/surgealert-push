// surgealert-app/src/components/AlertBanner.js
// Shows an animated in-app banner when a push arrives while the app is open.
// Usage: mount <AlertBanner /> at the root of App.js, it manages its own visibility.

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity, Dimensions,
} from 'react-native';
import { onForegroundMessage } from '../services/pushNotifications';

const SEVERITY_COLORS = {
  HIGH: '#D85A30',
  MED:  '#EF9F27',
  LOW:  '#639922',
};

const { width } = Dimensions.get('window');
const BANNER_DURATION_MS = 5000;

export function AlertBanner({ onPress }) {
  const [alert, setAlert]   = useState(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const timerRef   = useRef(null);

  useEffect(() => {
    // Subscribe to foreground push messages
    const unsubscribe = onForegroundMessage(incoming => {
      if (!incoming.severity) return; // ignore score_update type
      showBanner(incoming);
    });
    return unsubscribe;
  }, []);

  function showBanner(incomingAlert) {
    // Clear any existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    setAlert(incomingAlert);

    // Slide in
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();

    // Auto-dismiss after 5s
    timerRef.current = setTimeout(hideBanner, BANNER_DURATION_MS);
  }

  function hideBanner() {
    Animated.timing(translateY, {
      toValue: -120,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setAlert(null));
  }

  function handlePress() {
    hideBanner();
    if (alert && onPress) onPress(alert);
  }

  if (!alert) return null;

  const color = SEVERITY_COLORS[alert.severity] ?? '#888';

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
      <TouchableOpacity
        style={[styles.banner, { borderLeftColor: color, borderLeftWidth: 4 }]}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color }]} numberOfLines={1}>
            {alert.title ?? '⚠️ Surge Alert'}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {alert.body ?? alert.location ?? 'Crowd activity detected nearby'}
          </Text>
        </View>
        <TouchableOpacity style={styles.dismiss} onPress={hideBanner}>
          <Text style={styles.dismissText}>✕</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingTop: 52, // below status bar
  },
  banner: {
    backgroundColor: '#fff',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  content: { flex: 1 },
  title: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  body: {
    fontSize: 13,
    color: '#5F5E5A',
    lineHeight: 18,
  },
  dismiss: {
    paddingLeft: 12,
    paddingVertical: 4,
  },
  dismissText: {
    fontSize: 16,
    color: '#888',
  },
});
