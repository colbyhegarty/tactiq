import { useRouter } from 'expo-router';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { initAnalytics } from '../src/lib/analytics';
import { prefetchDrills } from '../src/lib/drillCache';
import { initMetaAttribution } from '../src/lib/metaAttribution';
import { OnboardingFlow, OnboardingProvider, useOnboarding } from '../src/onboarding';
import { DevSubscriptionToggle } from '../src/subscription/DevSubscriptionToggle';
import { SubscriptionProvider } from '../src/subscription/SubscriptionContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

SplashScreen.preventAutoHideAsync();

// Kick off the drill fetch immediately — before any component mounts.
const MIN_SPLASH_MS = 1500;
const splashStart = Date.now();
const drillPrefetch = prefetchDrills();

function RootStack() {
  const { colors } = useTheme();
  const { isLoaded: onboardingLoaded, hasCompletedOnboarding, selectedGoal } = useOnboarding();
  const router = useRouter();

  useEffect(() => {
    initAnalytics();
    // Must configure Purchases before setting Meta/device IDs (handled inside).
    initMetaAttribution();

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

  // After onboarding completes, navigate to the right tab based on goal
  useEffect(() => {
    if (!onboardingLoaded || !hasCompletedOnboarding || !selectedGoal) return;

    // Small delay to let the modal dismiss
    const timer = setTimeout(() => {
      switch (selectedGoal) {
        case 'build_practice':
          router.replace('/sessions');
          break;
        case 'find_drills':
          router.replace('/');
          break;
        case 'create_drill':
          router.replace('/create');
          break;
        case 'explore':
        default:
          // Stay on default tab (Library)
          break;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [onboardingLoaded, hasCompletedOnboarding, selectedGoal]);

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

      {/* Onboarding — shown on first launch */}
      {onboardingLoaded && (
        <OnboardingFlow visible={!hasCompletedOnboarding} />
      )}

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
