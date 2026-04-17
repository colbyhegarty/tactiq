import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

  /** Check if a gated action is allowed */
  checkEntitlement: (feature: GatedFeature) => Promise<EntitlementCheckResult>;

  /** Check if a specific drill is unlocked for this user */
  isDrillUnlocked: (drillId: string) => boolean;

  /** Mock purchase — replace body with RevenueCat later */
  purchase: (period: SubscriptionPeriod) => Promise<boolean>;

  /** Restore purchases */
  restore: () => Promise<boolean>;

  /** Mark onboarding paywall as seen */
  markOnboardingPaywallSeen: () => void;

  /** DEV ONLY: toggle free ↔ pro */
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

// ── Provider ───────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [subscription, setSubscription] = useState<SubscriptionState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SUB_STATE_KEY)
      .then((stored) => {
        if (stored) {
          try {
            setSubscription({ ...defaultState, ...JSON.parse(stored) });
          } catch {}
        }
      })
      .finally(() => setIsLoaded(true));
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

  // ── Mock Purchase ──────────────────────────────────────────────
  // TODO: Replace with RevenueCat:
  //   import Purchases from 'react-native-purchases';
  //   const { customerInfo } = await Purchases.purchasePackage(pkg);
  //   const isPro = customerInfo.entitlements.active['pro'] !== undefined;
  const purchase = useCallback(
    async (period: SubscriptionPeriod): Promise<boolean> => {
      await new Promise((r) => setTimeout(r, 800));
      const product = period === 'monthly' ? PRODUCTS.monthly : PRODUCTS.annual;
      updateState({
        tier: 'pro',
        isProUser: true,
        period,
        productId: product.id,
        expiresAt: new Date(
          Date.now() + (period === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      return true;
    },
    [updateState],
  );

  // ── Mock Restore ───────────────────────────────────────────────
  const restore = useCallback(async (): Promise<boolean> => {
    await new Promise((r) => setTimeout(r, 600));
    return subscription.isProUser;
  }, [subscription.isProUser]);

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
