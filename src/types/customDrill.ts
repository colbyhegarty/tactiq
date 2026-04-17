// Position in field coordinates (0-100 for both x and y)
export interface FieldPosition {
  x: number;
  y: number;
}

export interface CustomPlayer {
  id: string;
  role: 'ATTACKER' | 'DEFENDER' | 'GOALKEEPER' | 'NEUTRAL';
  position: FieldPosition;
}

export interface CustomCone {
  id: string;
  position: FieldPosition;
}

export interface CustomBall {
  id: string;
  position: FieldPosition;
}

export interface CustomGoal {
  id: string;
  position: FieldPosition;
  rotation: number;
  size: 'full' | 'mini';
}

export interface CustomConeLine {
  id: string;
  fromConeId: string;
  toConeId: string;
}

// Action types
export interface PassAction {
  id: string;
  type: 'PASS';
  fromPlayerId: string;
  toPlayerId?: string;
  toPosition?: FieldPosition;
}

export interface RunAction {
  id: string;
  type: 'RUN';
  playerId: string;
  toPosition: FieldPosition;
}

export interface DribbleAction {
  id: string;
  type: 'DRIBBLE';
  playerId: string;
  toPosition: FieldPosition;
}

export interface ShotAction {
  id: string;
  type: 'SHOT';
  playerId: string;
  toPosition: FieldPosition;
}

export type CustomAction = PassAction | RunAction | DribbleAction | ShotAction;

export interface FieldConfig {
  type: 'FULL' | 'HALF';
  markings: boolean;
  goals: 0 | 1 | 2;
}

export interface DiagramData {
  field: FieldConfig;
  players: CustomPlayer[];
  cones: CustomCone[];
  balls: CustomBall[];
  goals: CustomGoal[];
  coneLines: CustomConeLine[];
  actions: CustomAction[];
}

export type EditorTool =
  | 'select'
  | 'attacker'
  | 'defender'
  | 'goalkeeper'
  | 'neutral'
  | 'cone'
  | 'ball'
  | 'goal'
  | 'minigoal'
  | 'coneline'
  | 'pass'
  | 'run'
  | 'dribble'
  | 'shot';

export interface SelectedEntity {
  type: 'player' | 'cone' | 'ball' | 'goal' | 'coneline' | 'action';
  id: string;
}

export interface EditorState {
  tool: EditorTool;
  diagram: DiagramData;
  selectedEntity: SelectedEntity | null;
  pendingActionFrom: string | null;
}

export interface CustomDrillFormData {
  name: string;
  description: string;
  category: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | '';
  ageGroup: string;
  playerCount: string;
  duration: string;
  setupText: string;
  instructionsText: string;
  coachingPointsText: string;
  variationsText: string;
}

export interface CustomDrill {
  id: string;
  createdAt: string;
  updatedAt: string;
  basedOnDrillId?: string;
  formData: CustomDrillFormData;
  diagramData: DiagramData;
}

// Player role colors
export const PLAYER_COLORS = {
  ATTACKER: '#e63946',
  DEFENDER: '#457b9d',
  GOALKEEPER: '#f1fa3c',
  NEUTRAL: '#f4a261',
} as const;

// Field colors
export const FIELD_COLORS = {
  GRASS_LIGHT: '#6fbf4a',
  GRASS_DARK: '#63b043',
  LINES: '#ffffff',
  CONE: '#f4a261',
} as const;

// Action arrow colors – matches Python renderer.py
export const ACTION_COLORS = {
  PASS: '#ffffff',
  RUN: '#ffffff',
  DRIBBLE: '#ffffff',
  SHOT: '#ff6b6b',
} as const;
