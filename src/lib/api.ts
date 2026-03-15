import { supabase } from './supabase';
import { Drill, DrillJsonData } from '../types/drill';

const API_URL = 'https://soccer-drill-api.onrender.com';

// ── Supabase row types ──────────────────────────────────────────────

export interface DrillListRow {
  id: string;
  name: string;
  category: string;
  player_count: string;
  duration: string;
  age_group?: string;
  difficulty?: string;
  description?: string;
  svg_url?: string;
  has_animation?: boolean;
}

export interface DrillDetailRow {
  id: string;
  name: string;
  category: string;
  player_count: string;
  duration: string;
  age_group?: string;
  difficulty?: string;
  description?: string;
  svg_url?: string;
  setup_text?: string;
  instructions_text?: string;
  variations_text?: string;
  coaching_points_text?: string;
  source?: string;
  has_animation?: boolean;
  animation_html_url?: string;
  diagram_json?: DrillJsonData;
  animation_json?: { duration: number; keyframes: any[] };
}

// ── Library meta / response types ───────────────────────────────────

export interface LibraryDrillMeta {
  id: string;
  name: string;
  category: string;
  player_count: string;
  duration: string;
  age_group?: string;
  difficulty?: string;
  description?: string;
  svg_url?: string;
  has_animation?: boolean;
}

export interface LibraryListResponse {
  success: boolean;
  count: number;
  drills: LibraryDrillMeta[];
}

export interface LibraryDrillDetail {
  id: string;
  name: string;
  category: string;
  player_count: string;
  duration: string;
  age_group?: string;
  difficulty?: string;
  description?: string;
  setup_text?: string;
  instructions_text?: string;
  variations_text?: string;
  coaching_points_text?: string;
  source?: string;
  has_animation?: boolean;
  animation_html_url?: string;
  diagram_json?: DrillJsonData;
  animation_json?: { duration: number; keyframes: any[] };
}

export interface LibraryDrillResponse {
  success: boolean;
  drill: LibraryDrillDetail;
  svg_url?: string;
}

// ── Filter types ────────────────────────────────────────────────────

export interface FilterOptionsResponse {
  success: boolean;
  categories: string[];
  ageGroups: string[];
  durations: string[];
}

export interface DrillFilterParams {
  category?: string;
  age_group?: string;
  min_players?: number;
  max_players?: number;
  difficulty?: string;
  duration?: string;
  search?: string;
  has_animation?: boolean;
}

// Difficulty values – uppercase to match database
export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

// Grouped age categories for filtering
export const AGE_GROUP_CATEGORIES = ['U6-U8', 'U10-U12', 'U14-U16', 'U17+'];

// ── Fetch functions ─────────────────────────────────────────────────

/** Fetch all drills from the drill_list view */
export async function fetchLibraryDrills(): Promise<LibraryListResponse> {
  const { data, error } = await supabase.from('drill_list').select('*');

  if (error) throw new Error(`Failed to fetch drills: ${error.message}`);

  const drills: LibraryDrillMeta[] = (data || []).map((row: DrillListRow) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    player_count: row.player_count,
    duration: row.duration,
    age_group: row.age_group,
    difficulty: row.difficulty,
    description: row.description,
    svg_url: row.svg_url,
    has_animation: row.has_animation,
  }));

  return { success: true, count: drills.length, drills };
}

