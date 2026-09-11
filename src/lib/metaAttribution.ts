import * as TrackingTransparency from 'expo-tracking-transparency';
import { AppState, Platform } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

// Keep this in one place so Meta attribution always runs after configure.
const REVENUECAT_API_KEY = 'appl_agPpQSTiiyCOlhqYogvPgOwegZw';

// Safety valve: if the user never answers the ATT prompt we still want the
// install event to reach Meta (with ATE=false) rather than losing it entirely.
const ATT_PROMPT_TIMEOUT_MS = 30_000;

let configurePromise: Promise<void> | null = null;
let metaInitPromise: Promise<void> | null = null;

type AttStatus = 'authorized' | 'denied' | 'restricted' | 'notDetermined';

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

function mapAttStatus(status: string): AttStatus {
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
  attStatus?: AttStatus,
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
 * iOS will silently return `undetermined` if the ATT prompt is requested while
 * the app is not in the `active` state (e.g. still behind the splash screen or
 * launched into the background). Wait for `active` before prompting.
 */
function waitForActiveAppState(timeoutMs = 10_000): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.remove();
      resolve();
    };

    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') finish();
    });
    const timer = setTimeout(finish, timeoutMs);
  });
}

/**
 * Resolve the ATT status, prompting only if it has never been determined.
 * Returns the raw expo-tracking-transparency status string.
 */
async function resolveTrackingStatus(): Promise<string> {
  const current = await TrackingTransparency.getTrackingPermissionsAsync();

  // Already answered (or restricted by policy) — no prompt, no delay.
  if (current.status !== 'undetermined') {
    return current.status;
  }

  await waitForActiveAppState();

  const timeout = new Promise<string>((resolve) =>
    setTimeout(() => resolve('undetermined'), ATT_PROMPT_TIMEOUT_MS),
  );

  const prompt = TrackingTransparency.requestTrackingPermissionsAsync().then(
    ({ status }) => status,
  );

  return Promise.race([prompt, timeout]);
}

/**
 * Initialize Meta SDK and sync IDs to RevenueCat.
 *
 * ORDERING IS LOAD-BEARING. On iOS 14+ the Meta SDK logs
 * fb_mobile_first_app_launch / fb_mobile_activate_app the moment
 * Settings.initializeSDK() runs (autoLogAppEventsEnabled is true in app.json).
 * FBSDKSettings.isAdvertiserTrackingEnabled defaults to FALSE, so initializing
 * before ATT resolves ships every install event with ATE=false — Meta receives
 * and processes them but cannot attribute them, which is why Events Manager
 * shows "No Rate Displayed" for ATE True Status Rate and Ads Manager reports
 * 0 attributed installs.
 *
 * So: resolve ATT -> setAdvertiserTrackingEnabled -> initializeSDK -> log/sync.
 *
 * Idempotent; safe to call on every mount.
 */
export function initMetaAttribution(): Promise<void> {
  if (metaInitPromise) return metaInitPromise;

  metaInitPromise = (async () => {
    try {
      // Configure RC first — this was a prior bug: IDs were set before configure.
      await ensurePurchasesConfigured();

      let attConsent: AttStatus = 'notDetermined';

      if (Platform.OS === 'ios') {
        const status = await resolveTrackingStatus();
        attConsent = mapAttStatus(status);

        const granted = status === 'granted';

        // MUST happen before initializeSDK() so the install/activate event
        // carries the correct advertiser-tracking state. Only ever true for
        // users who explicitly authorized ATT.
        await Settings.setAdvertiserTrackingEnabled(granted);
        Settings.setAdvertiserIDCollectionEnabled(granted);

        if (__DEV__) {
          console.log('[Meta] ATT status:', status, '-> ATE:', granted);
        }
      }

      // Now it is safe to initialize: the first app event will be tagged with
      // the resolved advertiser-tracking state.
      Settings.initializeSDK();

      if (Platform.OS === 'ios' && __DEV__) {
        // Read back from the native SDK to prove what was actually applied.
        const applied = await Settings.getAdvertiserTrackingEnabled();
        console.log('[Meta] SDK advertiserTrackingEnabled (verified):', applied);
      }

      await syncMetaAttributionToRevenueCat(
        Platform.OS === 'ios' ? attConsent : undefined,
      );
    } catch (e) {
      console.error('[Meta] SDK initialization failed:', e);
      // Allow a later retry rather than wedging attribution for the session.
      metaInitPromise = null;
    }
  })();

  return metaInitPromise;
}
