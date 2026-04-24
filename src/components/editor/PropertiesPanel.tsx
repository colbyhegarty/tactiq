import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { Trash2, Settings } from 'lucide-react-native';
import { DiagramData, SelectedEntity, PLAYER_COLORS } from '../../types/customDrill';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

interface PropertiesPanelProps {
  diagram: DiagramData;
  selectedEntity: SelectedEntity | null;
  onDiagramChange: (diagram: DiagramData) => void;
  onDeleteSelected: () => void;
}

const roleColors: Record<string, string> = {
  ATTACKER: '#ef4444', DEFENDER: '#3b82f6', GOALKEEPER: '#facc15', NEUTRAL: '#fb923c',
};
const actionColors: Record<string, string> = {
  PASS: '#60a5fa', RUN: '#facc15', DRIBBLE: '#a78bfa', SHOT: '#ef4444',
};

export function PropertiesPanel({ diagram, selectedEntity, onDiagramChange, onDeleteSelected }: PropertiesPanelProps) {
  const { colors: tc } = useTheme();
  const p = create_p(tc);
  const totalEntities = diagram.players.length + diagram.cones.length + diagram.balls.length + diagram.goals.length;

  const toggleMarkings = (val: boolean) => {
    if (val) onDiagramChange({ ...diagram, field: { ...diagram.field, markings: true, type: 'FULL', goals: 2 } });
    else onDiagramChange({ ...diagram, field: { ...diagram.field, markings: false, type: 'FULL', goals: 0 } });
  };

  const toggleHalfField = (val: boolean) => {
    if (val) onDiagramChange({ ...diagram, field: { ...diagram.field, type: 'HALF', goals: 1 } });
    else onDiagramChange({ ...diagram, field: { ...diagram.field, type: 'FULL', goals: 2 } });
  };

  const deleteEntity = (type: string, id: string) => {
    if (type === 'player') {
      onDiagramChange({ ...diagram, players: diagram.players.filter(p => p.id !== id), actions: diagram.actions.filter(a => { if (a.type === 'PASS') return a.fromPlayerId !== id && a.toPlayerId !== id; return a.playerId !== id; }) });
    } else if (type === 'cone') {
      onDiagramChange({ ...diagram, cones: diagram.cones.filter(c => c.id !== id), coneLines: diagram.coneLines.filter(l => l.fromConeId !== id && l.toConeId !== id) });
    } else if (type === 'ball') {
      onDiagramChange({ ...diagram, balls: diagram.balls.filter(b => b.id !== id) });
    } else if (type === 'goal') {
      onDiagramChange({ ...diagram, goals: diagram.goals.filter(g => g.id !== id) });
    } else if (type === 'action') {
      onDiagramChange({ ...diagram, actions: diagram.actions.filter(a => a.id !== id) });
    } else if (type === 'coneline') {
      onDiagramChange({ ...diagram, coneLines: diagram.coneLines.filter(l => l.id !== id) });
    }
  };

  return (
    <ScrollView style={p.container} contentContainerStyle={p.content} nestedScrollEnabled>
      {/* Field Markings */}
      <View style={p.row}>
        <Text style={p.label}>Show Field Markings</Text>
        <Switch value={diagram.field.markings} onValueChange={toggleMarkings} trackColor={{ false: tc.border, true: tc.primary }} thumbColor="#fff" />
      </View>

      {/* Half Field — only visible when markings are on */}
      {diagram.field.markings && (
        <View style={p.row}>
          <Text style={p.label}>Half Field</Text>
          <Switch value={diagram.field.type === 'HALF'} onValueChange={toggleHalfField} trackColor={{ false: tc.border, true: tc.primary }} thumbColor="#fff" />
        </View>
      )}

      <View style={p.divider} />

      {/* Selected Entity */}
      {selectedEntity && (
        <>
          <View style={p.selectedHeader}>
            <Text style={p.sectionLabel}>SELECTED</Text>
            <TouchableOpacity style={p.deleteBtn} onPress={onDeleteSelected}>
              <Trash2 size={12} color="#ef4444" />
              <Text style={p.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
          <View style={p.selectedBox}>
            <Text style={p.selectedText}>
              {selectedEntity.type === 'player' ? `Player: ${selectedEntity.id}` :
               selectedEntity.type === 'cone' ? `Cone ${diagram.cones.findIndex(c => c.id === selectedEntity.id) + 1}` :
               selectedEntity.type === 'ball' ? `Ball ${diagram.balls.findIndex(b => b.id === selectedEntity.id) + 1}` :
               selectedEntity.type === 'goal' ? `${diagram.goals.find(g => g.id === selectedEntity.id)?.size === 'mini' ? 'Mini Goal' : 'Goal'} ${diagram.goals.findIndex(g => g.id === selectedEntity.id) + 1}` :
               selectedEntity.type === 'action' ? `Action: ${diagram.actions.find(a => a.id === selectedEntity.id)?.type}` :
               `Cone Line ${diagram.coneLines.findIndex(l => l.id === selectedEntity.id) + 1}`}
            </Text>
          </View>
          <View style={p.divider} />
        </>
      )}

      {/* Entity List */}
      <Text style={p.sectionLabel}>PLAYERS & EQUIPMENT ({totalEntities})</Text>
      {diagram.players.map(pl => (
        <View key={pl.id} style={[p.entityRow, selectedEntity?.id === pl.id && p.entityRowSel]}>
          <View style={[p.entityDot, { backgroundColor: roleColors[pl.role] || '#fb923c' }]} />
          <Text style={p.entityName}>{pl.id}</Text>
          <Text style={p.entityDetail}>({pl.role.toLowerCase()})</Text>
          <TouchableOpacity onPress={() => deleteEntity('player', pl.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={p.entityX}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
      {diagram.cones.map((c, i) => (
        <View key={c.id} style={[p.entityRow, selectedEntity?.id === c.id && p.entityRowSel]}>
          <View style={[p.entityDot, { backgroundColor: '#f4a261' }]} />
          <Text style={p.entityName}>Cone {i + 1}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => deleteEntity('cone', c.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={p.entityX}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
      {diagram.balls.map((b, i) => (
        <View key={b.id} style={[p.entityRow, selectedEntity?.id === b.id && p.entityRowSel]}>
          <View style={[p.entityDot, { backgroundColor: '#fff' }]} />
          <Text style={p.entityName}>Ball {i + 1}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => deleteEntity('ball', b.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={p.entityX}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
      {diagram.goals.map((g, i) => (
        <View key={g.id} style={[p.entityRow, selectedEntity?.id === g.id && p.entityRowSel]}>
          <View style={[p.entityDot, { backgroundColor: '#fff' }]} />
          <Text style={p.entityName}>{g.size === 'mini' ? 'Mini Goal' : 'Goal'} {i + 1}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => deleteEntity('goal', g.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={p.entityX}>×</Text>
          </TouchableOpacity>
        </View>
      ))}
      {totalEntities === 0 && <Text style={p.emptyText}>No entities placed yet</Text>}

      {/* Actions */}
      {diagram.actions.length > 0 && (
        <>
          <View style={p.divider} />
          <Text style={p.sectionLabel}>ACTIONS ({diagram.actions.length})</Text>
          {diagram.actions.map((action, i) => {
            const label = action.type === 'PASS' ? `${action.fromPlayerId} → ${action.toPlayerId}` : action.playerId;
            return (
              <View key={action.id} style={[p.entityRow, selectedEntity?.id === action.id && p.entityRowSel]}>
                <Text style={[p.entityName, { color: actionColors[action.type] || tc.foreground }]}>{action.type}</Text>
                <Text style={p.entityDetail}>{label}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => deleteEntity('action', action.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Text style={p.entityX}>×</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </>
      )}

      {/* Cone Lines */}
      {diagram.coneLines.length > 0 && (
        <>
          <View style={p.divider} />
          <Text style={p.sectionLabel}>CONE LINES ({diagram.coneLines.length})</Text>
          {diagram.coneLines.map((line, i) => (
            <View key={line.id} style={[p.entityRow, selectedEntity?.id === line.id && p.entityRowSel]}>
              <Text style={[p.entityName, { color: '#f4a261' }]}>Line {i + 1}</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => deleteEntity('coneline', line.id)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={p.entityX}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function create_p(tc: any) { return StyleSheet.create({
  container: { maxHeight: 350 },
  content: { padding: spacing.sm, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 13, color: tc.foreground },
  divider: { height: 1, backgroundColor: tc.border },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: tc.mutedForeground, letterSpacing: 1 },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: borderRadius.sm },
  deleteText: { fontSize: 11, color: '#ef4444' },
  selectedBox: { backgroundColor: tc.card, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: 'rgba(74,157,110,0.3)', padding: spacing.sm },
  selectedText: { fontSize: 13, color: tc.foreground },
  entityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tc.card, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.border, paddingVertical: 8, paddingHorizontal: 10 },
  entityRowSel: { borderColor: 'rgba(74,157,110,0.5)' },
  entityDot: { width: 8, height: 8, borderRadius: 4 },
  entityName: { fontSize: 12, fontWeight: '500', color: tc.foreground },
  entityDetail: { fontSize: 11, color: tc.mutedForeground },
  entityX: { fontSize: 18, color: '#ef4444', fontWeight: '400', paddingHorizontal: 4 },
  emptyText: { fontSize: 11, color: tc.mutedForeground, fontStyle: 'italic', paddingVertical: spacing.sm },
}); };