/** Fetch single drill with full details from drill_detail view */
export async function fetchLibraryDrill(id: string): Promise<LibraryDrillResponse> {
  const { data, error } = await supabase
    .from('drill_detail')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch drill: ${error.message}`);
  if (!data) throw new Error('Drill not found');

  const detail: LibraryDrillDetail = {
    id: data.id,
    name: data.name,
    category: data.category,
    player_count: data.player_count,
    duration: data.duration,
    age_group: data.age_group,
    difficulty: data.difficulty,
    description: data.description,
    setup_text: data.setup_text,
    instructions_text: data.instructions_text,
    variations_text: data.variations_text,
    coaching_points_text: data.coaching_points_text,
    source: data.source,
    has_animation: data.has_animation,
    animation_html_url: data.animation_html_url,
    diagram_json: data.diagram_json,
    animation_json: data.animation_json,
  };

  return { success: true, drill: detail, svg_url: data.svg_url };
}

/** Fetch available filter options (categories, age groups, durations) */
export async function fetchFilterOptions(): Promise<FilterOptionsResponse> {
  try {
    const { data, error } = await supabase
      .from('drill_list')
      .select('category, age_group, duration');

    if (error || !data) {
      console.error('Failed to fetch filter options:', error);
      return { success: true, categories: [], ageGroups: [], durations: [] };
    }

    // Extract unique individual categories (split comma-separated)
    const categorySet = new Set<string>();
    data.forEach((d: any) => {
      if (d.category) {
        d.category.split(',').forEach((cat: string) => {
          const trimmed = cat.trim();
          if (trimmed) categorySet.add(trimmed.toUpperCase());
        });
      }
    });
    const categories = Array.from(categorySet).sort();

    // Extract and sort age groups by first number
    const ageGroups = [
      ...new Set(data.map((d: any) => d.age_group).filter(Boolean)),
    ].sort((a: string, b: string) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

    // Extract and sort durations by numeric value
    const durations = [
      ...new Set(data.map((d: any) => d.duration).filter(Boolean)),
    ].sort((a: string, b: string) => {
      const numA = parseInt(a.match(/\d+/)?.[0] || '0');
      const numB = parseInt(b.match(/\d+/)?.[0] || '0');
      return numA - numB;
    });

    return { success: true, categories, ageGroups, durations };
  } catch (e) {
    console.error('Failed to fetch filter options:', e);
    return { success: true, categories: [], ageGroups: [], durations: [] };
  }
}

/** Fetch filtered drills from Supabase with server-side filters */
export async function fetchFilteredDrills(
  filters: DrillFilterParams,
): Promise<LibraryListResponse> {
  let query = supabase.from('drill_list').select('*');

  if (filters.category && filters.category !== 'All') {
    query = query.ilike('category', `%${filters.category}%`);
  }
  if (filters.difficulty && filters.difficulty !== 'All') {
    query = query.eq('difficulty', filters.difficulty);
  }
  if (filters.search) {
    query = query.ilike('name', `%${filters.search}%`);
  }
  if (filters.has_animation !== undefined) {
    query = query.eq('has_animation', filters.has_animation);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch filtered drills: ${error.message}`);

  const drills: LibraryDrillMeta[] = (data || []).map((row: DrillListRow) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    player_count: row.player_count,
    duration: row.duration,
    age_group: row.age_group,
    difficulty: row.difficulty,
    description: row.description,
    svg_url: row.svg_url,
    has_animation: row.has_animation,
  }));

  return { success: true, count: drills.length, drills };
}

// ── Client-side filter helpers ──────────────────────────────────────

export function filterByPlayerCount(
  drills: LibraryDrillMeta[],
  minPlayers?: number,
  maxPlayers?: number,
): LibraryDrillMeta[] {
  if (!minPlayers && !maxPlayers) return drills;

  return drills.filter((drill) => {
    if (!drill.player_count) return true;
    const match = drill.player_count.match(/(\d+)/);
    if (!match) return true;
    const drillMinPlayers = parseInt(match[1]);
    if (minPlayers && drillMinPlayers < minPlayers) return false;
    if (maxPlayers && drillMinPlayers > maxPlayers) return false;
    return true;
  });
}

export function filterByDuration(
  drills: LibraryDrillMeta[],
  selectedDuration?: string,
): LibraryDrillMeta[] {
  if (!selectedDuration || selectedDuration === 'Any Duration') return drills;
  const targetNum = selectedDuration.match(/(\d+)/)?.[1];
  if (!targetNum) return drills;
  return drills.filter((drill) => {
    if (!drill.duration) return true;
    const drillNum = drill.duration.match(/(\d+)/)?.[1];
    return drillNum === targetNum;
  });
}

