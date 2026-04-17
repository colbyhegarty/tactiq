import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'tactiq_onboarding';

export type OnboardingScreen =
  | 'welcome'
  | 'tab_library'
  | 'tab_create'
  | 'tab_sessions'
  | 'tab_profile';

interface OnboardingState {
  completedScreens: OnboardingScreen[];
  onboardingDismissed: boolean;
}

const DEFAULT_STATE: OnboardingState = {
  completedScreens: [],
  onboardingDismissed: false,
};

interface OnboardingContextType {
  /** Whether the onboarding data has loaded from storage */
  loaded: boolean;
  /** Check if a specific screen's onboarding has been completed */
  hasCompleted: (screen: OnboardingScreen) => boolean;
  /** Mark a screen's onboarding as completed */
  markCompleted: (screen: OnboardingScreen) => void;
  /** Skip/dismiss all onboarding entirely */
  dismissAll: () => void;
  /** Whether the user dismissed all onboarding */
  isDismissed: boolean;
  /** Reset all onboarding (for testing/settings) */
  resetOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextType>({
  loaded: false,
  hasCompleted: () => true,
  markCompleted: () => {},
  dismissAll: () => {},
  isDismissed: false,
  resetOnboarding: () => {},
});

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(DEFAULT_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((stored) => {
      if (stored) {
        try {
          setState(JSON.parse(stored));
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const persist = useCallback((newState: OnboardingState) => {
    setState(newState);
    AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(newState));
  }, []);

  const hasCompleted = useCallback(
    (screen: OnboardingScreen) => {
      return state.onboardingDismissed || state.completedScreens.includes(screen);
    },
    [state],
  );

  const markCompleted = useCallback(
    (screen: OnboardingScreen) => {
      if (state.completedScreens.includes(screen)) return;
      persist({
        ...state,
        completedScreens: [...state.completedScreens, screen],
      });
    },
    [state, persist],
  );

  const dismissAll = useCallback(() => {
    persist({ ...state, onboardingDismissed: true });
  }, [state, persist]);

  const resetOnboarding = useCallback(() => {
    persist(DEFAULT_STATE);
  }, [persist]);

  return (
    <OnboardingContext.Provider
      value={{
        loaded,
        hasCompleted,
        markCompleted,
        dismissAll,
        isDismissed: state.onboardingDismissed,
        resetOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext);
}
