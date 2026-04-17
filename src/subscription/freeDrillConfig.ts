// ══════════════════════════════════════════════════════════════════
// FREE DRILL ACCESS CONFIG
// ══════════════════════════════════════════════════════════════════
//
// This file controls which drills are available to free-tier users.
// All other drills will appear in the library with a blurred diagram
// and a lock overlay. Tapping a locked drill shows the paywall.
//
// HOW TO UPDATE:
// 1. Add or remove drill IDs in the FREE_DRILL_IDS set below.
// 2. That's it — the app reads this at runtime.
//
// You can find drill IDs in your Supabase dashboard or by inspecting
// the drill detail response in the app's console logs.
//
// TIP: Choose a diverse mix across categories so free users get a
// taste of everything — passing, shooting, possession, warm-up, etc.
// ══════════════════════════════════════════════════════════════════

/**
 * Set of drill IDs that free users can fully access.
 * All drills NOT in this set will be locked (blurred + lock icon).
 *
 * When you add drills to your Supabase library, grab the IDs and
 * add them here to make them available to free users.
 */
export const FREE_DRILL_IDS: Set<string> = new Set([
  // ── Warm-up / Cool-down ──────────────────────────────────────
  // Add your warm-up drill IDs here, e.g.:
  // 'abc123-warmup-rondo',
  // 'def456-dynamic-stretching',

  // ── Passing & Possession ─────────────────────────────────────
  // 'ghi789-triangle-passing',

  // ── Finishing ────────────────────────────────────────────────
  // 'jkl012-basic-shooting',

  // ── Small-Sided Games ───────────────────────────────────────
  // 'mno345-4v4-possession',

  // ── Technical Skills ────────────────────────────────────────
  // 'pqr678-ball-mastery',
]);

/**
 * Check if a drill is available to free users.
 *
 * If FREE_DRILL_IDS is empty, ALL drills are locked for free users
 * (except the app still shows them blurred in the library).
 *
 * If you want all drills unlocked during development, set this
 * to always return true (or use the dev toggle).
 */
export function isDrillFree(drillId: string): boolean {
  // During early development with no IDs populated yet,
  // you may want to uncomment this line to unlock everything:
  // return true;

  return FREE_DRILL_IDS.has(drillId);
}

/**
 * Returns the number of free drills configured.
 * Useful for marketing copy: "X free drills included!"
 */
export function getFreeDrillCount(): number {
  return FREE_DRILL_IDS.size;
}
