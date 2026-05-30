import { DiagramData } from '../types/customDrill';
import { CustomDrill } from '../types/customDrill';
import { Drill, DrillJsonData } from '../types/drill';

// Convert CustomDrill's DiagramData to DrillJsonData for DrillDiagramView
export function convertToDrillJson(diagram: DiagramData): DrillJsonData {
  const players = diagram.players.map(p => ({
    id: p.id,
    role: p.role.toLowerCase() as 'attacker' | 'defender' | 'goalkeeper' | 'neutral',
    position: { x: p.position.x, y: p.position.y },
  }));

  const cones = diagram.cones.map(c => ({
    position: { x: c.position.x, y: c.position.y },
  }));

  const balls = diagram.balls.map(b => ({
    position: { x: b.position.x, y: b.position.y },
  }));

  const goals = diagram.goals
    .filter(g => g.size === 'full')
    .map(g => ({
      position: { x: g.position.x, y: g.position.y },
      rotation: g.rotation,
      size: 'full' as const,
    }));

  const miniGoals = diagram.goals
    .filter(g => g.size === 'mini')
    .map(g => ({
      position: { x: g.position.x, y: g.position.y },
      rotation: g.rotation,
    }));

  const coneIdToIndex: Record<string, number> = {};
  diagram.cones.forEach((c, i) => { coneIdToIndex[c.id] = i; });

  const coneLines = diagram.coneLines
    .filter(cl => coneIdToIndex[cl.fromConeId] !== undefined && coneIdToIndex[cl.toConeId] !== undefined)
    .map(cl => ({
      from_cone: coneIdToIndex[cl.fromConeId],
      to_cone: coneIdToIndex[cl.toConeId],
    }));

  const actions = diagram.actions.map(a => {
    if (a.type === 'PASS') {
      return {
        type: 'PASS' as const,
        from_player: a.fromPlayerId,
        to_player: a.toPlayerId,
      };
    }
    return {
      type: a.type as 'RUN' | 'DRIBBLE' | 'SHOT',
      player: a.playerId,
      to_position: a.toPosition,
    };
  });

  return {
    field: {
      type: diagram.field.type,
      markings: diagram.field.markings,
      goals: diagram.field.goals,
    },
    players,
    cones,
    balls,
    goals,
    mini_goals: miniGoals,
    cone_lines: coneLines,
    actions,
  };
}

// Convert a CustomDrill into a Drill so it can be displayed with DrillDetailModal
export function customDrillToDrill(custom: CustomDrill): Drill {
  const { formData, diagramData } = custom;
  return {
    id: custom.id,
    name: formData.name || 'Untitled Drill',
    category: formData.category || '',
    description: formData.description || undefined,
    player_count: formData.playerCount ? parseInt(formData.playerCount) || undefined : (diagramData.players.length || undefined),
    duration: formData.duration ? parseInt(formData.duration) || undefined : undefined,
    age_group: formData.ageGroup || undefined,
    difficulty: formData.difficulty || undefined,
    diagram_json: convertToDrillJson(diagramData),
    raw_diagram_data: diagramData,
    setup: formData.setupText || undefined,
    instructions: formData.instructionsText || undefined,
    coaching_points: formData.coachingPointsText || undefined,
    variations: formData.variationsText || undefined,
    source: 'custom',
  };
}
