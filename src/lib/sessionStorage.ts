import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '../types/session';

const SESSIONS_KEY = 'drillforge_sessions';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateActivityId(): string {
  return generateId();
}

export async function getSessions(): Promise<Session[]> {
  try {
    const stored = await AsyncStorage.getItem(SESSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function getSession(id: string): Promise<Session | null> {
  const sessions = await getSessions();
  return sessions.find((s) => s.id === id) || null;
}

export async function saveSession(
  session: Omit<Session, 'id' | 'created_at' | 'updated_at'>,
): Promise<Session> {
  const sessions = await getSessions();
  const now = new Date().toISOString();
  const newSession: Session = {
    ...session,
    id: generateId(),
    created_at: now,
    updated_at: now,
  };
  sessions.push(newSession);
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  return newSession;
}

export async function updateSession(
  id: string,
  updates: Partial<Session>,
): Promise<Session | null> {
  const sessions = await getSessions();
  const index = sessions.findIndex((s) => s.id === id);
  if (index === -1) return null;
  sessions[index] = {
    ...sessions[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  return sessions[index];
}

export async function deleteSession(id: string): Promise<boolean> {
  const sessions = await getSessions();
  const filtered = sessions.filter((s) => s.id !== id);
  if (filtered.length === sessions.length) return false;
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(filtered));
  return true;
}

export async function duplicateSession(id: string): Promise<Session | null> {
  const session = await getSession(id);
  if (!session) return null;
  return saveSession({
    ...session,
    title: `${session.title} (Copy)`,
    activities: session.activities.map((a) => ({ ...a, id: generateActivityId() })),
  });
}