export function filterByAgeGroup(
  drills: LibraryDrillMeta[],
  selectedAgeGroup?: string,
): LibraryDrillMeta[] {
  if (!selectedAgeGroup || selectedAgeGroup === 'All') return drills;

  const groupRanges: Record<string, [number, number]> = {
    'U6-U8': [4, 8],
    'U10-U12': [9, 12],
    'U14-U16': [13, 16],
    'U17+': [17, 99],
  };

  const filterRange = groupRanges[selectedAgeGroup];
  if (!filterRange) return drills;
  const [filterMin, filterMax] = filterRange;

  return drills.filter((drill) => {
    if (!drill.age_group) return true;
    const ageStr = drill.age_group.trim();
    let drillMin: number;
    let drillMax: number;

    const plusMatch = ageStr.match(/^(\d+)\+$/);
    if (plusMatch) {
      drillMin = parseInt(plusMatch[1]);
      drillMax = 99;
    } else {
      const rangeMatch = ageStr.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (rangeMatch) {
        drillMin = parseInt(rangeMatch[1]);
        drillMax = parseInt(rangeMatch[2]);
      } else {
        const numMatch = ageStr.match(/(\d+)/);
        if (!numMatch) return true;
        drillMin = parseInt(numMatch[1]);
        drillMax = drillMin;
      }
    }

    return drillMin <= filterMax && drillMax >= filterMin;
  });
}

// ── Mapping helpers ─────────────────────────────────────────────────

/** Map difficulty to RN-friendly color pair */
export function getDifficultyColor(difficulty?: string): { bg: string; text: string } {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' };
    case 'medium':
      return { bg: 'rgba(212, 166, 65, 0.15)', text: '#d4a641' };
    case 'hard':
      return { bg: 'rgba(220, 38, 38, 0.15)', text: '#dc2626' };
    default:
      return { bg: 'rgba(139, 145, 158, 0.15)', text: '#8b919e' };
  }
}

