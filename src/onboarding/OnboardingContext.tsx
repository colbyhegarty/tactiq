import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { track } from '../lib/analytics';

// ── Types ─────────────────────────────────────────────────────────
export type OnboardingGoal =
  | 'build_practice'   // "Build a practice plan"
  | 'find_drills'      // "Find the right drill"
  | 'create_drill'     // "Create my own drill"
  | 'explore';         // "Explore on my own"

export type GuideStatus = 'active' | 'suspended' | 'completed';

/** Per-feature first-use flags — prevents showing first-use hints
 *  for functionality the user already learned during onboarding. */
export interface SeenFeatures {
  sessions: boolean;
  drillLibrary: boolean;
  drillDetail: boolean;
  createDrill: boolean;
  addToSession: boolean;
}

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  selectedGoal: OnboardingGoal | null;
  completedAt: string | null;

  // Guided flow
  guideStatus: GuideStatus;
  guideStep: number;

  // Build Practice: which session is being built
  onboardingSessionId: string | null;

  // Timestamp when user dismissed a coach mark with X
  guideDismissedAt: string | null;

  // Per-feature discovery flags
  seenFeatures: SeenFeatures;

  // Pro preview extension for active Build Practice
  proPreviewExtended: boolean;

  // Version tag for analytics
  activationVersion: number;
}

interface OnboardingContextType {
  /** Whether the state has been loaded from storage */
  isLoaded: boolean;
  /** Whether onboarding goal selection is done */
  hasCompletedOnboarding: boolean;
  /** The goal selected during onboarding */
  selectedGoal: OnboardingGoal | null;

  /** Current guide status: active, suspended, or completed */
  guideStatus: GuideStatus;
  /** Current step in the guided flow */
  guideStep: number;
  /** Whether the guided flow should show coach marks right now */
  showGuide: boolean;

  /** The session being built during Build Practice onboarding */
  onboardingSessionId: string | null;
  /** Per-feature first-use flags */
  seenFeatures: SeenFeatures;
  /** Whether Pro preview limit is bypassed (active Build Practice) */
  proPreviewExtended: boolean;

  /** Complete onboarding goal selection */
  completeOnboarding: (goal: OnboardingGoal) => void;
  /** Advance to the next step in the guided flow */
  advanceGuide: () => void;
  /** Complete (finish) the guided flow — activation event reached */
  completeGuide: () => void;
  /** Suspend the guide (user deviated from the flow) */
  suspendGuide: (reason?: string) => void;
  /** Resume the guide from suspended state */
  resumeGuide: () => void;
  /** Dismiss the current coach mark (X tapped) — suspends guide */
  dismissCoachMark: () => void;

  /** Set the session being built during Build Practice */
  setOnboardingSessionId: (sessionId: string | null) => void;
  /** Mark a feature as seen (for first-use hint suppression) */
  markFeatureSeen: (feature: keyof SeenFeatures) => void;
  /** Mark multiple features as seen at once */
  markFeaturesSeen: (features: (keyof SeenFeatures)[]) => void;

  /** Reset onboarding (for dev/testing — storage only, requires restart) */
  resetOnboarding: () => void;
}

// ── Storage ───────────────────────────────────────────────────────
const ONBOARDING_KEY = 'tactiq_onboarding_state';
const ACTIVATION_VERSION = 2; // Bump when changing onboarding flows

const defaultSeenFeatures: SeenFeatures = {
  sessions: false,
  drillLibrary: false,
  drillDetail: false,
  createDrill: false,
  addToSession: false,
};

const defaultState: OnboardingState = {
  hasCompletedOnboarding: false,
  selectedGoal: null,
  completedAt: null,
  guideStatus: 'active',
  guideStep: 0,
  onboardingSessionId: null,
  guideDismissedAt: null,
  seenFeatures: { ...defaultSeenFeatures },
  proPreviewExtended: false,
  activationVersion: ACTIVATION_VERSION,
};

