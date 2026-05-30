import { Image } from 'expo-image';
import {
  Bookmark, BookmarkCheck,
  CalendarPlus,
  ClipboardList,
  Clock,
  Film, GraduationCap,
  Image as ImageIcon,
  Lightbulb,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { getCategoryColor, getDifficultyColor } from '../lib/api';
import { generateActivityId, getSessions, saveSession, updateSession } from '../lib/sessionStorage';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Drill } from '../types/drill';
import { Session, SessionActivity } from '../types/session';
import { DrillDiagramView } from './DrillDiagramView';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DrillDetailModalProps {
  drill: Drill | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved?: boolean;
  onSave?: (drill: Drill) => void;
  onUseAsTemplate?: (drill: Drill) => void;
  onAddToSession?: (drill: Drill) => void;
}

type TabKey = 'setup' | 'instructions' | 'variations' | 'coaching';

// ── Add to Session Modal ─────────────────────────────────────────────
interface AddToSessionModalProps {
  visible: boolean;
  drill: Drill;
  onClose: () => void;
}

function AddToSessionModal({ visible, drill, onClose }: AddToSessionModalProps) {
  const { colors: tc } = useTheme();
  const insets = useSafeAreaInsets();
  const s = create_ats(tc, insets.bottom);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'pick' | 'new'>('pick');
  const [newSessionName, setNewSessionName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('pick');
      setNewSessionName('');
      setLoading(true);
      getSessions().then(all => {
        all.sort((a, b) => {
          if (!a.session_date && !b.session_date) return 0;
          if (!a.session_date) return 1;
          if (!b.session_date) return -1;
          return b.session_date.localeCompare(a.session_date);
        });
        setSessions(all);
        setLoading(false);
      });
    }
  }, [visible]);

  const buildActivity = (): SessionActivity => {
    const isCustom = drill.source === 'custom';
    return {
      id: generateActivityId(),
      sort_order: 0,
      activity_type: isCustom ? 'custom_drill' : 'library_drill',
      library_drill_id: isCustom ? null : drill.id,
      custom_drill_id: isCustom ? drill.id : null,
      title: '',
      description: '',
      duration_minutes: typeof drill.duration === 'number' ? drill.duration : parseInt(String(drill.duration || '15')) || 15,
      activity_notes: '',
      drill_name: drill.name,
      drill_svg_url: drill.svg_url,
      drill_category: drill.category,
      drill_difficulty: drill.difficulty,
      drill_player_count: drill.player_count_display || String(drill.player_count || ''),
      drill_diagram_data: isCustom ? drill.raw_diagram_data : undefined,
      drill_setup: isCustom ? drill.setup : undefined,
      drill_instructions: isCustom ? drill.instructions : undefined,
    };
  };

  const addToExisting = async (session: Session) => {
    setSaving(true);
    const activity = buildActivity();
    const updated = [...session.activities, { ...activity, sort_order: session.activities.length }];
    await updateSession(session.id, { activities: updated });
    setSaving(false);
    onClose();
  };

  const createNew = async () => {
    const name = newSessionName.trim();
    if (!name) return;
    setSaving(true);
    const activity = buildActivity();
    await saveSession({
      title: name,
      session_date: '',
      session_time: '',
      team_name: '',
      session_goals: '',
      coach_notes: '',
      equipment: [],
      activities: [{ ...activity, sort_order: 0 }],
    });
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {/* Full-screen dim layer */}
      <Pressable style={s.backdrop} onPress={onClose} />

      {/* Sheet anchored to bottom */}
      <KeyboardAvoidingView
        style={s.kavWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <View style={[s.sheet, { paddingBottom: insets.bottom || 24 }]}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>{step === 'pick' ? 'Add to Session' : 'New Session'}</Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={tc.foreground} /></TouchableOpacity>
          </View>

          {step === 'pick' ? (
            <View style={s.pickContainer}>
              <TouchableOpacity style={s.newSessionBtn} onPress={() => setStep('new')}>
                <Plus size={18} color={tc.primaryForeground} />
                <Text style={s.newSessionBtnText}>New Session</Text>
              </TouchableOpacity>

              {loading ? (
                <ActivityIndicator size="small" color={tc.primary} style={{ marginTop: 24 }} />
              ) : sessions.length === 0 ? (
                <Text style={s.emptyText}>No existing sessions. Create a new one above.</Text>
              ) : (
                <>
                  <Text style={s.sectionLabel}>EXISTING SESSIONS</Text>
                  <ScrollView style={s.sessionList} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
                    {sessions.map(sess => (
                      <TouchableOpacity
                        key={sess.id}
                        style={s.sessionRow}
                        onPress={() => addToExisting(sess)}
                        disabled={saving}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={s.sessionName} numberOfLines={1}>{sess.title || 'Untitled Session'}</Text>
                          <Text style={s.sessionMeta}>
                            {sess.activities.length} activit{sess.activities.length === 1 ? 'y' : 'ies'}
                            {sess.session_date ? ` · ${sess.session_date}` : ''}
                          </Text>
                        </View>
                        <Plus size={16} color={tc.primary} />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
            </View>
          ) : (
            <View style={s.newStepBody}>
              <Text style={s.fieldLabel}>Session Name</Text>
              <TextInput
                style={s.input}
                value={newSessionName}
                onChangeText={setNewSessionName}
                placeholder="e.g., Tuesday Training"
                placeholderTextColor={tc.mutedForeground}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={createNew}
              />
              <View style={s.newFooter}>
                <TouchableOpacity style={s.backBtn} onPress={() => setStep('pick')}>
                  <Text style={s.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.createBtn, (!newSessionName.trim() || saving) && { opacity: 0.4 }]}
                  onPress={createNew}
                  disabled={!newSessionName.trim() || saving}
                >
                  <Text style={s.createBtnText}>{saving ? 'Creating...' : 'Create & Add'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function create_ats(tc: any, bottomInset: number = 0) { return StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  kavWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '85%' },
  sheet: { backgroundColor: tc.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, flex: 1 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: tc.border, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: tc.border },
  title: { fontSize: 17, fontWeight: '600', color: tc.foreground },
  pickContainer: { paddingHorizontal: spacing.md, paddingTop: spacing.md, flex: 1 },
  sessionList: { flex: 1 },
  newStepBody: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  newSessionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: tc.primary, borderRadius: borderRadius.md, paddingVertical: 14, marginBottom: spacing.md },
  newSessionBtnText: { fontSize: 14, fontWeight: '600', color: tc.primaryForeground },
  sectionLabel: { fontSize: 11, fontWeight: '600', color: tc.mutedForeground, letterSpacing: 1, marginBottom: spacing.sm },
  emptyText: { textAlign: 'center', color: tc.mutedForeground, fontSize: 13, paddingVertical: 24 },
  sessionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: tc.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: tc.border, paddingHorizontal: spacing.md, paddingVertical: 14, marginBottom: spacing.sm },
  sessionName: { fontSize: 14, fontWeight: '500', color: tc.foreground },
  sessionMeta: { fontSize: 11, color: tc.mutedForeground, marginTop: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: tc.foreground, marginBottom: spacing.xs },
  input: { backgroundColor: tc.card, borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.border, paddingHorizontal: spacing.sm, paddingVertical: 10, color: tc.foreground, fontSize: 14, marginBottom: spacing.md },
  newFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { paddingVertical: 10 },
  backBtnText: { fontSize: 14, color: tc.primary, fontWeight: '500' },
  createBtn: { backgroundColor: tc.primary, borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: spacing.lg },
  createBtnText: { fontSize: 14, fontWeight: '600', color: tc.primaryForeground },
}); };

export function DrillDetailModal({ drill, isOpen, onClose, isSaved = false, onSave, onUseAsTemplate, onAddToSession }: DrillDetailModalProps) {
  const { colors: tc } = useTheme();
  const s = create_s(tc);
  const [viewMode, setViewMode] = useState<'static' | 'animated'>('animated');
  const [activeTab, setActiveTab] = useState<TabKey>('setup');
  const [addToSessionVisible, setAddToSessionVisible] = useState(false);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
    }
  }, [isOpen]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const modalStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => { runOnJS(onClose)(); });
  };

  if (!drill) return null;

  const categoryColor = getCategoryColor(drill.category);
  const difficultyColor = getDifficultyColor(drill.difficulty);
  const hasAnimation = drill.has_animation && drill.animation_json && drill.animation_json.keyframes?.length >= 2;
  const hasDrillJson = !!drill.diagram_json;

  const hasSetup = !!drill.setup;
  const hasInstructions = !!drill.instructions;
  const hasVariations = !!drill.variations;
  const hasCoachingPoints = !!drill.coaching_points;
  const hasAnyContent = hasSetup || hasInstructions || hasVariations || hasCoachingPoints;

  const formatText = (text?: string) => {
    if (!text) return null;
    return text.split('\n').filter(l => l.trim()).map((line, index) => {
      const trimmed = line.trim();
      const isBullet = trimmed.startsWith('•') || trimmed.startsWith('*') || trimmed.startsWith('-');
      const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s*(.+)/);
      const content = isBullet ? trimmed.replace(/^[•*-]\s*/, '') : numberedMatch ? numberedMatch[2] : trimmed;
      if (isBullet || numberedMatch) {
        return <View key={index} style={s.bulletItem}><Text style={s.bulletPoint}>▸</Text><Text style={s.bulletText}>{content}</Text></View>;
      }
      return <Text key={index} style={s.paragraphText}>{trimmed}</Text>;
    });
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'setup': return formatText(drill.setup);
      case 'instructions': return formatText(drill.instructions);
      case 'variations': return formatText(drill.variations);
      case 'coaching': return formatText(drill.coaching_points);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[s.backdrop, backdropStyle]}><Pressable style={StyleSheet.absoluteFill} onPress={handleClose} /></Animated.View>
      <Animated.View style={[s.modalContainer, modalStyle]}>
        <View style={s.modal}>
          <View style={s.handleContainer}><View style={s.handle} /></View>
          <TouchableOpacity style={s.closeButton} onPress={handleClose}><X size={24} color={tc.foreground} /></TouchableOpacity>

          <ScrollView style={s.scrollView} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Title */}
            <Text style={s.title}>{drill.name}</Text>

            {/* Badges */}
            <View style={s.badgesRow}>
              {drill.category && <View style={[s.badge, { backgroundColor: categoryColor.bg }]}><Text style={[s.badgeText, { color: categoryColor.text }]}>{drill.category.toUpperCase()}</Text></View>}
              {drill.difficulty && <View style={[s.badge, { backgroundColor: difficultyColor.bg }]}><Text style={[s.badgeText, { color: difficultyColor.text }]}>{drill.difficulty.toUpperCase()}</Text></View>}
              {drill.player_count != null && <View style={s.badgeOutline}><Users size={12} color={tc.mutedForeground} /><Text style={s.badgeOutlineText}>{drill.player_count_display || `${drill.player_count}+`} players</Text></View>}
            </View>
            <View style={s.badgesRow}>
              {drill.duration != null && <View style={s.badgeOutline}><Clock size={12} color={tc.mutedForeground} /><Text style={s.badgeOutlineText}>{drill.duration} min</Text></View>}
              {drill.age_group && <View style={s.badgeOutline}><GraduationCap size={12} color={tc.mutedForeground} /><Text style={s.badgeOutlineText}>{drill.age_group}</Text></View>}
            </View>

            {/* Diagram Section */}
            <View style={s.diagramSection}>
              {/* Static/Animated Toggle */}
              {hasAnimation && (
                <View style={s.toggleContainer}>
                  <TouchableOpacity style={[s.toggleButton, viewMode === 'static' && s.toggleButtonActive]} onPress={() => setViewMode('static')}>
                    <ImageIcon size={16} color={viewMode === 'static' ? tc.primaryForeground : tc.mutedForeground} />
                    <Text style={[s.toggleText, viewMode === 'static' && s.toggleTextActive]}>Static</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.toggleButton, viewMode === 'animated' && s.toggleButtonActive]} onPress={() => setViewMode('animated')}>
                    <Film size={16} color={viewMode === 'animated' ? tc.primaryForeground : tc.mutedForeground} />
                    <Text style={[s.toggleText, viewMode === 'animated' && s.toggleTextActive]}>Animated</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Diagram Content */}
              {hasDrillJson ? (
                <DrillDiagramView
                  drillJson={drill.diagram_json!}
                  animationJson={hasAnimation && viewMode === 'animated' ? drill.animation_json : undefined}
                  mode={hasAnimation && viewMode === 'animated' ? 'animated' : 'static'}
                />
              ) : drill.svg_url ? (
                <View style={s.diagramContainer}>
                  <Image source={{ uri: drill.svg_url + '?v=19' }} style={s.diagramImage} contentFit="contain" transition={200} />
                </View>
              ) : (
                <View style={s.diagramPlaceholder}><Text style={s.diagramPlaceholderText}>No diagram available</Text></View>
              )}
            </View>

            {/* Overview */}
            {drill.description && (
              <View style={s.overviewSection}>
                <View style={s.sectionHeader}><Text style={s.sectionIcon}>📋</Text><Text style={s.sectionTitle}>Overview</Text></View>
                <Text style={s.overviewText}>{drill.description}</Text>
              </View>
            )}

            {/* Tabbed Content */}
            {hasAnyContent && (
              <View style={s.tabbedSection}>
                <View style={s.tabsHeader}>
                  {hasSetup && <TouchableOpacity style={[s.tab, activeTab === 'setup' && s.tabActive]} onPress={() => setActiveTab('setup')}><ClipboardList size={16} color={activeTab === 'setup' ? tc.foreground : tc.mutedForeground} /></TouchableOpacity>}
                  {hasInstructions && <TouchableOpacity style={[s.tab, activeTab === 'instructions' && s.tabActive]} onPress={() => setActiveTab('instructions')}><Play size={16} color={activeTab === 'instructions' ? tc.foreground : tc.mutedForeground} /></TouchableOpacity>}
                  {hasVariations && <TouchableOpacity style={[s.tab, activeTab === 'variations' && s.tabActive]} onPress={() => setActiveTab('variations')}><RefreshCw size={16} color={activeTab === 'variations' ? tc.foreground : tc.mutedForeground} /></TouchableOpacity>}
                  {hasCoachingPoints && <TouchableOpacity style={[s.tab, activeTab === 'coaching' && s.tabActive]} onPress={() => setActiveTab('coaching')}><Lightbulb size={16} color={activeTab === 'coaching' ? tc.foreground : tc.mutedForeground} /></TouchableOpacity>}
                </View>
                <View style={s.tabContent}>{getTabContent()}</View>
              </View>
            )}

            {/* Actions */}
            <View style={s.actionButtons}>
              {onSave && (
                <TouchableOpacity style={[s.actionButton, isSaved && s.actionButtonSecondary]} onPress={() => onSave?.(drill)}>
                  {isSaved ? <BookmarkCheck size={18} color={tc.foreground} /> : <Bookmark size={18} color={tc.primaryForeground} />}
                  <Text style={[s.actionButtonText, isSaved && s.actionButtonTextSecondary]}>{isSaved ? 'Saved' : 'Save to My Drills'}</Text>
                </TouchableOpacity>
              )}
              {onUseAsTemplate && (
                <TouchableOpacity style={s.actionButtonOutline} onPress={() => onUseAsTemplate(drill)}>
                  <Sparkles size={18} color={tc.primary} />
                  <Text style={s.actionButtonOutlineText}>Use as Template</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={s.addToSessionBtn} onPress={() => setAddToSessionVisible(true)}>
              <CalendarPlus size={18} color={tc.primaryForeground} />
              <Text style={s.addToSessionBtnText}>Add to Session</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Animated.View>
      {drill && (
        <AddToSessionModal
          visible={addToSessionVisible}
          drill={drill}
          onClose={() => setAddToSessionVisible(false)}
        />
      )}
    </Modal>
  );
}

