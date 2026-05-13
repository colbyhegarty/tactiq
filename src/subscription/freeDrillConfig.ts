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
"1v1-battle-attacking-and-reaction-drill",  //# 1v1 Attack and Reaction Exercise
"1v1-attacking-to-a-full-size-goal",  //# 1v1 Attacking Towards Goal
"2v2-with-target-players-to-small-goals",  //# 2v2 Attack with Targets
"2v2-dribbling-to-beat-the-defender",  //# 2v2 Attacking Dribble Challenge
"attacking-from-the-midfield",  //# Midfield Attack Development
"4v2-soccer-game-to-goal",  //# 4v2 Attacking to Goal
"far-post-near-post-2",  //# Far Post, Near Post #2
"defensive-shape-and-press-drill",  //# Defensive Shape and Press Drill
"teaching-1st-defender-without-opposition",  //# 1st Defender Fundamentals
"traffic-jam-dribbling-game",  //# Congested Dribbling Challenge
"figure-eight-dribbling-drill",  //# Figure Eight Ball Control Exercise
"power-and-finesse-with-a-twist",  //# Power and Finesse
"double-pass-shooting",  //# Double Pass Shooting
"3v3-shooting-from-half",  //# 3v3 Shooting from Half
"t-cone-sprint-and-agility-drill",  //# T-Cone Sprint and Agility Drill
"tic-tac-toe-sprints",  //# Tic-Tac-Toe Sprints
"11v7-full-team-positional-possession",  //# 11v7 Full-Team Positional Possession
"half-field-ssg-with-outside-servers",  //# Half-Field SSG with Outside Servers
"soccer-tennis",  //# Soccer Tennis
"goalie-wars",  //# Goalie Wars
"screen-the-keeper",  //# Screen The Keeper
"deflect-and-dive",  //# Deflect and Dive
"combination-play-improving-1-2-combinations",  //# Give-and-Go Combination Play
"passing-warm-up-drill",  //# Passing Preparation Exercise
"4v42-endzone-possession-game",  //# 4v4 Plus 2 End Zone Possession Drill
"3v1-early-support",  //# 3v1 Quick Support Drill
"6v1-overload-add-defenders-drill",  //# 6v1 Keep Away Add Defenders
"1v1-attacking-and-reaction-drill",  //# 1v1 Reaction Exercise
"receiving-the-ball-with-back-to-goal",  //# Receiving with Back to Goal
"1v1-lose-your-man",  //# 1v1, Lose Your Man
"box-shooting-rotation-with-wide-cross",  //# Box Shooting Rotation with Wide Cross
"lane-spacing-and-separation-soccer-game",  //# Lane Spacing Small-Sided Game
"4v4-keeper-to-full-size-goals",  //# 4v4 Plus Goalkeeper to Goals
"4v4-zone-game",  //# 4v4 Zonal Rondo
"3v2-flying-changes",  //# 3v2 Dynamic Transition Drill
"back-to-goal-receiving-and-turn",  //# Back-to-Goal Receiving and Turn
"inside-of-the-foot-passing-warm-up",  //# Inside of the Foot Passing
"across-field-warm-up"  //# Cross-Field Warm-Up Exercise
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
