import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import Purchases, { PurchasesPackage, CustomerInfo, LOG_LEVEL } from 'react-native-purchases';
import {
  EntitlementCheckResult,
  FREE_LIMITS,
  GatedFeature,
  PRODUCTS,
  SubscriptionPeriod,
  SubscriptionState,
  SubscriptionTier,
} from '../types/subscription';
import { getSessions } from '../lib/sessionStorage';
import { getCustomDrills } from '../lib/customDrillStorage';
import { isDrillFree } from './freeDrillConfig';
import { track, setUserProperties } from '../lib/analytics';

// ── RevenueCat Config ──────────────────────────────────────────────
const REVENUECAT_API_KEY = 'test_oambzhfeqtJWlYMFjwgYhVTAlBr';
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
  purchase: (period: SubscriptionPeriod) => Promise<boolean>;
  restore: () => Promise<boolean>;
  markOnboardingPaywallSeen: () => void;
  __devToggleTier: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: defaultState,
  isLoaded: false,
  checkEntitlement: async () => ({ allowed: true }),
  isDrillUnlocked: () => true,
  purchase: async () => false,
  restore: async () => false,
  markOnboardingPaywallSeen: () => {},
  __devToggleTier: () => {},
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

  useEffect(() => {
    async function init() {
      // Load persisted local state (for hasSeenOnboardingPaywall, etc.)
      try {
        const stored = await AsyncStorage.getItem(SUB_STATE_KEY);
        if (stored) {
          setSubscription((prev) => ({ ...prev, ...JSON.parse(stored) }));
        }
      } catch {}

      // Initialize RevenueCat
      try {
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }

        Purchases.configure({ apiKey: REVENUECAT_API_KEY });

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

  // ── Drill Access ───────────────────────────────────────────────
  const isDrillUnlocked = useCallback(
    (drillId: string): boolean => {
      if (subscription.isProUser) return true;
      return isDrillFree(drillId);
    },
    [subscription.isProUser],
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
          return {
            allowed: false,
            reason: 'This drill is only available with Pro. Upgrade to unlock the full drill library.',
          };

        default:
          return { allowed: true };
      }
    },
    [subscription.isProUser],
  );

  // ── Purchase via RevenueCat ────────────────────────────────────
  const purchase = useCallback(
    async (period: SubscriptionPeriod): Promise<boolean> => {
      track('purchase_started', { plan: period });

      try {
        const offerings = await Purchases.getOfferings();
        const currentOffering = offerings.current;

        if (!currentOffering) {
          throw new Error('No offerings configured in RevenueCat');
        }

        const pkg: PurchasesPackage | undefined =
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

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        isLoaded,
        checkEntitlement,
        isDrillUnlocked,
        purchase,
        restore,
        markOnboardingPaywallSeen,
        __devToggleTier,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
