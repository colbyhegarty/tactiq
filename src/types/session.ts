export interface EquipmentItem {
  name: string;
  quantity: number;
  checked: boolean;
}

export interface SessionActivity {
  id: string;
  sort_order: number;
  activity_type: 'library_drill' | 'custom_drill' | 'quick_activity';
  library_drill_id: string | null;
  custom_drill_id: string | null;
  title: string;
  description: string;
  duration_minutes: number;
  activity_notes: string;
  // Resolved drill data (populated at load time, not persisted)
  drill_name?: string;
  drill_svg_url?: string;
  drill_category?: string;
  drill_difficulty?: string;
  drill_player_count?: string;
  drill_setup?: string;
  drill_instructions?: string;
}

export interface Session {
  id: string;
  title: string;
  session_date: string;
  session_time: string;
  team_name: string;
  session_goals: string;
  coach_notes: string;
  equipment: EquipmentItem[];
  activities: SessionActivity[];
  created_at: string;
  updated_at: string;
}
