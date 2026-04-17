import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MousePointer, Triangle, CircleDot, Crosshair, Minus, Grid3x3, Undo2 } from 'lucide-react-native';
import { EditorTool } from '../../types/customDrill';
import { spacing, borderRadius } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

interface ToolsPanelProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  pendingActionFrom: string | null;
  snapToGrid: boolean;
  onSnapToggle: () => void;
  canUndo: boolean;
  onUndo: () => void;
}

const playerTools: { id: EditorTool; label: string; color: string }[] = [
  { id: 'attacker', label: 'ATK', color: '#ef4444' },
  { id: 'defender', label: 'DEF', color: '#3b82f6' },
  { id: 'goalkeeper', label: 'GK', color: '#facc15' },
  { id: 'neutral', label: 'NEU', color: '#fb923c' },
];

const equipTools: { id: EditorTool; label: string }[] = [
  { id: 'cone', label: 'Cone' },
  { id: 'ball', label: 'Ball' },
  { id: 'goal', label: 'Goal' },
  { id: 'minigoal', label: 'Mini Goal' },
];

const actionTools: { id: EditorTool; label: string; color: string }[] = [
  { id: 'pass', label: 'Pass', color: '#60a5fa' },
  { id: 'run', label: 'Run', color: '#facc15' },
  { id: 'dribble', label: 'Dribble', color: '#a78bfa' },
  { id: 'shot', label: 'Shot', color: '#ef4444' },
];

export function ToolsPanel({ activeTool, onToolChange, pendingActionFrom, snapToGrid, onSnapToggle, canUndo, onUndo }: ToolsPanelProps) {
  const { colors: tc } = useTheme();
  const s = create_s(tc);

  const Chip = ({ id, active, children, style }: { id: EditorTool; active: boolean; children: React.ReactNode; style?: any }) => (
    <TouchableOpacity
      style={[s.chip, active && s.chipActive, style]}
      onPress={() => onToolChange(id)}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      {/* Top row: Select + Snap + Undo */}
      <View style={s.topRow}>
        <Chip id="select" active={activeTool === 'select'} style={s.flexChip}>
          <MousePointer size={14} color={tc.foreground} />
          <Text style={s.chipLabel}>Select / Move</Text>
        </Chip>
        <TouchableOpacity
          style={[s.iconBtn, snapToGrid && s.iconBtnActive]}
          onPress={onSnapToggle}
          activeOpacity={0.7}
        >
          <Grid3x3 size={16} color={snapToGrid ? '#4a9d6e' : tc.mutedForeground} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.iconBtn, !canUndo && s.iconBtnDisabled]}
          onPress={onUndo}
          activeOpacity={canUndo ? 0.7 : 1}
          disabled={!canUndo}
        >
          <Undo2 size={16} color={canUndo ? tc.foreground : tc.mutedForeground} />
        </TouchableOpacity>
      </View>

      {/* Players — single row */}
      <Text style={s.sectionLabel}>PLAYERS</Text>
      <View style={s.row}>
        {playerTools.map(t => (
          <Chip key={t.id} id={t.id} active={activeTool === t.id} style={s.flexChip}>
            <View style={[s.dot, { backgroundColor: t.color }]} />
            <Text style={s.chipLabel}>{t.label}</Text>
          </Chip>
        ))}
      </View>

      {/* Equipment — single row */}
      <Text style={s.sectionLabel}>EQUIPMENT</Text>
      <View style={s.row}>
        {equipTools.map(t => (
          <Chip key={t.id} id={t.id} active={activeTool === t.id} style={s.flexChip}>
            {t.id === 'cone' ? <Triangle size={12} color="#fb923c" /> :
             t.id === 'ball' ? <CircleDot size={12} color={tc.foreground} /> :
             <Crosshair size={12} color={tc.foreground} />}
            <Text style={s.chipLabel}>{t.label}</Text>
          </Chip>
        ))}
      </View>

      {/* Boundaries */}
      <Text style={s.sectionLabel}>BOUNDARIES</Text>
      <Chip id="coneline" active={activeTool === 'coneline'}>
        <Minus size={14} color="#fb923c" style={{ transform: [{ rotate: '-30deg' }] }} />
        <Text style={s.chipLabel}>Cone Line</Text>
      </Chip>

      {/* Actions — single row */}
      <Text style={s.sectionLabel}>ACTIONS</Text>
      <View style={s.row}>
        {actionTools.map(t => (
          <Chip key={t.id} id={t.id} active={activeTool === t.id} style={s.flexChip}>
            <View style={[s.actionDot, { backgroundColor: t.color }]} />
            <Text style={s.chipLabel}>{t.label}</Text>
          </Chip>
        ))}
      </View>

      {/* Pending indicator */}
      {pendingActionFrom && (
        <View style={s.pending}>
          <Text style={s.pendingText}>Tap target to complete action</Text>
        </View>
      )}
    </View>
  );
}

function create_s(tc: any) { return StyleSheet.create({
  container: { gap: spacing.sm, padding: spacing.sm },
  topRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  row: { flexDirection: 'row', gap: 4 },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: tc.mutedForeground, letterSpacing: 1.5, marginTop: spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border, borderRadius: borderRadius.sm, paddingVertical: 8, paddingHorizontal: 8 },
  chipActive: { backgroundColor: 'rgba(74,157,110,0.25)', borderColor: 'rgba(74,157,110,0.5)' },
  flexChip: { flex: 1 },
  chipLabel: { fontSize: 10, color: tc.foreground },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actionDot: { width: 6, height: 6, borderRadius: 3 },
  iconBtn: { width: 36, height: 36, borderRadius: borderRadius.sm, backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border, justifyContent: 'center', alignItems: 'center' },
  iconBtnActive: { backgroundColor: 'rgba(74,157,110,0.2)', borderColor: 'rgba(74,157,110,0.5)' },
  iconBtnDisabled: { opacity: 0.4 },
  pending: { backgroundColor: 'rgba(250,204,21,0.15)', borderWidth: 1, borderColor: 'rgba(250,204,21,0.4)', borderRadius: borderRadius.sm, padding: spacing.sm },
  pendingText: { fontSize: 10, color: '#facc15', fontWeight: '500' },
}); };
