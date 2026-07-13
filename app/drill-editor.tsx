import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, Save, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiagramCanvas } from '../src/components/editor/DiagramCanvas';
import { PropertiesPanel } from '../src/components/editor/PropertiesPanel';
import { ToolsPanel } from '../src/components/editor/ToolsPanel';
import { track, trackScreen } from '../src/lib/analytics';
import { DIFFICULTIES, fetchDrillById, fetchFilterOptions } from '../src/lib/api';
import { getCustomDrill, getEmptyDiagram, getEmptyFormData, saveCustomDrill, updateCustomDrill } from '../src/lib/customDrillStorage';
import { borderRadius, spacing } from '../src/theme/colors';
import { useTheme } from '../src/theme/ThemeContext';
import {
  CustomDrillFormData,
  DiagramData,
  EditorState, SelectedEntity,
} from '../src/types/customDrill';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
  UIManager.setLayoutAnimationEnabledExperimental(true);

export default function DrillEditorScreen() {
  const router = useRouter();
  const { colors: tc, isDark } = useTheme();
  const e = create_e(tc);
  const params = useLocalSearchParams<{ editId?: string; templateId?: string }>();

  const [tool, setTool] = useState<EditorState['tool']>('select');
  const [diagram, setDiagramRaw] = useState<DiagramData>(getEmptyDiagram());
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [pendingActionFrom, setPendingActionFrom] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomDrillFormData>(getEmptyFormData());
  const [existingId, setExistingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [dropdownField, setDropdownField] = useState<'category' | 'difficulty' | null>(null);

  // Undo history — stores previous diagram states (max 50)
  const undoStack = useRef<DiagramData[]>([]);
  const isDragging = useRef(false);
  const dragStartDiagram = useRef<DiagramData | null>(null);

  const setDiagram = useCallback((next: DiagramData | ((prev: DiagramData) => DiagramData)) => {
    setDiagramRaw(prev => {
      const nextVal = typeof next === 'function' ? next(prev) : next;
      // During drag, only capture the state at drag start (not every move)
      if (isDragging.current) {
        if (!dragStartDiagram.current) {
          dragStartDiagram.current = prev;
        }
      } else {
        undoStack.current = [...undoStack.current.slice(-49), prev];
      }
      return nextVal;
    });
  }, []);

  const handleDragStateChange = useCallback((dragging: boolean) => {
    if (dragging) {
      isDragging.current = true;
      dragStartDiagram.current = null;
    } else {
      // Push the pre-drag state to undo when drag ends
      if (dragStartDiagram.current) {
        undoStack.current = [...undoStack.current.slice(-49), dragStartDiagram.current];
        dragStartDiagram.current = null;
      }
      isDragging.current = false;
    }
    setCanScroll(!dragging);
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    setDiagramRaw(prev);
    setSelectedEntity(null);
    setPendingActionFrom(null);
  }, []);

  // Collapsible sections
  const [toolsOpen, setToolsOpen] = useState(false);
  const [propsOpen, setPropsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [canScroll, setCanScroll] = useState(true);

  // Load categories
  useEffect(() => { fetchFilterOptions().then(o => setCategories(o.categories)); }, []);

  useEffect(() => {
    trackScreen('DrillEditor');
    track('drill_editor_opened', { mode: params.editId ? 'edit' : 'create' });
  }, []);

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

                // If half-field with markings, check that all entities fit in the zoomed range (x=25..75, y=50..100)
                // If any entity is outside, fall back to full field view
                if (newDiagram.field.type === 'HALF' && newDiagram.field.markings) {
                  const allPositions: {x: number, y: number}[] = [];
                  dj.players?.forEach(p => allPositions.push(p.position));
                  dj.cones?.forEach(c => allPositions.push(c.position));
                  dj.balls?.forEach(b => allPositions.push(b.position));
                  dj.goals?.forEach(g => allPositions.push(g.position));
                  dj.mini_goals?.forEach(g => allPositions.push(g.position));
                  dj.actions?.forEach(a => { if (a.to_position) allPositions.push(a.to_position); });

                  const fitsInHalf = allPositions.every(p =>
                    p.x >= 23 && p.x <= 77 && p.y >= 48
                  );
                  if (!fitsInHalf) {
                    newDiagram.field.type = 'FULL';
                  }
                }
              }
              if (dj.players) newDiagram.players = dj.players.map((p, i) => ({ id: p.id || `P${i + 1}`, role: (p.role?.toUpperCase() as any) || 'NEUTRAL', position: p.position }));
              if (dj.cones) newDiagram.cones = dj.cones.map((c, i) => ({ id: `cone-${i}`, position: c.position }));
              if (dj.balls) newDiagram.balls = dj.balls.map((b, i) => ({ id: `ball-${i}`, position: b.position }));
              if (dj.goals) newDiagram.goals = dj.goals.map((g, i) => ({ id: `goal-${i}`, position: g.position, rotation: g.rotation || 0, size: g.size === 'small' ? 'mini' : 'full' }));
              if (dj.mini_goals) newDiagram.goals = [
                ...(newDiagram.goals || []),
                ...dj.mini_goals.map((g, i) => {
                  const displayRot = g.rotation || 0;
                  const storedRot = (displayRot + 180) % 360;
                  const markings = dj.field?.markings ?? dj.field?.show_markings ?? true;
                  const d = -(markings ? 2 * (3/4) : 2); // matches DrillDiagramView mgScale
                  let { x, y } = g.position;
                  if (displayRot === 0)        y = y + d;
                  else if (displayRot === 90)  x = x + d;
                  else if (displayRot === 180) y = y - d;
                  else                         x = x - d;
                  return { id: `minigoal-${i}`, position: { x, y }, rotation: storedRot, size: 'mini' as const };
                }),
              ];
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
    if (existingId) { await updateCustomDrill(existingId, formData, diagram);
      track('drill_updated', { drill_id: existingId, name: formData.name });
     }
    else { const created = await saveCustomDrill(formData, diagram); setExistingId(created.id);
      track('drill_created', { field_type: diagram.field.type, name: formData.name });
     }
    router.back();
  };

  const toggle = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter(v => !v);
  };

  const handleFormChange = (key: keyof CustomDrillFormData, value: string) => setFormData(prev => ({ ...prev, [key]: value }));

  if (loading) return (
    <SafeAreaView style={[e.container, { backgroundColor: tc.background }]} edges={['top']}><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: tc.mutedForeground }}>Loading drill...</Text></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={[e.container, { backgroundColor: tc.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tc.background} />
      <View style={e.header}>
        <TouchableOpacity onPress={() => router.back()} style={e.backBtn}><ArrowLeft size={22} color={tc.foreground} /></TouchableOpacity>
        <Text style={e.headerTitle}>{existingId ? 'Edit Drill' : 'Create Drill'}</Text>
        <TouchableOpacity style={e.saveHeaderBtn} onPress={handleSave}>
          <Save size={18} color={tc.primaryForeground} />
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
            pendingActionFrom={pendingActionFrom} snapToGrid={snapToGrid}
            onDiagramChange={setDiagram}
            onSelectEntity={setSelectedEntity} onPendingActionChange={setPendingActionFrom}
            onDragStateChange={handleDragStateChange}
          />

          {/* Tools - collapsible */}
          <TouchableOpacity style={[e.sectionToggle, toolsOpen && e.sectionToggleOpen]} onPress={() => toggle(setToolsOpen)} activeOpacity={0.7}>
            <Text style={e.sectionToggleText}>Tools</Text>
            {toolsOpen ? <ChevronUp size={16} color={tc.mutedForeground} /> : <ChevronDown size={16} color={tc.mutedForeground} />}
          </TouchableOpacity>
          {toolsOpen && (
            <View style={e.sectionBody}>
              <View style={e.sectionBodyInner}>
                <ToolsPanel activeTool={tool} onToolChange={setTool} pendingActionFrom={pendingActionFrom} snapToGrid={snapToGrid} onSnapToggle={() => setSnapToGrid(v => !v)} canUndo={undoStack.current.length > 0} onUndo={handleUndo} />
              </View>
            </View>
          )}

          {/* Properties - collapsible */}
          <TouchableOpacity style={[e.sectionToggle, propsOpen && e.sectionToggleOpen]} onPress={() => toggle(setPropsOpen)} activeOpacity={0.7}>
            <Text style={e.sectionToggleText}>Properties</Text>
            {propsOpen ? <ChevronUp size={16} color={tc.mutedForeground} /> : <ChevronDown size={16} color={tc.mutedForeground} />}
          </TouchableOpacity>
          {propsOpen && (
            <View style={e.sectionBody}>
              <View style={e.sectionBodyInner}>
                <PropertiesPanel diagram={diagram} selectedEntity={selectedEntity} onDiagramChange={setDiagram} onDeleteSelected={handleDeleteSelected} />
              </View>
            </View>
          )}

          {/* Drill Details - collapsible */}
          <TouchableOpacity style={[e.sectionToggle, detailsOpen && e.sectionToggleOpen]} onPress={() => toggle(setDetailsOpen)} activeOpacity={0.7}>
            <Text style={e.sectionToggleText}>Drill Details</Text>
            {detailsOpen ? <ChevronUp size={16} color={tc.mutedForeground} /> : <ChevronDown size={16} color={tc.mutedForeground} />}
          </TouchableOpacity>
          {detailsOpen && (
            <View style={e.sectionBody}>
              <View style={e.sectionBodyInner}>
                <View style={e.formRow}>
                  <View style={e.formField}><Text style={e.formLabel}>Drill Name *</Text><TextInput style={e.formInput} value={formData.name} onChangeText={v => handleFormChange('name', v)} placeholder="Enter drill name" placeholderTextColor={tc.mutedForeground} /></View>
                </View>
                <View style={e.formRow}>
                  <View style={e.formField}>
                    <Text style={e.formLabel}>Category</Text>
                    <TouchableOpacity style={e.formDropdown} onPress={() => setDropdownField('category')} activeOpacity={0.7}>
                      <Text style={formData.category ? e.formDropdownText : e.formDropdownPlaceholder} numberOfLines={1}>
                        {formData.category || 'Select category'}
                      </Text>
                      <ChevronDown size={14} color={tc.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  <View style={e.formField}>
                    <Text style={e.formLabel}>Difficulty</Text>
                    <TouchableOpacity style={e.formDropdown} onPress={() => setDropdownField('difficulty')} activeOpacity={0.7}>
                      <Text style={formData.difficulty ? e.formDropdownText : e.formDropdownPlaceholder} numberOfLines={1}>
                        {formData.difficulty ? formData.difficulty.charAt(0) + formData.difficulty.slice(1).toLowerCase() : 'Select difficulty'}
                      </Text>
                      <ChevronDown size={14} color={tc.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={e.formRow}>
                  <View style={e.formField}><Text style={e.formLabel}>Age Group</Text><TextInput style={e.formInput} value={formData.ageGroup} onChangeText={v => handleFormChange('ageGroup', v)} placeholder="e.g., U12" placeholderTextColor={tc.mutedForeground} /></View>
                  <View style={e.formField}><Text style={e.formLabel}>Players</Text><TextInput style={e.formInput} value={formData.playerCount} onChangeText={v => handleFormChange('playerCount', v)} placeholder="e.g., 6+" placeholderTextColor={tc.mutedForeground} /></View>
                  <View style={e.formField}><Text style={e.formLabel}>Duration</Text><TextInput style={e.formInput} value={formData.duration} onChangeText={v => handleFormChange('duration', v)} placeholder="e.g., 15 min" placeholderTextColor={tc.mutedForeground} /></View>
                </View>
                <View style={e.formField}><Text style={e.formLabel}>Description</Text><TextInput style={[e.formInput, e.formTextArea]} value={formData.description} onChangeText={v => handleFormChange('description', v)} placeholder="Drill objective and flow..." placeholderTextColor={tc.mutedForeground} multiline textAlignVertical="top" /></View>
                <View style={e.formField}><Text style={e.formLabel}>Setup</Text><TextInput style={[e.formInput, e.formTextArea]} value={formData.setupText} onChangeText={v => handleFormChange('setupText', v)} placeholder="How to set up..." placeholderTextColor={tc.mutedForeground} multiline textAlignVertical="top" /></View>
                <View style={e.formField}><Text style={e.formLabel}>Instructions</Text><TextInput style={[e.formInput, e.formTextArea]} value={formData.instructionsText} onChangeText={v => handleFormChange('instructionsText', v)} placeholder="Step-by-step..." placeholderTextColor={tc.mutedForeground} multiline textAlignVertical="top" /></View>
                <View style={e.formField}><Text style={e.formLabel}>Coaching Points</Text><TextInput style={[e.formInput, e.formTextArea]} value={formData.coachingPointsText} onChangeText={v => handleFormChange('coachingPointsText', v)} placeholder="Key teaching points..." placeholderTextColor={tc.mutedForeground} multiline textAlignVertical="top" /></View>
                <View style={e.formField}><Text style={e.formLabel}>Variations</Text><TextInput style={[e.formInput, e.formTextArea]} value={formData.variationsText} onChangeText={v => handleFormChange('variationsText', v)} placeholder="Alternative ways..." placeholderTextColor={tc.mutedForeground} multiline textAlignVertical="top" /></View>
              </View>
            </View>
          )}

          {/* Bottom actions */}
          <View style={e.bottomActions}>
            <TouchableOpacity style={e.clearBtn} onPress={() => { setDiagram(getEmptyDiagram()); setFormData(getEmptyFormData()); setSelectedEntity(null); setPendingActionFrom(null); }}>
              <Trash2 size={16} color={tc.foreground} /><Text style={e.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={e.saveBtn} onPress={handleSave}>
              <Save size={16} color={tc.primaryForeground} /><Text style={e.saveBtnText}>{existingId ? 'Update Drill' : 'Save Drill'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Dropdown picker modal */}
      <Modal visible={dropdownField !== null} transparent animationType="fade" onRequestClose={() => setDropdownField(null)}>
        <Pressable style={e.dropdownBackdrop} onPress={() => setDropdownField(null)}>
          <View style={e.dropdownSheet}>
            <Text style={e.dropdownTitle}>
              {dropdownField === 'category' ? 'Select Category' : 'Select Difficulty'}
            </Text>
            {dropdownField === 'category' && (
              <FlatList
                data={categories}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[e.dropdownItem, formData.category === item && e.dropdownItemActive]}
                    onPress={() => { handleFormChange('category', item); setDropdownField(null); }}
                  >
                    <Text style={[e.dropdownItemText, formData.category === item && e.dropdownItemTextActive]}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
            {dropdownField === 'difficulty' && (
              <FlatList
                data={DIFFICULTIES}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[e.dropdownItem, formData.difficulty === item && e.dropdownItemActive]}
                    onPress={() => { handleFormChange('difficulty', item); setDropdownField(null); }}
                  >
                    <Text style={[e.dropdownItemText, formData.difficulty === item && e.dropdownItemTextActive]}>
                      {item.charAt(0) + item.slice(1).toLowerCase()}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function create_e(tc: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: tc.border },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: tc.foreground },
  saveHeaderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: tc.primary, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.md, paddingBottom: 120, gap: 0 },
  sectionToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: 12, marginTop: spacing.sm },
  sectionToggleOpen: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  sectionToggleText: { fontSize: 14, fontWeight: '600', color: tc.foreground },
  sectionBody: { backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: borderRadius.md, borderBottomRightRadius: borderRadius.md, marginTop: -1 },
  sectionBodyInner: { padding: spacing.md },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  formField: { flex: 1, gap: 4, marginBottom: spacing.sm },
  formLabel: { fontSize: 11, fontWeight: '500', color: tc.mutedForeground },
  formInput: { backgroundColor: tc.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.border, paddingHorizontal: spacing.sm, paddingVertical: 8, color: tc.foreground, fontSize: 13 },
  formDropdown: { backgroundColor: tc.background, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.border, paddingHorizontal: spacing.sm, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  formDropdownText: { color: tc.foreground, fontSize: 13, flex: 1 },
  formDropdownPlaceholder: { color: tc.mutedForeground, fontSize: 13, flex: 1 },
  formTextArea: { height: 80, paddingTop: 8 },
  dropdownBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  dropdownSheet: { backgroundColor: tc.card, borderRadius: borderRadius.lg, width: '100%', maxHeight: 400, overflow: 'hidden', borderWidth: 1, borderColor: tc.border },
  dropdownTitle: { fontSize: 15, fontWeight: '600', color: tc.foreground, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  dropdownItem: { paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.border },
  dropdownItemActive: { backgroundColor: tc.primaryLight || tc.primary + '20' },
  dropdownItemText: { fontSize: 14, color: tc.foreground },
  dropdownItemTextActive: { color: tc.primary, fontWeight: '600' },
  bottomActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.lg },
  clearBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: tc.border, borderRadius: borderRadius.md, paddingVertical: 14 },
  clearBtnText: { fontSize: 14, fontWeight: '500', color: tc.foreground },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: tc.primary, borderRadius: borderRadius.md, paddingVertical: 14 },
  saveBtnText: { fontSize: 14, fontWeight: '600', color: tc.primaryForeground },
}); };
