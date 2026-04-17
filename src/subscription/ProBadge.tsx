import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Crown, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { borderRadius, spacing } from '../theme/colors';
import { useSubscription } from './SubscriptionContext';
import { FREE_LIMITS } from '../types/subscription';

interface ProBadgeProps {
  onPress: () => void;
  /** Compact mode for header bars */
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
 * Shows current plan status — "Pro" badge for paid users,
 * usage summary for free users.
 */
export function PlanStatusCard({ onUpgrade }: { onUpgrade: () => void }) {
  const { colors } = useTheme();
  const { subscription } = useSubscription();

  if (subscription.isProUser) {
    return (
      <View style={[cs.statusCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
        <View style={[cs.statusIconCircle, { backgroundColor: colors.primary }]}>
          <Crown size={16} color="#fff" />
        </View>
        <View style={cs.statusContent}>
          <Text style={[cs.statusTitle, { color: colors.primary }]}>Pro Plan</Text>
          <Text style={[cs.statusSubtitle, { color: colors.mutedForeground }]}>
            All features unlocked
          </Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[cs.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onUpgrade}
      activeOpacity={0.7}
    >
      <View style={cs.statusContent}>
        <View style={cs.statusHeaderRow}>
          <Text style={[cs.statusTitle, { color: colors.foreground }]}>Free Plan</Text>
          <View style={[cs.upgradePill, { backgroundColor: colors.primary }]}>
            <Crown size={10} color="#fff" />
            <Text style={cs.upgradePillText}>UPGRADE</Text>
          </View>
        </View>
        <Text style={[cs.statusSubtitle, { color: colors.mutedForeground }]}>
          {FREE_LIMITS.maxSessions} session · {FREE_LIMITS.maxCustomDrills} custom drills · Limited library
        </Text>
      </View>
      <ChevronRight size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );
}

const cs = StyleSheet.create({
  // Compact pill
  compactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.full,
  },
  compactText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },

  // Card (profile page)
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

  // Status card
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: spacing.md, borderRadius: borderRadius.lg,
    borderWidth: 1, marginBottom: spacing.md,
  },
  statusIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  statusContent: { flex: 1 },
  statusHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  statusTitle: { fontSize: 14, fontWeight: '600' },
  statusSubtitle: { fontSize: 12 },
  upgradePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full,
  },
  upgradePillText: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
});
