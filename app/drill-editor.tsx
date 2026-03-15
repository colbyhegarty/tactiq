import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, StatusBar,
  KeyboardAvoidingView, Platform, LayoutAnimation, UIManager, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { DiagramCanvas } from '../src/components/editor/DiagramCanvas';
import { ToolsPanel } from '../src/components/editor/ToolsPanel';
import { PropertiesPanel } from '../src/components/editor/PropertiesPanel';
import {
  DiagramData, CustomDrillFormData, EditorState, SelectedEntity,
} from '../src/types/customDrill';
import { getEmptyDiagram, getEmptyFormData, getCustomDrill, saveCustomDrill, updateCustomDrill } from '../src/lib/customDrillStorage';
import { fetchDrillById, fetchFilterOptions } from '../src/lib/api';
import { colors, spacing, borderRadius } from '../src/theme/colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
  UIManager.setLayoutAnimationEnabledExperimental(true);

export default function DrillEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string; templateId?: string }>();

  const [tool, setTool] = useState<EditorState['tool']>('select');
  const [diagram, setDiagram] = useState<DiagramData>(getEmptyDiagram());
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [pendingActionFrom, setPendingActionFrom] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomDrillFormData>(getEmptyFormData());
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  // Collapsible sections
  const [toolsOpen, setToolsOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [canScroll, setCanScroll] = useState(true);

  // Load categories
  useEffect(() => { fetchFilterOptions().then(o => setCategories(o.categories)); }, []);

  // Load existing drill or template
  useEffect(() => {
    if (params.editId) {
      (async () => {
        const drill = await getCustomDrill(params.editId!);
        if (drill) { setDiagram(drill.diagramData); setFormData(drill.formData); setExistingId(drill.id); }
        else router.back();
      })();
    } else if (params.templateId) {
      setLoading(true);
      (async () => {
        try {
          const drill = await fetchDrillById(params.templateId!);
          if (drill) {
            setFormData({
              ...getEmptyFormData(),
              name: `${drill.name} (Copy)`,
              description: drill.description || '',
              category: drill.category || '',
              difficulty: (drill.difficulty?.toUpperCase() as any) || '',
              ageGroup: drill.age_group || '',
              playerCount: drill.player_count_display || '',
              duration: drill.duration ? `${drill.duration} min` : '',
              setupText: drill.setup || '',
              instructionsText: drill.instructions || '',
              coachingPointsText: drill.coaching_points || '',
              variationsText: drill.variations || '',
            });
            // Convert diagram_json to editor format
            const dj = drill.diagram_json;
            if (dj) {
              const newDiagram = getEmptyDiagram();
              if (dj.field) {
                newDiagram.field.type = dj.field.type || 'FULL';
                newDiagram.field.markings = dj.field.markings ?? dj.field.show_markings ?? true;
              }
              if (dj.players) newDiagram.players = dj.players.map((p, i) => ({ id: p.id || `P${i + 1}`, role: (p.role?.toUpperCase() as any) || 'NEUTRAL', position: p.position }));
              if (dj.cones) newDiagram.cones = dj.cones.map((c, i) => ({ id: `cone-${i}`, position: c.position }));
              if (dj.balls) newDiagram.balls = dj.balls.map((b, i) => ({ id: `ball-${i}`, position: b.position }));
              if (dj.goals) newDiagram.goals = dj.goals.map((g, i) => ({ id: `goal-${i}`, position: g.position, rotation: g.rotation || 0, size: g.size === 'small' ? 'mini' : 'full' }));
              if (dj.cone_lines) newDiagram.coneLines = dj.cone_lines.map((l, i) => ({ id: `line-${i}`, fromConeId: `cone-${l.from_cone}`, toConeId: `cone-${l.to_cone}` }));
              if (dj.actions) {
                newDiagram.actions = dj.actions.map((a, i) => {
                  if (a.type === 'PASS' && a.from_player && a.to_player) return { id: `act-${i}`, type: 'PASS' as const, fromPlayerId: a.from_player, toPlayerId: a.to_player };
                  if (a.player && a.to_position) return { id: `act-${i}`, type: a.type as any, playerId: a.player, toPosition: a.to_position };
                  return null;
                }).filter(Boolean) as any;
              }
              setDiagram(newDiagram);
            }
          }
        } catch {} finally { setLoading(false); }
      })();
    }
  }, [params.editId, params.templateId]);

  const handleDeleteSelected = useCallback(() => {
    if (!selectedEntity) return;
    if (selectedEntity.type === 'player') setDiagram(prev => ({ ...prev, players: prev.players.filter(p => p.id !== selectedEntity.id), actions: prev.actions.filter(a => { if (a.type === 'PASS') return a.fromPlayerId !== selectedEntity.id && a.toPlayerId !== selectedEntity.id; return a.playerId !== selectedEntity.id; }) }));
    else if (selectedEntity.type === 'cone') setDiagram(prev => ({ ...prev, cones: prev.cones.filter(c => c.id !== selectedEntity.id), coneLines: prev.coneLines.filter(l => l.fromConeId !== selectedEntity.id && l.toConeId !== selectedEntity.id) }));
    else if (selectedEntity.type === 'ball') setDiagram(prev => ({ ...prev, balls: prev.balls.filter(b => b.id !== selectedEntity.id) }));
    else if (selectedEntity.type === 'goal') setDiagram(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== selectedEntity.id) }));
    else if (selectedEntity.type === 'action') setDiagram(prev => ({ ...prev, actions: prev.actions.filter(a => a.id !== selectedEntity.id) }));
    else if (selectedEntity.type === 'coneline') setDiagram(prev => ({ ...prev, coneLines: prev.coneLines.filter(l => l.id !== selectedEntity.id) }));
    setSelectedEntity(null);
  }, [selectedEntity]);

  const handleSave = async () => {
    if (!formData.name.trim()) { Alert.alert('Name required', 'Enter a drill name before saving.'); return; }
    if (existingId) { await updateCustomDrill(existingId, formData, diagram); }
    else { const created = await saveCustomDrill(formData, diagram); setExistingId(created.id); }
    router.back();
  };

  const toggle = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter(v => !v);
  };

  const handleFormChange = (key: keyof CustomDrillFormData, value: string) => setFormData(prev => ({ ...prev, [key]: value }));

  if (loading) return (
    <SafeAreaView style={e.container} edges={['top']}><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.mutedForeground }}>Loading drill...</Text></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={e.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={e.header}>
        <TouchableOpacity onPress={() => router.back()} style={e.backBtn}><ArrowLeft size={22} color={colors.foreground} /></TouchableOpacity>
        <Text style={e.headerTitle}>{existingId ? 'Edit Drill' : 'Create Drill'}</Text>
        <TouchableOpacity style={e.saveHeaderBtn} onPress={handleSave}>
          <Save size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          scrollEnabled={canScroll}
          contentContainerStyle={e.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Canvas */}
          <DiagramCanvas
            diagram={diagram} tool={tool} selectedEntity={selectedEntity}
            pendingActionFrom={pendingActionFrom} onDiagramChange={setDiagram}
            onSelectEntity={setSelectedEntity} onPendingActionChange={setPendingActionFrom}
            onDragStateChange={(isDragging) => setCanScroll(!isDragging)}
          />

          {/* Tools - collapsible */}
          <TouchableOpacity style={e.sectionToggle} onPress={() => toggle(setToolsOpen)} activeOpacity={0.7}>
            <Text style={e.sectionToggleText}>Tools</Text>
            {toolsOpen ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
          </TouchableOpacity>
          {toolsOpen && (
            <View style={e.sectionBody}>
              <ToolsPanel activeTool={tool} onToolChange={setTool} pendingActionFrom={pendingActionFrom} />
            </View>
          )}

          {/* Properties - collapsible */}
          <TouchableOpacity style={e.sectionToggle} onPress={() => toggle(setPropsOpen)} activeOpacity={0.7}>
            <Text style={e.sectionToggleText}>Properties</Text>
            {propsOpen ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
          </TouchableOpacity>
          {propsOpen && (
            <View style={e.sectionBody}>
              <PropertiesPanel diagram={diagram} selectedEntity={selectedEntity} onDiagramChange={setDiagram} onDeleteSelected={handleDeleteSelected} />
            </View>
          )}

          {/* Drill Details - collapsible */}
          <TouchableOpacity style={e.sectionToggle} onPress={() => toggle(setDetailsOpen)} activeOpacity={0.7}>
            <Text style={e.sectionToggleText}>Drill Details</Text>
            {detailsOpen ? <ChevronUp size={16} color={colors.mutedForeground} /> : <ChevronDown size={16} color={colors.mutedForeground} />}
          </TouchableOpacity>
          {detailsOpen && (
            <View style={e.sectionBody}>
              <View style={e.formRow}>
                <View style={e.formField}><Text style={e.formLabel}>Drill Name *</Text><TextInput style={e.formInput} value={formData.name} onChangeText={v => handleFormChange('name', v)} placeholder="Enter drill name" placeholderTextColor={colors.mutedForeground} /></View>
              </View>
              <View style={e.formRow}>
                <View style={e.formField}><Text style={e.formLabel}>Category</Text><TextInput style={e.formInput} value={formData.category} onChangeText={v => handleFormChange('category', v)} placeholder="e.g., Possession" placeholderTextColor={colors.mutedForeground} /></View>
                <View style={e.formField}><Text style={e.formLabel}>Difficulty</Text><TextInput style={e.formInput} value={formData.difficulty} onChangeText={v => handleFormChange('difficulty', v)} placeholder="EASY/MEDIUM/HARD" placeholderTextColor={colors.mutedForeground} /></View>
              </View>
              <View style={e.formRow}>
                <View style={e.formField}><Text style={e.formLabel}>Age Group</Text><TextInput style={e.formInput} value={formData.ageGroup} onChangeText={v => handleFormChange('ageGroup', v)} placeholder="e.g., U12" placeholderTextColor={colors.mutedForeground} /></View>
                <View style={e.formField}><Text style={e.formLabel}>Players</Text><TextInput style={e.formInput} value={formData.playerCount} onChangeText={v => handleFormChange('playerCount', v)} placeholder="e.g., 6+" placeholderTextColor={colors.mutedForeground} /></View>
                <View style={e.formField}><Text style={e.formLabel}>Duration</Text><TextInput style={e.formInput} value={formData.duration} onChangeText={v => handleFormChange('duration', v)} placeholder="e.g., 15 min" placeholderTextColor={colors.mutedForeground} /></View>
              </View>
              <View style={e.formField}><Text style={e.formLabel}>Description</Text><TextInput style={[e.formInput, { height: 60 }]} value={formData.description} onChangeText={v => handleFormChange('description', v)} placeholder="Drill objective and flow..." placeholderTextColor={colors.mutedForeground} multiline /></View>
              <View style={e.formRow}>
                <View style={e.formField}><Text style={e.formLabel}>Setup</Text><TextInput style={[e.formInput, { height: 60 }]} value={formData.setupText} onChangeText={v => handleFormChange('setupText', v)} placeholder="How to set up..." placeholderTextColor={colors.mutedForeground} multiline /></View>
                <View style={e.formField}><Text style={e.formLabel}>Instructions</Text><TextInput style={[e.formInput, { height: 60 }]} value={formData.instructionsText} onChangeText={v => handleFormChange('instructionsText', v)} placeholder="Step-by-step..." placeholderTextColor={colors.mutedForeground} multiline /></View>
              </View>
              <View style={e.formRow}>
                <View style={e.formField}><Text style={e.formLabel}>Coaching Points</Text><TextInput style={[e.formInput, { height: 60 }]} value={formData.coachingPointsText} onChangeText={v => handleFormChange('coachingPointsText', v)} placeholder="Key teaching points..." placeholderTextColor={colors.mutedForeground} multiline /></View>
                <View style={e.formField}><Text style={e.formLabel}>Variations</Text><TextInput style={[e.formInput, { height: 60 }]} value={formData.variationsText} onChangeText={v => handleFormChange('variationsText', v)} placeholder="Alternative ways..." placeholderTextColor={colors.mutedForeground} multiline /></View>
              </View>
            </View>
          )}

          {/* Bottom actions */}
          <View style={e.bottomActions}>
            <TouchableOpacity style={e.clearBtn} onPress={() => { setDiagram(getEmptyDiagram()); setFormData(getEmptyFormData()); setSelectedEntity(null); setPendingActionFrom(null); }}>
              <Trash2 size={16} color={colors.foreground} /><Text style={e.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={e.saveBtn} onPress={handleSave}>
              <Save size={16} color={colors.primaryForeground} /><Text style={e.saveBtnText}>{existingId ? 'Update Drill' : 'Save Drill'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const e = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.foreground },
  saveHeaderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.sm },
  sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 12 },
  sectionToggleText: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  sectionBody: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderTopWidth: 0, borderBottomLeftRadius: borderRadius.md, borderBottomRightRadius: borderRadius.md, marginTop: -spacing.sm },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1, gap: 4, marginBottom: spacing.sm },
  formLabel: { fontSize: 11, fontWeight: '500', color: colors.mutedForeground },
  formInput: { backgroundColor: colors.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.sm, paddingVertical: 8, color: colors.foreground, fontSize: 13 },
  bottomActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  clearBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingVertical: 14 },
  clearBtnText: { fontSize: 14, fontWeight: '500', color: colors.foreground },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 14 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: colors.primaryForeground },
});
