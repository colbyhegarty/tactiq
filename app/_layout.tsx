import { Stack } from 'expo-router';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

function RootStack() {
  const { colors } = useTheme();
  return (
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
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}
