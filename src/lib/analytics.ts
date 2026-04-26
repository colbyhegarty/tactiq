// ══════════════════════════════════════════════════════════════════
// ANALYTICS MODULE
// ══════════════════════════════════════════════════════════════════
//
// Thin wrapper around PostHog. All event names and properties are
// typed so you get autocomplete and can't accidentally log typos.
//
// SETUP:
// 1. Create a free PostHog account at https://posthog.com
// 2. Create a project and copy your API key
// 3. Paste it below in POSTHOG_API_KEY
// 4. Install: npx expo install posthog-react-native expo-file-system expo-application expo-device expo-localization
//
// PostHog free tier: 1M events/month, no credit card required.
// ══════════════════════════════════════════════════════════════════

import PostHog from 'posthog-react-native';

// ── Config ─────────────────────────────────────────────────────────
// Replace with your real PostHog API key from https://app.posthog.com/project/settings
const POSTHOG_API_KEY = 'phc_uwLeXDz3EBSXSVdaAXj9GMCuYo37ycrqFDBL3wusaQJB';
const POSTHOG_HOST = 'https://us.i.posthog.com'; // or 'https://eu.i.posthog.com' for EU

// ── Client ─────────────────────────────────────────────────────────
let posthog: PostHog | null = null;

export async function initAnalytics(): Promise<void> {
  if (POSTHOG_API_KEY === 'YOUR_POSTHOG_API_KEY') {
    if (__DEV__) console.log('[Analytics] Skipping — no API key configured');
    return;
  }

  try {
    posthog = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      captureNativeAppLifecycleEvents: true,
    });
    if (__DEV__) console.log('[Analytics] PostHog initialized');
  } catch (err) {
    if (__DEV__) console.warn('[Analytics] PostHog init failed:', err);
  }
}

// ── Typed Events ───────────────────────────────────────────────────
// Every event your app can track. Add new events here and they'll
// get type-checked everywhere you call `track()`.

type AnalyticsEvents = {
  // Navigation / screens
  screen_viewed: { screen: string };

  // Drill library
  drill_viewed: { drill_id: string; drill_name: string; category?: string };
  drill_saved: { drill_id: string; drill_name: string };
  drill_unsaved: { drill_id: string };
  locked_drill_tapped: { drill_id: string; drill_name: string };

  // Sessions
  session_created: {};
  session_viewed: { session_id: string };
  session_exported_pdf: { session_id: string };
  session_shared: { session_id: string; method: 'email' | 'sms' | 'contacts' };

  // Custom drills
  custom_drill_created: { field_type: 'FULL' | 'HALF' };
  custom_drill_edited: { drill_id: string };

  // Paywall & subscription
  paywall_shown: { trigger: string; reason?: string };
  paywall_dismissed: { trigger: string };
  paywall_plan_selected: { plan: 'monthly' | 'annual' };
  purchase_started: { plan: 'monthly' | 'annual' };
  purchase_completed: { plan: 'monthly' | 'annual' };
  purchase_failed: { plan: 'monthly' | 'annual'; error?: string };
  restore_started: {};
  restore_completed: { had_purchase: boolean };

  // Onboarding
  onboarding_started: {};
  onboarding_completed: {};
  onboarding_skipped: { step: number };
  onboarding_reset: {};

  // Settings
  theme_toggled: { theme: 'light' | 'dark' };
  data_cleared: {};
};

// ── Track Function ─────────────────────────────────────────────────

export function track<E extends keyof AnalyticsEvents>(
  event: E,
  properties?: AnalyticsEvents[E],
): void {
  if (__DEV__) {
    console.log(`[Analytics] ${event}`, properties ?? '');
  }

  posthog?.capture(event, properties as Record<string, any>);
}

// ── Screen Tracking ────────────────────────────────────────────────

export function trackScreen(screen: string): void {
  posthog?.screen(screen);
  track('screen_viewed', { screen });
}

// ── User Properties ────────────────────────────────────────────────
// Set once when profile is saved — helps segment users in PostHog

export function setUserProperties(props: {
  tier?: 'free' | 'pro';
  has_profile?: boolean;
  default_age_group?: string;
}): void {
  if (posthog) {
    posthog.identify(undefined, props as Record<string, any>);
  }
}

// ── Shutdown ───────────────────────────────────────────────────────

export async function shutdownAnalytics(): Promise<void> {
  await posthog?.flush();
}