function create_s(tc: any) { return StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: tc.background, borderTopLeftRadius: 0, borderTopRightRadius: 0, maxHeight: SCREEN_HEIGHT, minHeight: SCREEN_HEIGHT, paddingTop: 56 },
  handleContainer: { alignItems: 'center', paddingVertical: spacing.sm },
  handle: { width: 40, height: 4, backgroundColor: tc.border, borderRadius: 2 },
  closeButton: { position: 'absolute', top: 56 + spacing.sm, right: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: tc.card, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl + 40 },
  title: { fontSize: 24, fontWeight: '700', color: tc.foreground, marginBottom: spacing.md, paddingRight: 50 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeOutline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: tc.border },
  badgeOutlineText: { fontSize: 11, color: tc.mutedForeground },
  diagramSection: { marginTop: spacing.md, marginBottom: spacing.lg },
  toggleContainer: { flexDirection: 'row', backgroundColor: tc.card, borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.md, alignSelf: 'center' },
  toggleButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  toggleButtonActive: { backgroundColor: tc.primary },
  toggleText: { fontSize: 13, color: tc.mutedForeground, fontWeight: '500' },
  toggleTextActive: { color: tc.primaryForeground },
  diagramContainer: { aspectRatio: 4 / 3, backgroundColor: tc.card, borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: tc.border },
  diagramImage: { width: '100%', height: '100%' },
  diagramPlaceholder: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: tc.card, borderRadius: borderRadius.lg },
  diagramPlaceholderText: { color: tc.mutedForeground, fontSize: 14 },
  overviewSection: { backgroundColor: tc.primaryLight, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: tc.primaryLight },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: tc.foreground },
  overviewText: { fontSize: 14, lineHeight: 22, color: tc.mutedForeground },
  tabbedSection: { marginBottom: spacing.lg },
  tabsHeader: { flexDirection: 'row', backgroundColor: tc.card, borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  tabActive: { backgroundColor: tc.background },
  tabContent: { backgroundColor: tc.card, borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: tc.border },
  bulletItem: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  bulletPoint: { color: tc.primary, fontSize: 12, marginTop: 2 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 22, color: tc.foreground },
  paragraphText: { fontSize: 14, lineHeight: 22, color: tc.foreground, marginBottom: spacing.sm },
  actionButtons: { flexDirection: 'row', gap: spacing.md },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: tc.primary, paddingVertical: 14, borderRadius: borderRadius.md },
  actionButtonSecondary: { backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: tc.primaryForeground },
  actionButtonTextSecondary: { color: tc.foreground },
  actionButtonOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 14, borderRadius: borderRadius.md, borderWidth: 1, borderColor: tc.primary },
  actionButtonOutlineText: { fontSize: 14, fontWeight: '600', color: tc.primary },
  addToSessionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: tc.primary, paddingVertical: 14, borderRadius: borderRadius.md, marginTop: spacing.sm },
  addToSessionBtnText: { fontSize: 14, fontWeight: '600', color: tc.primaryForeground },
}); };
