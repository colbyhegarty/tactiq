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
  /** Whether the post-onboarding guided flow has been completed */
  guideCompleted: boolean;
  /** Current step in the guided flow (0-based) */
  guideStep: number;
}

interface OnboardingContextType {
  /** Whether the state has been loaded from storage */
  isLoaded: boolean;
  /** Whether onboarding has been completed */
  hasCompletedOnboarding: boolean;
  /** The goal selected during onboarding */
  selectedGoal: OnboardingGoal | null;
  /** Whether the guided flow should be shown */
  showGuide: boolean;
  /** Current step in the guided flow */
  guideStep: number;
  /** Complete onboarding with a selected goal */
  completeOnboarding: (goal: OnboardingGoal) => void;
  /** Advance to the next step in the guided flow */
  advanceGuide: () => void;
  /** Complete (finish) the guided flow */
  completeGuide: () => void;
  /** Reset onboarding (for dev/testing — storage only, requires restart) */
  resetOnboarding: () => void;
}

// ── Storage ───────────────────────────────────────────────────────
const ONBOARDING_KEY = 'tactiq_onboarding_state';

const defaultState: OnboardingState = {
  hasCompletedOnboarding: false,
  selectedGoal: null,
  completedAt: null,
  guideCompleted: false,
  guideStep: 0,
};

// ── Context ───────────────────────────────────────────────────────
const OnboardingContext = createContext<OnboardingContextType>({
  isLoaded: false,
  hasCompletedOnboarding: false,
  selectedGoal: null,
  showGuide: false,
  guideStep: 0,
  completeOnboarding: () => {},
  advanceGuide: () => {},
  completeGuide: () => {},
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
        guideCompleted: false,
        guideStep: 0,
      });
    },
    [persist],
  );

  const advanceGuide = useCallback(() => {
    const nextStep = state.guideStep + 1;
    persist({ ...state, guideStep: nextStep });
  }, [persist, state]);

  const completeGuide = useCallback(() => {
    track('onboarding_guide_dismissed', { goal: state.selectedGoal });
    persist({ ...state, guideCompleted: true });
  }, [persist, state]);

  const resetOnboarding = useCallback(() => {
    track('onboarding_reset', {});
    // Only clear storage — don't update in-memory state to avoid
    // re-rendering the OnboardingFlow while modals are open (causes freeze).
    // Requires app restart to take effect.
    AsyncStorage.removeItem(ONBOARDING_KEY);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        isLoaded,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        selectedGoal: state.selectedGoal,
        showGuide: state.hasCompletedOnboarding && !state.guideCompleted && state.selectedGoal !== 'explore',
        guideStep: state.guideStep,
        completeOnboarding,
        advanceGuide,
        completeGuide,
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
