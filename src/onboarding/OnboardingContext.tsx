import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { track } from '../lib/analytics';

// ── Types ─────────────────────────────────────────────────────────
export type OnboardingGoal =
  | 'build_practice'   // "Build a practice plan"
  | 'find_drills'      // "Find the right drill"
  | 'create_drill'     // "Create my own drill"
  | 'explore';         // "Just explore"

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  selectedGoal: OnboardingGoal | null;
  completedAt: string | null;
  /** Whether the post-onboarding guide card has been dismissed */
  guideDismissed: boolean;
}

interface OnboardingContextType {
  /** Whether the state has been loaded from storage */
  isLoaded: boolean;
  /** Whether onboarding has been completed */
  hasCompletedOnboarding: boolean;
  /** The goal selected during onboarding */
  selectedGoal: OnboardingGoal | null;
  /** Whether the post-onboarding guide card should be shown */
  showGuide: boolean;
  /** Complete onboarding with a selected goal */
  completeOnboarding: (goal: OnboardingGoal) => void;
  /** Dismiss the post-onboarding guide card */
  dismissGuide: () => void;
  /** Reset onboarding (for dev/testing) */
  resetOnboarding: () => void;
}

// ── Storage ───────────────────────────────────────────────────────
const ONBOARDING_KEY = 'tactiq_onboarding_state';

const defaultState: OnboardingState = {
  hasCompletedOnboarding: false,
  selectedGoal: null,
  completedAt: null,
  guideDismissed: false,
};

// ── Context ───────────────────────────────────────────────────────
const OnboardingContext = createContext<OnboardingContextType>({
  isLoaded: false,
  hasCompletedOnboarding: false,
  selectedGoal: null,
  showGuide: false,
  completeOnboarding: () => {},
  dismissGuide: () => {},
  resetOnboarding: () => {},
});

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<OnboardingState>(defaultState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((stored) => {
        if (stored) {
          try {
            setState({ ...defaultState, ...JSON.parse(stored) });
          } catch {}
        }
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const persist = useCallback((next: OnboardingState) => {
    setState(next);
    AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(next));
  }, []);

  const completeOnboarding = useCallback(
    (goal: OnboardingGoal) => {
      track('onboarding_goal_selected', { goal });
      track('onboarding_completed', {});
      persist({
        hasCompletedOnboarding: true,
        selectedGoal: goal,
        completedAt: new Date().toISOString(),
      });
    },
    [persist],
  );

  const dismissGuide = useCallback(() => {
    track('onboarding_guide_dismissed', { goal: state.selectedGoal });
    persist({ ...state, guideDismissed: true });
  }, [persist, state]);

  const resetOnboarding = useCallback(() => {
    track('onboarding_reset', {});
    persist(defaultState);
  }, [persist]);

  return (
    <OnboardingContext.Provider
      value={{
        isLoaded,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        selectedGoal: state.selectedGoal,
        showGuide: state.hasCompletedOnboarding && !state.guideDismissed && state.selectedGoal !== 'explore',
        completeOnboarding,
        dismissGuide,
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
