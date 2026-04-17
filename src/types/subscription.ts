// ── Subscription Types ─────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'pro';
export type SubscriptionPeriod = 'monthly' | 'annual';

export interface SubscriptionState {
  tier: SubscriptionTier;
  isProUser: boolean;
  expiresAt?: string;
  period?: SubscriptionPeriod;
  productId?: string;
  hasSeenOnboardingPaywall: boolean;
}

// ── Free Tier Limits ───────────────────────────────────────────────

export const FREE_LIMITS = {
  maxSessions: 1,
  maxCustomDrills: 2,
  canExportPdf: false,
  canShareSessions: false,
} as const;

// ── Product Config ─────────────────────────────────────────────────
// Replace IDs with real App Store Connect / RevenueCat product IDs later.

export const PRODUCTS = {
  monthly: {
    id: 'tactiq_pro_monthly',
    price: '$7.99',
    priceNumeric: 7.99,
    period: 'month' as const,
  },
  annual: {
    id: 'tactiq_pro_annual',
    price: '$49.99',
    priceNumeric: 49.99,
    period: 'year' as const,
    savingsPercent: 48,
  },
} as const;

// ── Gated Features ─────────────────────────────────────────────────

export type GatedFeature =
  | 'create_session'
  | 'create_custom_drill'
  | 'export_pdf'
  | 'share_session'
  | 'view_locked_drill';

export interface EntitlementCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  limit?: number;
}
