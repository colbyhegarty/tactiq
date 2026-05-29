import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Crown, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { borderRadius, spacing } from '../theme/colors';
import { useSubscription } from './SubscriptionContext';
import { FREE_LIMITS } from '../types/subscription';

interface ProBadgeProps {
  onPress: () => void;
  compact?: boolean;
}

/**
 * Persistent "Go Pro" button. Shows as a card on the profile screen
 * or as a compact pill in headers. Hidden for pro users.
 */
export function ProBadge({ onPress, compact = false }: ProBadgeProps) {
  const { colors } = useTheme();
  const { subscription } = useSubscription();

  if (subscription.isProUser) return null;

  if (compact) {
    return (
      <TouchableOpacity
        style={[cs.compactBtn, { backgroundColor: colors.primary }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Crown size={12} color="#fff" />
        <Text style={cs.compactText}>PRO</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[cs.card, { backgroundColor: colors.card, borderColor: colors.primary }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[cs.iconCircle, { backgroundColor: colors.primaryLight }]}>
        <Crown size={20} color={colors.primary} />
      </View>
      <View style={cs.cardContent}>
        <Text style={[cs.cardTitle, { color: colors.foreground }]}>Upgrade to Pro</Text>
        <Text style={[cs.cardSubtitle, { color: colors.mutedForeground }]}>
          Unlock all drills, unlimited sessions, PDF export & more
        </Text>
      </View>
      <ChevronRight size={18} color={colors.primary} />
    </TouchableOpacity>
  );
}

/**
 * Subtle inline pill — sits below the user's name in the profile card.
 * Pro: small green "Pro" chip. Free: muted nudge with upgrade tap target.
 */
export function PlanStatusCard({ onUpgrade }: { onUpgrade: () => void }) {
  const { colors } = useTheme();
  const { subscription } = useSubscription();

  if (subscription.isProUser) {
    return (
      <View style={[cs.pill, { backgroundColor: colors.primaryLight }]}>
        <Crown size={11} color={colors.primary} />
        <Text style={[cs.pillText, { color: colors.primary }]}>Pro</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[cs.pill, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
      onPress={onUpgrade}
      activeOpacity={0.7}
    >
      <Text style={[cs.pillText, { color: colors.mutedForeground }]}>Free</Text>
      <View style={[cs.pillDivider, { backgroundColor: colors.border }]} />
      <Crown size={11} color={colors.primary} />
      <Text style={[cs.pillText, { color: colors.primary }]}>Upgrade</Text>
    </TouchableOpacity>
  );
}

const cs = StyleSheet.create({
  // Compact pill (header bars)
  compactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.full,
  },
  compactText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  // Full upgrade card (used elsewhere)
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, borderRadius: borderRadius.lg,
    borderWidth: 1.5, marginBottom: spacing.md,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center',
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  cardSubtitle: { fontSize: 12, lineHeight: 16 },

  // Inline status pill
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'center',
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: borderRadius.full,
    marginTop: 6,
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  pillDivider: { width: 1, height: 10 },
});
