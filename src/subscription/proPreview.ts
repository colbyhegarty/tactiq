// ══════════════════════════════════════════════════════════════════
// PRO DRILL PREVIEW SYSTEM
// ══════════════════════════════════════════════════════════════════
//
// Gives new free users a taste of Pro drills before they hit the
// paywall. After MAX_PREVIEW_VIEWS unique Pro drill views, the
// preview expires and all Pro drills lock as normal.
//
// State is persisted in AsyncStorage so it survives app restarts.
// ══════════════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { track } from '../lib/analytics';

// ── Config ────────────────────────────────────────────────────────
/** Number of unique Pro drills a free user can preview before lock */
export const MAX_PREVIEW_VIEWS = 5;

// ── Storage ───────────────────────────────────────────────────────
const PREVIEW_KEY = 'tactiq_pro_preview';

export interface ProPreviewState {
  /** IDs of Pro drills the user has previewed */
  viewedDrillIds: string[];
  /** Whether the preview period has been exhausted (they used all views) */
  exhausted: boolean;
  /** ISO timestamp of the first preview */
  firstPreviewAt: string | null;
}

const defaultPreviewState: ProPreviewState = {
  viewedDrillIds: [],
  exhausted: false,
  firstPreviewAt: null,
};

// ── Functions ─────────────────────────────────────────────────────

/** Load the current preview state from storage */
export async function getPreviewState(): Promise<ProPreviewState> {
  try {
    const stored = await AsyncStorage.getItem(PREVIEW_KEY);
    if (stored) {
      return { ...defaultPreviewState, ...JSON.parse(stored) };
    }
  } catch {}
  return { ...defaultPreviewState };
}

/** Persist the preview state */
async function savePreviewState(state: ProPreviewState): Promise<void> {
  await AsyncStorage.setItem(PREVIEW_KEY, JSON.stringify(state));
}

/**
 * Check if a specific Pro drill can be previewed right now.
 * Returns true if:
 * - The preview is not exhausted AND
 * - Either the drill was already viewed (re-view) OR there's quota left
 */
export async function canPreviewDrill(drillId: string): Promise<boolean> {
  const state = await getPreviewState();
  if (state.exhausted) return false;

  // Already viewed this drill — re-view is free
  if (state.viewedDrillIds.includes(drillId)) return true;

  // New drill — check if there's quota
  return state.viewedDrillIds.length < MAX_PREVIEW_VIEWS;
}

/**
 * Consume a preview view for a Pro drill.
 * Returns the updated state with remaining count.
 * If this was the last view, marks the preview as exhausted.
 */
export async function consumePreviewView(drillId: string): Promise<{
  remaining: number;
  justExhausted: boolean;
  state: ProPreviewState;
}> {
  const state = await getPreviewState();

  // Already viewed — don't count again
  if (state.viewedDrillIds.includes(drillId)) {
    return {
      remaining: MAX_PREVIEW_VIEWS - state.viewedDrillIds.length,
      justExhausted: false,
      state,
    };
  }

  // First preview ever
  if (!state.firstPreviewAt) {
    state.firstPreviewAt = new Date().toISOString();
    track('pro_drill_preview_started', {});
  }

  // Add the drill
  state.viewedDrillIds.push(drillId);

  const remaining = MAX_PREVIEW_VIEWS - state.viewedDrillIds.length;
  const justExhausted = remaining <= 0;

  if (justExhausted) {
    state.exhausted = true;
    track('pro_drill_preview_exhausted', {
      total_previewed: state.viewedDrillIds.length,
    });
  }

  track('pro_drill_preview_viewed', {
    drill_id: drillId,
    preview_number: state.viewedDrillIds.length,
    remaining,
  });

  await savePreviewState(state);

  return { remaining, justExhausted, state };
}

/**
 * Check if the preview is still available (not exhausted).
 * Synchronous-friendly version that takes pre-loaded state.
 */
export function isPreviewAvailable(state: ProPreviewState): boolean {
  return !state.exhausted && state.viewedDrillIds.length < MAX_PREVIEW_VIEWS;
}

/**
 * Get remaining preview count from pre-loaded state.
 */
export function getPreviewRemaining(state: ProPreviewState): number {
  return Math.max(0, MAX_PREVIEW_VIEWS - state.viewedDrillIds.length);
}

/**
 * Reset preview state (for dev/testing).
 */
export async function resetPreviewState(): Promise<void> {
  await AsyncStorage.removeItem(PREVIEW_KEY);
}
