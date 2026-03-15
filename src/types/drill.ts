// Types matching Lovable's drill structure

export interface Position {
  x: number;
  y: number;
}

export interface DrillPlayer {
  id: string;
  role: 'attacker' | 'defender' | 'goalkeeper' | 'neutral';
  position: Position;
}

export interface DrillCone {
  position: Position;
  color?: string;
}

export interface DrillBall {
  position: Position;
}

export interface DrillGoal {
  position: Position;
  rotation?: number;
  size?: 'full' | 'small';
}

export interface DrillMiniGoal {
  position: Position;
  rotation?: number;
}

export interface ConeLine {
  from_cone: number;
  to_cone: number;
}

export interface DrillMovement {
  from: Position;
  to: Position;
  type: 'run' | 'pass' | 'dribble' | 'shot';
  player_id?: string;
}

export interface DrillAction {
  type: 'PASS' | 'RUN' | 'DRIBBLE' | 'SHOT';
  from_player?: string;
  to_player?: string;
  player?: string;
  to_position?: Position;
}

export interface AnimationKeyframe {
  id: string;
  label: string;
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  positions: {
    [entityId: string]: Position;
  };
}

export interface Animation {
  duration: number;
  keyframes: AnimationKeyframe[];
}

export interface DrillJsonData {
  field?: {
    type: 'FULL' | 'HALF';
    show_markings?: boolean;
    markings?: boolean;
    goals?: number;
    attacking_direction?: 'NORTH' | 'SOUTH';
  };
  players?: DrillPlayer[];
  cones?: DrillCone[];
  balls?: DrillBall[];
  goals?: DrillGoal[];
  mini_goals?: DrillMiniGoal[];
  movements?: DrillMovement[];
  actions?: DrillAction[];
  cone_lines?: ConeLine[];
  animation?: Animation;
  num_players?: number;
  duration?: number;
  intensity?: string;
  category?: string;
}

export interface Drill {
  id: string;
  name: string;
  category: string;
  description?: string;
  player_count?: number;
  player_count_display?: string;
  duration?: number;
  age_group?: string;
  difficulty?: string;
  svg_url?: string;
  diagram_json?: DrillJsonData;
  has_animation?: boolean;
  animation_json?: {
    duration: number;
    keyframes: AnimationKeyframe[];
  };
  animation_html_url?: string;
  setup?: string;
  instructions?: string;
  coaching_points?: string;
  variations?: string;
  source?: string;
  savedAt?: string;
}

// ── Category / difficulty types matching Lovable ──

export type DrillCategory =
  | 'Finishing'
  | 'Passing & Possession'
  | 'Defensive Shape'
  | 'Pressing & Transitions'
  | 'Crossing & Wide Play'
  | 'Set Pieces'
  | 'Conditioning'
  | 'Warm-up'
  | 'Cool-down'
  | 'Technical Skills'
  | '1v1 Situations'
  | 'Small-Sided Games'
  | 'Other';

export type IntensityLevel = 'Low' | 'Medium' | 'High' | 'Variable' | 'Not Specified';

export type AgeGroup =
  | 'U8' | 'U10' | 'U12' | 'U14' | 'U16' | 'U18'
  | 'College' | 'Semi-Pro' | 'Professional'
  | 'Recreational Adult' | 'Not Specified';

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Elite' | 'Not Specified';

export type FieldSize =
  | 'Full Field' | 'Half Field' | 'Third of Field'
  | 'Penalty Box Area'
  | 'Small Grid (10x10 to 20x20)'
  | 'Medium Grid (20x20 to 40x40)'
  | 'Any/Flexible';

export interface UserProfile {
  name: string;
  email: string;
  teamName: string;
  defaultAgeGroup: AgeGroup;
  defaultSkillLevel: SkillLevel;
  defaultPlayerCount: number;
  avatarUrl?: string;
}
