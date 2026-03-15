import AsyncStorage from '@react-native-async-storage/async-storage';
import { CustomDrill, DiagramData, CustomDrillFormData } from '../types/customDrill';

const CUSTOM_DRILLS_KEY = 'drillforge_custom_drills';

// Default empty diagram
export const getEmptyDiagram = (): DiagramData => ({
  field: {
    type: 'FULL',
    markings: true,
    goals: 2,
  },
  players: [],
  cones: [],
  balls: [],
  goals: [],
  coneLines: [],
  actions: [],
});

// Default empty form
export const getEmptyFormData = (): CustomDrillFormData => ({
  name: '',
  description: '',
  category: '',
  difficulty: '',
  ageGroup: '',
  playerCount: '',
  duration: '',
  setupText: '',
  instructionsText: '',
  coachingPointsText: '',
  variationsText: '',
});

// Generate unique ID
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get all custom drills
export async function getCustomDrills(): Promise<CustomDrill[]> {
  try {
    const stored = await AsyncStorage.getItem(CUSTOM_DRILLS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Get a single custom drill by ID
export async function getCustomDrill(id: string): Promise<CustomDrill | null> {
  const drills = await getCustomDrills();
  return drills.find((d) => d.id === id) || null;
}

// Save a new custom drill
export async function saveCustomDrill(
  formData: CustomDrillFormData,
  diagramData: DiagramData,
  basedOnDrillId?: string,
): Promise<CustomDrill> {
  const drills = await getCustomDrills();
  const now = new Date().toISOString();

  const newDrill: CustomDrill = {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    basedOnDrillId,
    formData,
    diagramData,
  };

  drills.push(newDrill);
  await AsyncStorage.setItem(CUSTOM_DRILLS_KEY, JSON.stringify(drills));

  return newDrill;
}

// Update an existing custom drill
export async function updateCustomDrill(
  id: string,
  formData: CustomDrillFormData,
  diagramData: DiagramData,
): Promise<CustomDrill | null> {
  const drills = await getCustomDrills();
  const index = drills.findIndex((d) => d.id === id);

  if (index === -1) return null;

  drills[index] = {
    ...drills[index],
    updatedAt: new Date().toISOString(),
    formData,
    diagramData,
  };

  await AsyncStorage.setItem(CUSTOM_DRILLS_KEY, JSON.stringify(drills));
  return drills[index];
}

// Delete a custom drill
export async function deleteCustomDrill(id: string): Promise<boolean> {
  const drills = await getCustomDrills();
  const filtered = drills.filter((d) => d.id !== id);

  if (filtered.length === drills.length) return false;

  await AsyncStorage.setItem(CUSTOM_DRILLS_KEY, JSON.stringify(filtered));
  return true;
}

// Clear all custom drills
export async function clearCustomDrills(): Promise<void> {
  await AsyncStorage.removeItem(CUSTOM_DRILLS_KEY);
}
