import * as TrackingTransparency from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// Keep this in one place so Meta attribution always runs after configure.
const REVENUECAT_API_KEY = 'appl_agPpQSTiiyCOlhqYogvPgOwegZw';

let configurePromise: Promise<void> | null = null;

/**
 * Ensure Purchases is configured before any attribution setters.
 * Calling collectDeviceIdentifiers / setFBAnonymousID before configure
 * silently fails and Meta never receives StartTrial/Subscribe.
 */
export function ensurePurchasesConfigured(): Promise<void> {
  if (!configurePromise) {
    configurePromise = (async () => {
      if (__DEV__) {
        Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      }
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    })();
  }
  return configurePromise;
}

function mapAttStatus(
  status: string,
): 'authorized' | 'denied' | 'restricted' | 'notDetermined' {
  switch (status) {
    case 'granted':
      return 'authorized';
    case 'denied':
      return 'denied';
    case 'restricted':
      return 'restricted';
    default:
      return 'notDetermined';
  }
}

/** Push Meta/device IDs into the current RevenueCat customer. */
export async function syncMetaAttributionToRevenueCat(
  attStatus?: 'authorized' | 'denied' | 'restricted' | 'notDetermined',
): Promise<void> {
  await ensurePurchasesConfigured();

  await Purchases.collectDeviceIdentifiers();

  const fbAnonId = await AppEventsLogger.getAnonymousID();
  if (fbAnonId) {
    await Purchases.setFBAnonymousID(fbAnonId);
    if (__DEV__) console.log('[Meta] setFBAnonymousID', fbAnonId);
  } else if (__DEV__) {
    console.warn('[Meta] AppEventsLogger.getAnonymousID() returned empty');
  }

  if (attStatus) {
    await Purchases.setAttributes({
      $attConsentStatus: attStatus,
    });
  }
}

/**
 * Initialize Meta SDK, request ATT on iOS, and sync IDs to RevenueCat.
 * Safe to call once on app launch after root mount.
 */
export async function initMetaAttribution(): Promise<void> {
  try {
    // Configure RC first — this was the bug: IDs were set before configure.
    await ensurePurchasesConfigured();

    await Settings.initializeSDK();
    await syncMetaAttributionToRevenueCat();

    if (Platform.OS === 'ios') {
      // Small delay helps ATT prompt appear after splash/first frame.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
      await Settings.setAdvertiserTrackingEnabled(status === 'granted');

      const attConsent = mapAttStatus(status);
      await syncMetaAttributionToRevenueCat(attConsent);
    }
  } catch (e) {
    console.error('[Meta] SDK initialization failed:', e);
  }
}
