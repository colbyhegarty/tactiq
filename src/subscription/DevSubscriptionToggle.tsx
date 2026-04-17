import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSubscription } from './SubscriptionContext';

const __DEV_MODE__ = __DEV__;

/**
 * Floating dev toggle for quickly switching between free/pro tiers.
 * Only renders in __DEV__ mode.
 */
export function DevSubscriptionToggle() {
  const { subscription, __devToggleTier } = useSubscription();

  if (!__DEV_MODE__) return null;

  return (
    <TouchableOpacity
      style={[s.toggle, subscription.isProUser ? s.togglePro : s.toggleFree]}
      onPress={__devToggleTier}
      activeOpacity={0.7}
    >
      <Text style={s.toggleText}>
        {subscription.isProUser ? 'PRO' : 'FREE'}
      </Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  toggle: {
    position: 'absolute', bottom: 100, right: 12,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
    zIndex: 9999, elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4,
  },
  toggleFree: { backgroundColor: '#dc2626' },
  togglePro: { backgroundColor: '#4a9d6e' },
  toggleText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});