/** Map category to RN-friendly color pair */
export function getCategoryColor(category?: string): { bg: string; text: string } {
  switch (category?.toLowerCase()?.trim()) {
    case 'possession':
      return { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' };
    case 'finishing':
      return { bg: 'rgba(220, 38, 38, 0.15)', text: '#dc2626' };
    case 'passing':
      return { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' };
    case 'dribbling':
      return { bg: 'rgba(147, 51, 234, 0.15)', text: '#9333ea' };
    case 'defending':
      return { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' };
    case 'pressing & transitions':
      return { bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4' };
    case 'conditioning':
      return { bg: 'rgba(236, 72, 153, 0.15)', text: '#ec4899' };
    default:
      return { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' };
  }
}

/** Convert API drill meta + detail into the app Drill type */
export function mapLibraryDrillToDrill(
  meta: LibraryDrillMeta,
  detail?: LibraryDrillDetail,
  svg_url?: string,
): Drill {
  const playerCountStr = meta.player_count || '10';
  const playerCount = parseInt(playerCountStr.replace(/[^\d]/g, '')) || 10;
  const duration = parseInt((meta.duration || '').replace(/[^\d]/g, '')) || 15;

  const description =
    detail?.description || meta.description || `${meta.category} drill for ${playerCount} players`;

  return {
    id: meta.id,
    name: meta.name,
    category: meta.category || 'Other',
    description,
    player_count: playerCount,
    player_count_display: playerCountStr,
    duration,
    age_group: detail?.age_group || meta.age_group,
    difficulty: detail?.difficulty || meta.difficulty,
    svg_url: svg_url || meta.svg_url,
    diagram_json: detail?.diagram_json,
    has_animation: detail?.has_animation ?? meta.has_animation,
    animation_json: detail?.animation_json,
    setup: detail?.setup_text,
    instructions: detail?.instructions_text,
    coaching_points: detail?.coaching_points_text,
    variations: detail?.variations_text,
    source: detail?.source,
    animation_html_url: detail?.animation_html_url,
  };
}

/** Convenience: fetch + map drills with optional filters */
export async function fetchDrills(filters: DrillFilterParams = {}): Promise<Drill[]> {
  const response = await fetchFilteredDrills(filters);
  return response.drills.map((meta) => mapLibraryDrillToDrill(meta));
}

/** Fetch a single drill by ID with full details */
export async function fetchDrillById(id: string): Promise<Drill | null> {
  try {
    const response = await fetchLibraryDrill(id);
    if (!response.success) return null;

    const meta: LibraryDrillMeta = {
      id: response.drill.id,
      name: response.drill.name,
      category: response.drill.category,
      player_count: response.drill.player_count,
      duration: response.drill.duration,
      age_group: response.drill.age_group,
      difficulty: response.drill.difficulty,
      description: response.drill.description,
      svg_url: response.svg_url,
      has_animation: response.drill.has_animation,
    };

    return mapLibraryDrillToDrill(meta, response.drill, response.svg_url);
  } catch (error) {
    console.error('Failed to fetch drill by ID:', error);
    return null;
  }
}

// ── Drill generation (Render API) ───────────────────────────────────

export interface DrillFormData {
  drillType: string;
  description: string;
  totalPlayers: number;
  goalkeepers?: number;
  hasGoals: boolean;
  goalCount: number;
  hasCones: boolean;
  hasMannequins: boolean;
  hasBibs: boolean;
  ballCount: string;
  fieldSize: string;
  ageGroup: string;
  skillLevel: string;
  intensity: string;
  duration?: number;
  additionalNotes: string;
}

export interface GenerateDrillResponse {
  success: boolean;
  drill_name: string;
  svg: string;
  description: string;
  drill_json: DrillJsonData;
  error: string | null;
}

function buildPrompt(formData: DrillFormData): string {
  let prompt = `Create a ${formData.drillType} drill`;
  if (formData.description) prompt += ` focused on: ${formData.description}`;
  prompt += `. Players: ${formData.totalPlayers}`;
  if (formData.goalkeepers && formData.goalkeepers > 0)
    prompt += ` (including ${formData.goalkeepers} goalkeeper(s))`;
  if (formData.hasGoals && formData.goalCount > 0)
    prompt += `. Use ${formData.goalCount} goal(s)`;
  if (formData.hasMannequins) prompt += `. Include mannequins/dummies`;
  if (formData.ageGroup && formData.ageGroup !== 'Not Specified')
    prompt += `. Age group: ${formData.ageGroup}`;
  if (formData.intensity && formData.intensity !== 'Not Specified')
    prompt += `. Intensity: ${formData.intensity}`;
  if (formData.duration) prompt += `. Duration: approximately ${formData.duration} minutes`;
  if (formData.fieldSize && formData.fieldSize !== 'Any/Flexible')
    prompt += `. Field size: ${formData.fieldSize}`;
  if (formData.additionalNotes)
    prompt += `. Additional notes: ${formData.additionalNotes}`;
  return prompt;
}

export async function generateDrill(formData: DrillFormData): Promise<GenerateDrillResponse> {
  const prompt = buildPrompt(formData);
  const includeGoalkeeper = (formData.goalkeepers || 0) > 0;

  const skillMap: Record<string, string> = {
    Beginner: 'beginner',
    Intermediate: 'intermediate',
    Advanced: 'advanced',
    Elite: 'advanced',
  };

  const requestBody = {
    prompt,
    num_players: formData.totalPlayers,
    include_goalkeeper: includeGoalkeeper,
    field_type: formData.fieldSize === 'Full Field' ? 'FULL' : 'HALF',
    skill_level: skillMap[formData.skillLevel] || null,
  };

  const response = await fetch(`${API_URL}/api/generate-drill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate drill: ${errorText}`);
  }

  const data = await response.json();
  if (!data.success) throw new Error(data.error || 'Failed to generate drill');

  return data;
}

/** Warm up Render backend to prevent cold start delays */
export function warmUpBackend(): void {
  fetch(`${API_URL}/health`).catch(() => {});
}
