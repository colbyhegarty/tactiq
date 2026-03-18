import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MousePointer, Triangle, CircleDot, Crosshair, ArrowRight, MoveRight, Zap, Target, Minus } from 'lucide-react-native';
import { EditorTool } from '../../types/customDrill';
import { colors, spacing, borderRadius } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeContext';

interface ToolsPanelProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  pendingActionFrom: string | null;
}

const playerTools: { id: EditorTool; label: string; color: string }[] = [
  { id: 'attacker', label: 'Attacker', color: '#ef4444' },
  { id: 'defender', label: 'Defender', color: '#3b82f6' },
  { id: 'goalkeeper', label: 'GK', color: '#facc15' },
  { id: 'neutral', label: 'Neutral', color: '#fb923c' },
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

export function ToolsPanel({ activeTool, onToolChange, pendingActionFrom }: ToolsPanelProps) {
  const { colors: tc } = useTheme();
  const Btn = ({ id, active, children }: { id: EditorTool; active: boolean; children: React.ReactNode }) => (
    <TouchableOpacity
      style={[s.btn, active && s.btnActive]}
      onPress={() => onToolChange(id)}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      {/* Select */}
      <Btn id="select" active={activeTool === 'select'}>
        <MousePointer size={14} color={tc.foreground} />
        <Text style={s.btnLabel}>Select / Move</Text>
      </Btn>

      {/* Players */}
      <Text style={s.sectionLabel}>PLAYERS</Text>
      <View style={s.grid}>
        {playerTools.map(t => (
          <Btn key={t.id} id={t.id} active={activeTool === t.id}>
            <View style={[s.dot, { backgroundColor: t.color }]} />
            <Text style={s.gridLabel}>{t.label}</Text>
          </Btn>
        ))}
      </View>

      {/* Equipment */}
      <Text style={s.sectionLabel}>EQUIPMENT</Text>
      <View style={s.grid}>
        {equipTools.map(t => (
          <Btn key={t.id} id={t.id} active={activeTool === t.id}>
            {t.id === 'cone' ? <Triangle size={14} color="#fb923c" /> :
             t.id === 'ball' ? <CircleDot size={14} color={tc.foreground} /> :
             <Crosshair size={14} color={tc.foreground} />}
            <Text style={s.gridLabel}>{t.label}</Text>
          </Btn>
        ))}
      </View>

      {/* Boundaries */}
      <Text style={s.sectionLabel}>BOUNDARIES</Text>
      <Btn id="coneline" active={activeTool === 'coneline'}>
        <Minus size={14} color="#fb923c" style={{ transform: [{ rotate: '-30deg' }] }} />
        <Text style={s.btnLabel}>Cone Line</Text>
      </Btn>

      {/* Actions */}
      <Text style={s.sectionLabel}>ACTIONS</Text>
      {actionTools.map(t => (
        <TouchableOpacity
          key={t.id}
          style={[s.actionBtn, activeTool === t.id && s.btnActive, { borderLeftColor: t.color }]}
          onPress={() => onToolChange(t.id)}
          activeOpacity={0.7}
        >
          <View style={[s.actionDot, { backgroundColor: t.color }]} />
          <Text style={s.btnLabel}>{t.label}</Text>
        </TouchableOpacity>
      ))}

      {/* Pending indicator */}
      {pendingActionFrom && (
        <View style={s.pending}>
          <Text style={s.pendingText}>Tap target to complete action</Text>
        </View>
      )}

      <Text style={s.tip}>Tip: Select a tool, tap on field to place.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { gap: spacing.sm, padding: spacing.sm },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: '#8b919e', letterSpacing: 1.5, marginTop: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1e2433', borderWidth: 1, borderColor: '#2a3142', borderRadius: borderRadius.sm, paddingVertical: 8, paddingHorizontal: 10 },
  btnActive: { backgroundColor: 'rgba(74,157,110,0.25)', borderColor: 'rgba(74,157,110,0.5)' },
  btnLabel: { fontSize: 12, color: '#e8eaed' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  gridLabel: { fontSize: 10, color: '#e8eaed' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1e2433', borderWidth: 1, borderColor: '#2a3142', borderLeftWidth: 3, borderRadius: borderRadius.sm, paddingVertical: 8, paddingHorizontal: 10 },
  actionDot: { width: 8, height: 8, borderRadius: 4 },
  pending: { backgroundColor: 'rgba(250,204,21,0.15)', borderWidth: 1, borderColor: 'rgba(250,204,21,0.4)', borderRadius: borderRadius.sm, padding: spacing.sm },
  pendingText: { fontSize: 10, color: '#facc15', fontWeight: '500' },
  tip: { fontSize: 10, color: '#8b919e', marginTop: spacing.xs, opacity: 0.6 },
});