// ── Context ───────────────────────────────────────────────────────
const OnboardingContext = createContext<OnboardingContextType>({
  isLoaded: false,
  hasCompletedOnboarding: false,
  selectedGoal: null,
  guideStatus: 'active',
  guideStep: 0,
  showGuide: false,
  onboardingSessionId: null,
  seenFeatures: { ...defaultSeenFeatures },
  proPreviewExtended: false,
  completeOnboarding: () => {},
  advanceGuide: () => {},
  completeGuide: () => {},
  suspendGuide: () => {},
  resumeGuide: () => {},
  dismissCoachMark: () => {},
  setOnboardingSessionId: () => {},
  markFeatureSeen: () => {},
  markFeaturesSeen: () => {},
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
            const parsed = JSON.parse(stored);
            // Migrate from v1 (old shape) if needed
            const migrated = migrateState(parsed);
            setState(migrated);
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

      const isExplore = goal === 'explore';
      persist({
        ...defaultState,
        hasCompletedOnboarding: true,
        selectedGoal: goal,
        completedAt: new Date().toISOString(),
        guideStatus: isExplore ? 'completed' : 'active',
        guideStep: 0,
        // Explore users still get pro preview but no guided flow
        proPreviewExtended: goal === 'build_practice',
        activationVersion: ACTIVATION_VERSION,
      });
    },
    [persist],
  );

  const advanceGuide = useCallback(() => {
    const nextStep = state.guideStep + 1;
    track('onboarding_guide_step', {
      goal: state.selectedGoal,
      step: nextStep,
    } as any);
    persist({ ...state, guideStep: nextStep, guideStatus: 'active' });
  }, [persist, state]);

  const completeGuide = useCallback(() => {
    const seenUpdates = getSeenFeaturesForGoal(state.selectedGoal);
    track('onboarding_guide_completed', {
      goal: state.selectedGoal,
      activation_version: ACTIVATION_VERSION,
    } as any);
    persist({
      ...state,
      guideStatus: 'completed',
      proPreviewExtended: false,
      seenFeatures: { ...state.seenFeatures, ...seenUpdates },
    });
  }, [persist, state]);

  const suspendGuide = useCallback((reason?: string) => {
    if (state.guideStatus !== 'active') return;
    track('onboarding_guide_suspended', {
      goal: state.selectedGoal,
      step: state.guideStep,
      reason: reason || 'navigation',
    } as any);
    persist({ ...state, guideStatus: 'suspended' });
  }, [persist, state]);

  const resumeGuide = useCallback(() => {
    if (state.guideStatus !== 'suspended') return;
    persist({ ...state, guideStatus: 'active' });
  }, [persist, state]);

  const dismissCoachMark = useCallback(() => {
    track('onboarding_guide_dismissed', {
      goal: state.selectedGoal,
      step: state.guideStep,
    } as any);
    persist({
      ...state,
      guideStatus: 'suspended',
      guideDismissedAt: new Date().toISOString(),
    });
  }, [persist, state]);

  const setOnboardingSessionId = useCallback((sessionId: string | null) => {
    persist({ ...state, onboardingSessionId: sessionId });
  }, [persist, state]);

  const markFeatureSeen = useCallback((feature: keyof SeenFeatures) => {
    if (state.seenFeatures[feature]) return; // already seen
    persist({
      ...state,
      seenFeatures: { ...state.seenFeatures, [feature]: true },
    });
  }, [persist, state]);

  const markFeaturesSeen = useCallback((features: (keyof SeenFeatures)[]) => {
    const updates: Partial<SeenFeatures> = {};
    let changed = false;
    for (const f of features) {
      if (!state.seenFeatures[f]) {
        updates[f] = true;
        changed = true;
      }
    }
    if (!changed) return;
    persist({
      ...state,
      seenFeatures: { ...state.seenFeatures, ...updates },
    });
  }, [persist, state]);

  const resetOnboarding = useCallback(() => {
    track('onboarding_reset', {});
    // Only clear storage — don't update in-memory state to avoid
    // re-rendering the OnboardingFlow while modals are open (causes freeze).
    // Requires app restart to take effect.
    AsyncStorage.removeItem(ONBOARDING_KEY);
  }, []);

  const showGuide = useMemo(() => {
    return (
      state.hasCompletedOnboarding &&
      state.guideStatus === 'active' &&
      state.selectedGoal !== 'explore'
    );
  }, [state.hasCompletedOnboarding, state.guideStatus, state.selectedGoal]);

  return (
    <OnboardingContext.Provider
      value={{
        isLoaded,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        selectedGoal: state.selectedGoal,
        guideStatus: state.guideStatus,
        guideStep: state.guideStep,
        showGuide,
        onboardingSessionId: state.onboardingSessionId,
        seenFeatures: state.seenFeatures,
        proPreviewExtended: state.proPreviewExtended,
        completeOnboarding,
        advanceGuide,
        completeGuide,
        suspendGuide,
        resumeGuide,
        dismissCoachMark,
        setOnboardingSessionId,
        markFeatureSeen,
        markFeaturesSeen,
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

// ── Helpers ────────────────────────────────────────────────────────

/** Returns which features are covered by completing a given onboarding goal */
function getSeenFeaturesForGoal(goal: OnboardingGoal | null): Partial<SeenFeatures> {
  switch (goal) {
    case 'build_practice':
      return {
        sessions: true,
        drillLibrary: true,
        drillDetail: true,
        addToSession: true,
      };
    case 'find_drills':
      return {
        drillLibrary: true,
        drillDetail: true,
      };
    case 'create_drill':
      return {
        createDrill: true,
      };
    default:
      return {};
  }
}

/** Migrate from v1 state shape (guideCompleted boolean) to v2 */
function migrateState(parsed: any): OnboardingState {
  // Already v2+
  if (parsed.guideStatus) {
    return {
      ...defaultState,
      ...parsed,
      seenFeatures: { ...defaultSeenFeatures, ...parsed.seenFeatures },
    };
  }

  // v1 migration: guideCompleted → guideStatus
  const guideCompleted = parsed.guideCompleted ?? false;
  return {
    ...defaultState,
    hasCompletedOnboarding: parsed.hasCompletedOnboarding ?? false,
    selectedGoal: parsed.selectedGoal ?? null,
    completedAt: parsed.completedAt ?? null,
    guideStatus: guideCompleted ? 'completed' : (parsed.hasCompletedOnboarding ? 'active' : 'active'),
    guideStep: parsed.guideStep ?? 0,
    seenFeatures: { ...defaultSeenFeatures },
    proPreviewExtended: false,
    activationVersion: ACTIVATION_VERSION,
  };
}
