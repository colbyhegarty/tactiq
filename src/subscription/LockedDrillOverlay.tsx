import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Lock, Crown } from 'lucide-react-native';
import { borderRadius, spacing } from '../theme/colors';

/**
 * Overlay rendered on top of a drill card's image when the drill is locked.
 * Applies a semi-transparent dark layer (simulating blur) and shows a lock icon.
 *
 * Usage in DrillCard:
 *   {isLocked && <LockedDrillOverlay />}
 */
export function LockedDrillOverlay() {
  return (
    <View style={s.container}>
      {/* Dark frost layer — simulates blur without native blur dependency */}
      <View style={s.frost} />
      {/* Lock badge */}
      <View style={s.badge}>
        <Crown size={14} color="#fff" />
        <Text style={s.badgeText}>PRO</Text>
      </View>
    </View>
  );
}

/**
 * Small lock icon shown on the drill card's bookmark button area
 * when the drill is locked. Replaces the bookmark for locked drills.
 */
export function LockIcon({ size = 14 }: { size?: number }) {
  return <Lock size={size} color="#fff" />;
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 24, 35, 0.65)',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(74, 157, 110, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 1,
  },
});
