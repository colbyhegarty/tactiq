import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as TrackingTransparency from 'expo-tracking-transparency';
import { useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import { Settings } from 'react-native-fbsdk-next';
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
    if (Platform.OS === 'ios') {
      // Wait a moment after launch
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert("Meta Debug", "About to request ATT permission");

      const result =
        await TrackingTransparency.requestTrackingPermissionsAsync();

      Alert.alert(
        "ATT Result",
        JSON.stringify(result, null, 2)
      );

      Settings.initializeSDK();

      await Settings.setAdvertiserTrackingEnabled(
        result.status === 'granted'
      );

      Alert.alert(
        "Meta Debug",
        `SDK initialized\nTracking: ${result.status === 'granted'}`
      );
    } else {
      Settings.initializeSDK();
    }
  } catch (e: any) {
    Alert.alert(
      "Meta Error",
      e?.message ?? JSON.stringify(e)
    );
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
