import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { SubscriptionProvider } from '../src/subscription/SubscriptionContext';
import { DevSubscriptionToggle } from '../src/subscription/DevSubscriptionToggle';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors } = useTheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session-view" />
        <Stack.Screen name="session-editor" />
        <Stack.Screen name="drill-editor" />
      </Stack>
      {/* Floating dev toggle — only visible in __DEV__ builds */}
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