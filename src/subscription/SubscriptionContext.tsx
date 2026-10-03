import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import Purchases, { CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { setUserProperties, track } from '../lib/analytics';
import { getCustomDrills } from '../lib/customDrillStorage';
import {
  ensurePurchasesConfigured,
  syncMetaAttributionToRevenueCat,
} from '../lib/metaAttribution';
import { getSessions } from '../lib/sessionStorage';
import {
  EntitlementCheckResult,
  FREE_LIMITS,
  GatedFeature,
  SubscriptionPeriod,
  SubscriptionState,
  SubscriptionTier
} from '../types/subscription';
import { isDrillFree } from './freeDrillConfig';
import {
  canPreviewDrill,
  consumePreviewView,
  getPreviewRemaining,
  getPreviewState,
  MAX_PREVIEW_VIEWS,
  ProPreviewState,
  resetPreviewState,
} from './proPreview';

// ── RevenueCat Config ──────────────────────────────────────────────
const PRO_ENTITLEMENT_ID = 'pro';

// ── Storage Key ────────────────────────────────────────────────────
const SUB_STATE_KEY = 'tactiq_subscription_state';

// ── Default State ──────────────────────────────────────────────────
const defaultState: SubscriptionState = {
  tier: 'free',
  isProUser: false,
  hasSeenOnboardingPaywall: false,
};

// ── Context Shape ──────────────────────────────────────────────────
interface SubscriptionContextType {
  subscription: SubscriptionState;
  isLoaded: boolean;
  checkEntitlement: (feature: GatedFeature) => Promise<EntitlementCheckResult>;
  isDrillUnlocked: (drillId: string) => boolean;
  /** Try to preview a Pro drill. Returns true if preview granted. */
  tryPreviewDrill: (drillId: string) => Promise<{
    allowed: boolean;
    remaining: number;
    justExhausted: boolean;
  }>;
  /** Current preview state for UI display */
  previewState: ProPreviewState;
  /** Remaining preview count */
  previewRemaining: number;
  purchase: (period: SubscriptionPeriod) => Promise<boolean>;
  restore: () => Promise<boolean>;
  markOnboardingPaywallSeen: () => void;
  __devToggleTier: () => void;
  __devResetPreview: () => void;
}

const defaultPreviewState: ProPreviewState = {
  viewedDrillIds: [],
  exhausted: false,
  firstPreviewAt: null,
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: defaultState,
  isLoaded: false,
  checkEntitlement: async () => ({ allowed: true }),
  isDrillUnlocked: () => true,
  tryPreviewDrill: async () => ({ allowed: false, remaining: 0, justExhausted: false }),
  previewState: defaultPreviewState,
  previewRemaining: MAX_PREVIEW_VIEWS,
  purchase: async () => false,
  restore: async () => false,
  markOnboardingPaywallSeen: () => {},
  __devToggleTier: () => {},
  __devResetPreview: () => {},
});

// ── Helper: extract tier from RevenueCat CustomerInfo ──────────────
function tierFromCustomerInfo(info: CustomerInfo): { tier: SubscriptionTier; isProUser: boolean } {
  const isPro = info.entitlements.active[PRO_ENTITLEMENT_ID] !== undefined;
  return { tier: isPro ? 'pro' : 'free', isProUser: isPro };
}

