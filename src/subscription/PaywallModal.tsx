import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  X,
  Crown,
  Check,
  Zap,
  Download,
  Users,
  Infinity as InfinityIcon,
  Library,
  Share2,
  PenTool,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { borderRadius, spacing } from '../theme/colors';
import { PRODUCTS, SubscriptionPeriod } from '../types/subscription';
import { useSubscription } from './SubscriptionContext';

interface PaywallModalProps {
  visible: boolean;
  onDismiss: () => void;
  /** Contextual message about why the paywall was triggered */
  reason?: string;
}

const PRO_FEATURES = [
  { icon: Library, label: 'Full drill library — every drill unlocked' },
  { icon: InfinityIcon, label: 'Unlimited session plans' },
  { icon: PenTool, label: 'Unlimited custom drills' },
  { icon: Download, label: 'Export sessions to PDF' },
  { icon: Share2, label: 'Share sessions with your staff' },
];

export function PaywallModal({ visible, onDismiss, reason }: PaywallModalProps) {
  const { colors } = useTheme();
  const { purchase, restore } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPeriod>('annual');
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handlePurchase = async () => {
    setIsPurchasing(true);
    try {
      const success = await purchase(selectedPlan);
      if (success) onDismiss();
    } catch {
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const success = await restore();
      if (success) onDismiss();
    } catch {
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Close */}
        <TouchableOpacity style={s.closeButton} onPress={onDismiss} hitSlop={12}>
          <X size={24} color={colors.mutedForeground} />
        </TouchableOpacity>

        <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={s.hero}>
            <View style={[s.crownCircle, { backgroundColor: colors.primaryLight }]}>
              <Crown size={32} color={colors.primary} />
            </View>
            <Text style={[s.title, { color: colors.foreground }]}>Go Pro</Text>
            <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
              Unlock everything Tactiq has to offer
            </Text>
          </View>

          {/* Contextual reason */}
          {reason ? (
            <View style={[s.reasonCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
              <Zap size={16} color={colors.primary} />
              <Text style={[s.reasonText, { color: colors.primary }]}>{reason}</Text>
            </View>
          ) : null}

          {/* Features list */}
          <View style={s.featuresList}>
            {PRO_FEATURES.map((f, i) => (
              <View key={i} style={s.featureRow}>
                <View style={[s.featureIcon, { backgroundColor: colors.primaryLight }]}>
                  <f.icon size={16} color={colors.primary} />
                </View>
                <Text style={[s.featureLabel, { color: colors.foreground }]}>{f.label}</Text>
              </View>
            ))}
          </View>

          {/* Plan picker */}
          <View style={s.planPicker}>
            {/* Annual */}
            <TouchableOpacity
              style={[
                s.planCard,
                {
                  borderColor: selectedPlan === 'annual' ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                  borderWidth: selectedPlan === 'annual' ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedPlan('annual')}
              activeOpacity={0.7}
            >
              <View style={s.planHeader}>
                <View style={s.planRadio}>
                  {selectedPlan === 'annual' ? (
                    <View style={[s.radioFilled, { backgroundColor: colors.primary }]}>
                      <Check size={12} color="#fff" />
                    </View>
                  ) : (
                    <View style={[s.radioEmpty, { borderColor: colors.border }]} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={s.planTitleRow}>
                    <Text style={[s.planTitle, { color: colors.foreground }]}>Annual</Text>
                    <View style={[s.saveBadge, { backgroundColor: colors.primary }]}>
                      <Text style={s.saveBadgeText}>SAVE {PRODUCTS.annual.savingsPercent}%</Text>
                    </View>
                  </View>
                  <Text style={[s.planPrice, { color: colors.foreground }]}>
                    {PRODUCTS.annual.price}
                    <Text style={[s.planPeriod, { color: colors.mutedForeground }]}> /year</Text>
                  </Text>
                  <Text style={[s.planSubtext, { color: colors.mutedForeground }]}>
                    Just ${(PRODUCTS.annual.priceNumeric / 12).toFixed(2)}/month
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Monthly */}
            <TouchableOpacity
              style={[
                s.planCard,
                {
                  borderColor: selectedPlan === 'monthly' ? colors.primary : colors.border,
                  backgroundColor: colors.card,
                  borderWidth: selectedPlan === 'monthly' ? 2 : 1,
                },
              ]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.7}
            >
              <View style={s.planHeader}>
                <View style={s.planRadio}>
                  {selectedPlan === 'monthly' ? (
                    <View style={[s.radioFilled, { backgroundColor: colors.primary }]}>
                      <Check size={12} color="#fff" />
                    </View>
                  ) : (
                    <View style={[s.radioEmpty, { borderColor: colors.border }]} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.planTitle, { color: colors.foreground }]}>Monthly</Text>
                  <Text style={[s.planPrice, { color: colors.foreground }]}>
                    {PRODUCTS.monthly.price}
                    <Text style={[s.planPeriod, { color: colors.mutedForeground }]}> /month</Text>
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[s.ctaButton, { backgroundColor: colors.primary }]}
            onPress={handlePurchase}
            disabled={isPurchasing}
            activeOpacity={0.8}
          >
            {isPurchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.ctaText}>
                Start Free Trial
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[s.trialNote, { color: colors.mutedForeground }]}>
            Try Pro free for 7 days, then{' '}
            {selectedPlan === 'annual' ? PRODUCTS.annual.price + '/yr' : PRODUCTS.monthly.price + '/mo'}
          </Text>

          {/* Restore + legal */}
          <TouchableOpacity onPress={handleRestore} disabled={isRestoring} style={s.restoreButton}>
            <Text style={[s.restoreText, { color: colors.mutedForeground }]}>
              {isRestoring ? 'Restoring...' : 'Restore Purchase'}
            </Text>
          </TouchableOpacity>

          <Text style={[s.legalText, { color: colors.mutedForeground }]}>
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless canceled at least 24 hours before the
            end of the current period. Your account will be charged for renewal within 24
            hours prior to the end of the current period.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  closeButton: {
    position: 'absolute', top: 16, right: 16, zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg, paddingTop: 60, paddingBottom: 40,
  },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  crownCircle: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: spacing.xs },
  subtitle: { fontSize: 15, textAlign: 'center' },
  reasonCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderRadius: borderRadius.md, borderWidth: 1, marginBottom: spacing.lg,
  },
  reasonText: { fontSize: 13, fontWeight: '500', flex: 1 },
  featuresList: { marginBottom: spacing.xl, gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  featureLabel: { fontSize: 15, fontWeight: '500', flex: 1 },
  planPicker: { gap: spacing.sm, marginBottom: spacing.lg },
  planCard: { borderRadius: borderRadius.lg, padding: spacing.md },
  planHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  planRadio: { paddingTop: 2 },
  radioFilled: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
  },
  radioEmpty: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  planTitle: { fontSize: 16, fontWeight: '600' },
  saveBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.sm },
  saveBadgeText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },
  planPrice: { fontSize: 22, fontWeight: '700' },
  planPeriod: { fontSize: 14, fontWeight: '400' },
  planSubtext: { fontSize: 12, marginTop: 2 },
  ctaButton: {
    height: 52, borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm,
  },
  ctaText: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  trialNote: { fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
  restoreButton: { alignItems: 'center', paddingVertical: spacing.sm, marginBottom: spacing.md },
  restoreText: { fontSize: 13, fontWeight: '500' },
  legalText: { fontSize: 10, textAlign: 'center', lineHeight: 14 },
});
