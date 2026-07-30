import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { AppEventsLogger, Settings } from 'react-native-fbsdk-next';
import Purchases from 'react-native-purchases';
import { initAnalytics } from '../src/lib/analytics';
import { prefetchDrills } from '../src/lib/drillCache';
import { DevSubscriptionToggle } from '../src/subscription/DevSubscriptionToggle';
import { SubscriptionProvider } from '../src/subscription/SubscriptionContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

SplashScreen.preventAutoHideAsync();

// Kick off the drill fetch immediately — before any component mounts.
const MIN_SPLASH_MS = 1500;
const splashStart = Date.now();
const drillPrefetch = prefetchDrills();

async function initMeta() {
  try {
    // Initialize SDK and set initial device identifiers before ATT prompt
    await Settings.initializeSDK();
    await Purchases.collectDeviceIdentifiers();
    const fbAnonId = await AppEventsLogger.getAnonymousID();
    if (fbAnonId) {
      await Purchases.setFBAnonymousID(fbAnonId);
    }

    if (Platform.OS === 'ios') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
      await Settings.setAdvertiserTrackingEnabled(status === 'granted');

      // Collect again after ATT response so IDFA is included if allowed
      await Purchases.collectDeviceIdentifiers();
      const fbAnonIdAfterATT = await AppEventsLogger.getAnonymousID();
      if (fbAnonIdAfterATT) {
        await Purchases.setFBAnonymousID(fbAnonIdAfterATT);
      }
    }
  } catch (e) {
    console.error('[Meta] SDK initialization failed:', e);
  }
}

function RootStack() {
  const { colors } = useTheme();

  useEffect(() => {
    initAnalytics();
    initMeta();

    // Hide splash only after both the minimum duration AND the first drill
    // batch have resolved, so the user never sees the loading spinner.
    const elapsed = Date.now() - splashStart;
    const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

    Promise.all([
      drillPrefetch,
      new Promise(resolve => setTimeout(resolve, remaining)),
    ]).then(() => {
      SplashScreen.hideAsync();
    });
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          sceneStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session-view" />
        <Stack.Screen name="session-editor" />
        <Stack.Screen name="drill-editor" />
      </Stack>
      <DevSubscriptionToggle />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SubscriptionProvider>
        <RootStack />
      </SubscriptionProvider>
    </ThemeProvider>
  );
}
