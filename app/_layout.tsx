import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { SubscriptionProvider } from '../src/subscription/SubscriptionContext';
import { DevSubscriptionToggle } from '../src/subscription/DevSubscriptionToggle';
import { OnboardingProvider } from '../src/onboarding/OnboardingContext';
import { WelcomeModal } from '../src/onboarding/components/WelcomeModal';
import { initAnalytics } from '../src/lib/analytics';
import { prefetchDrills } from '../src/lib/drillCache';

SplashScreen.preventAutoHideAsync();

// Kick off the drill fetch immediately — before any component mounts.
const MIN_SPLASH_MS = 1500;
const splashStart = Date.now();
const drillPrefetch = prefetchDrills();

function RootStack() {
  const { colors } = useTheme();

  useEffect(() => {
    initAnalytics();

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
      <WelcomeModal />
      <DevSubscriptionToggle />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SubscriptionProvider>
        <OnboardingProvider>
          <RootStack />
        </OnboardingProvider>
      </SubscriptionProvider>
    </ThemeProvider>
  );
}