// ── Provider ───────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [previewState, setPreviewState] = useState<ProPreviewState>(defaultPreviewState);

  useEffect(() => {
    async function init() {
      // Load persisted local state (for hasSeenOnboardingPaywall, etc.)
      try {
        const stored = await AsyncStorage.getItem(SUB_STATE_KEY);
        if (stored) {
          setSubscription((prev) => ({ ...prev, ...JSON.parse(stored) }));
        }
      } catch {}

      // Load preview state
      try {
        const preview = await getPreviewState();
        setPreviewState(preview);
      } catch {}

      // Initialize RevenueCat (shared configure — Meta attribution depends on this)
      try {
        await ensurePurchasesConfigured();

        // Check current entitlements
        const customerInfo = await Purchases.getCustomerInfo();
        const { tier, isProUser } = tierFromCustomerInfo(customerInfo);
        setSubscription((prev) => ({ ...prev, tier, isProUser }));
        setUserProperties({ tier });

        if (__DEV__) console.log('[RevenueCat] Initialized — tier:', tier);
      } catch (err) {
        if (__DEV__) console.warn('[RevenueCat] Init failed:', err);
      }

      setIsLoaded(true);
    }

    init();
  }, []);

  const updateState = useCallback((updates: Partial<SubscriptionState>) => {
    setSubscription((prev) => {
      const next = { ...prev, ...updates };
      AsyncStorage.setItem(SUB_STATE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── Drill Access (UI-only) ──────────────────────────────────────
  // Controls whether drill cards show the lock overlay. During the
  // Returns whether a drill should visually appear unlocked (no lock
  // icon, no dimmed thumbnail). Preview access is handled separately
  // in handleViewDrill / tryPreviewDrill — this only controls the
  // DrillCard's isLocked visual state.
  const isDrillUnlocked = useCallback(
    (drillId: string): boolean => {
      if (subscription.isProUser) return true;
      return isDrillFree(drillId);
    },
    [subscription.isProUser],
  );

  // ── Preview System ────────────────────────────────────────────
  const tryPreviewDrill = useCallback(
    async (drillId: string): Promise<{
      allowed: boolean;
      remaining: number;
      justExhausted: boolean;
    }> => {
      if (subscription.isProUser) {
        return { allowed: true, remaining: MAX_PREVIEW_VIEWS, justExhausted: false };
      }

      if (isDrillFree(drillId)) {
        return { allowed: true, remaining: getPreviewRemaining(previewState), justExhausted: false };
      }

      // Check if can preview
      const canPreview = await canPreviewDrill(drillId);
      if (!canPreview) {
        return {
          allowed: false,
          remaining: 0,
          justExhausted: false,
        };
      }

      // Consume a preview view
      const result = await consumePreviewView(drillId);
      // Update local state
      setPreviewState(result.state);

      return {
        allowed: true,
        remaining: result.remaining,
        justExhausted: result.justExhausted,
      };
    },
    [subscription.isProUser, previewState],
  );

  // ── Entitlement Checks ─────────────────────────────────────────
  const checkEntitlement = useCallback(
    async (feature: GatedFeature): Promise<EntitlementCheckResult> => {
      if (subscription.isProUser) return { allowed: true };

      switch (feature) {
        case 'create_session': {
          const sessions = await getSessions();
          if (sessions.length >= FREE_LIMITS.maxSessions) {
            return {
              allowed: false,
              reason: `Free accounts are limited to ${FREE_LIMITS.maxSessions} session. Upgrade to Pro for unlimited session plans.`,
              currentCount: sessions.length,
              limit: FREE_LIMITS.maxSessions,
            };
          }
          return { allowed: true, currentCount: sessions.length, limit: FREE_LIMITS.maxSessions };
        }

        case 'create_custom_drill': {
          const custom = await getCustomDrills();
          if (custom.length >= FREE_LIMITS.maxCustomDrills) {
            return {
              allowed: false,
              reason: `Free accounts are limited to ${FREE_LIMITS.maxCustomDrills} custom drills. Upgrade to Pro for unlimited drill creation.`,
              currentCount: custom.length,
              limit: FREE_LIMITS.maxCustomDrills,
            };
          }
          return { allowed: true, currentCount: custom.length, limit: FREE_LIMITS.maxCustomDrills };
        }

        case 'export_pdf':
          return {
            allowed: false,
            reason: 'PDF export is a Pro feature. Upgrade to export your sessions as clean, printable PDFs.',
          };

        case 'share_session':
          return {
            allowed: false,
            reason: 'Session sharing is a Pro feature. Upgrade to share plans with your coaching staff.',
          };

        case 'view_locked_drill':
          // Check if preview is available
          if (!previewState.exhausted) {
            const remaining = getPreviewRemaining(previewState);
            if (remaining > 0) {
              return {
                allowed: false,
                reason: `You have ${remaining} free Pro drill preview${remaining === 1 ? '' : 's'} remaining. Tap to preview this drill.`,
              };
            }
          }
          return {
            allowed: false,
            reason: 'You\'ve used all your free Pro drill previews. Upgrade to unlock the full drill library.',
          };

        default:
          return { allowed: true };
      }
    },
    [subscription.isProUser, previewState],
  );

  // ── Purchase via RevenueCat ────────────────────────────────────
  const purchase = useCallback(
    async (period: SubscriptionPeriod): Promise<boolean> => {
      track('purchase_started', { plan: period });

      try {
        // Re-sync Meta/device IDs right before purchase so StartTrial/Subscribe can deliver.
        try {
          await syncMetaAttributionToRevenueCat();
        } catch (attrErr) {
          if (__DEV__) console.warn('[RevenueCat] Pre-purchase attribution sync failed:', attrErr);
        }

        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings.current;

        if (!currentOffering) {
          throw new Error('No offerings configured in RevenueCat');
        }

        const pkg: PurchasesPackage | null | undefined =
          period === 'annual' ? currentOffering.annual : currentOffering.monthly;

        if (!pkg) {
          throw new Error(`No ${period} package found in current offering`);
        }

        const { customerInfo } = await Purchases.purchasePackage(pkg);
        const { tier, isProUser } = tierFromCustomerInfo(customerInfo);

        updateState({ tier, isProUser, period });
        track('purchase_completed', { plan: period });
        setUserProperties({ tier });

        return isProUser;
      } catch (err: any) {
        if (err.userCancelled) {
          track('purchase_failed', { plan: period, error: 'user_cancelled' });
          return false;
        }

        track('purchase_failed', { plan: period, error: err.message });
        if (__DEV__) console.warn('[RevenueCat] Purchase error:', err);
        Alert.alert('Purchase Failed', 'Something went wrong. Please try again.');
        return false;
      }
    },
    [updateState],
  );

  // ── Restore via RevenueCat ─────────────────────────────────────
  const restore = useCallback(async (): Promise<boolean> => {
    track('restore_started', {});

    try {
      const customerInfo = await Purchases.restorePurchases();
      const { tier, isProUser } = tierFromCustomerInfo(customerInfo);

      updateState({ tier, isProUser });
      track('restore_completed', { had_purchase: isProUser });
      setUserProperties({ tier });

      if (!isProUser) {
        Alert.alert('No Purchase Found', 'We couldn\'t find a previous Pro subscription for this Apple ID.');
      }

      return isProUser;
    } catch (err: any) {
      if (__DEV__) console.warn('[RevenueCat] Restore error:', err);
      Alert.alert('Restore Failed', 'Something went wrong. Please try again.');
      track('restore_completed', { had_purchase: false });
      return false;
    }
  }, [updateState]);

  const markOnboardingPaywallSeen = useCallback(() => {
    updateState({ hasSeenOnboardingPaywall: true });
  }, [updateState]);

  // ── Dev Toggle ─────────────────────────────────────────────────
  const __devToggleTier = useCallback(() => {
    const next: SubscriptionTier = subscription.isProUser ? 'free' : 'pro';
    updateState({
      tier: next,
      isProUser: next === 'pro',
      period: next === 'pro' ? 'annual' : undefined,
      expiresAt: next === 'pro'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
    });
  }, [subscription.isProUser, updateState]);

  const __devResetPreview = useCallback(async () => {
    await resetPreviewState();
    setPreviewState(defaultPreviewState);
    if (__DEV__) console.log('[Preview] Reset to default state');
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoaded,
        checkEntitlement,
        isDrillUnlocked,
        tryPreviewDrill,
        previewState,
        previewRemaining: getPreviewRemaining(previewState),
        purchase,
        restore,
        markOnboardingPaywallSeen,
        __devToggleTier,
        __devResetPreview,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
