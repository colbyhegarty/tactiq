import AsyncStorage from '@react-native-async-storage/async-storage';
import { Drill, UserProfile, AgeGroup, SkillLevel } from '../types/drill';

const SAVED_DRILLS_KEY = 'drillforge_saved_drills';
const USER_PROFILE_KEY = 'drillforge_user_profile';

export const defaultProfile: UserProfile = {
  name: '',
  email: '',
  teamName: '',
  defaultAgeGroup: 'Not Specified',
  defaultSkillLevel: 'Not Specified',
  defaultPlayerCount: 12,
};

// ── Saved Drills ────────────────────────────────────────────────────

export async function getSavedDrills(): Promise<Drill[]> {
  try {
    const stored = await AsyncStorage.getItem(SAVED_DRILLS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function saveDrill(drill: Drill): Promise<void> {
  const drills = await getSavedDrills();
  const existingIndex = drills.findIndex((d) => d.id === drill.id);

  if (existingIndex >= 0) {
    drills[existingIndex] = { ...drill, savedAt: new Date().toISOString() };
  } else {
    drills.push({ ...drill, savedAt: new Date().toISOString() });
  }

  await AsyncStorage.setItem(SAVED_DRILLS_KEY, JSON.stringify(drills));
}

export async function removeDrill(drillId: string): Promise<void> {
  const drills = await getSavedDrills();
  const filtered = drills.filter((d) => d.id !== drillId);
  await AsyncStorage.setItem(SAVED_DRILLS_KEY, JSON.stringify(filtered));
}

export async function isDrillSaved(drillId: string): Promise<boolean> {
  const drills = await getSavedDrills();
  return drills.some((d) => d.id === drillId);
}

// ── User Profile ────────────────────────────────────────────────────

export async function getUserProfile(): Promise<UserProfile> {
  try {
    const stored = await AsyncStorage.getItem(USER_PROFILE_KEY);
    return stored ? { ...defaultProfile, ...JSON.parse(stored) } : defaultProfile;
  } catch {
    return defaultProfile;
  }
}

export async function saveUserProfile(profile: Partial<UserProfile>): Promise<void> {
  const current = await getUserProfile();
  const updated = { ...current, ...profile };
  await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(updated));
}

// ── Clear All ───────────────────────────────────────────────────────

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([SAVED_DRILLS_KEY, USER_PROFILE_KEY]);
}
