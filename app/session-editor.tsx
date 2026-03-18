import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Library,
  Pencil,
  PenTool,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X
} from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCustomDrills } from '../src/lib/customDrillStorage';
import { generateActivityId, getSession, saveSession, updateSession } from '../src/lib/sessionStorage';
import { supabase } from '../src/lib/supabase';
import { borderRadius, spacing } from '../src/theme/colors';
import { useTheme } from '../src/theme/ThemeContext';
import { EquipmentItem, Session, SessionActivity } from '../src/types/session';


const emptySession = (): Omit<Session, 'id' | 'created_at' | 'updated_at'> => ({
  title: '', session_date: '', session_time: '', team_name: '',
  session_goals: '', coach_notes: '', equipment: [], activities: [],
});

// ── Date/Time Picker Modal ───────────────────────────────────────────
function PickerModal({ visible, mode, value, onConfirm, onCancel }: {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}) {
  const { colors: tc } = useTheme();
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    if (visible) setTempValue(value);
  }, [visible, value]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={pk.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={pk.modal}>
          <View style={pk.header}>
            <TouchableOpacity onPress={onCancel}>
              <Text style={pk.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={pk.title}>{mode === 'date' ? 'Select Date' : 'Select Time'}</Text>
            <TouchableOpacity onPress={() => onConfirm(tempValue)}>
              <Text style={pk.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={pk.pickerContainer}>
            <DateTimePicker
              value={tempValue}
              mode={mode}
              display="spinner"
              themeVariant="dark"
              onChange={(_, date) => { if (date) setTempValue(date); }}
              style={pk.picker}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pk = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#151823', borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingBottom: 30 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2a3142' },
  title: { fontSize: 16, fontWeight: '600', color: '#e8eaed' },
  cancelText: { fontSize: 15, color: '#8b919e' },
  doneText: { fontSize: 15, fontWeight: '600', color: '#4a9d6e' },
  pickerContainer: { alignItems: 'center', overflow: 'hidden', paddingHorizontal: spacing.md },
  picker: { width: '100%' },
});

// ── Add Activity Modal ──────────────────────────────────────────────
interface AddActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (activity: SessionActivity) => void;
  editingActivity?: SessionActivity | null;
}

interface DrillOption {
  id: string; name: string; category?: string; difficulty?: string;
  duration?: string; player_count?: string; svg_url?: string;
}

function AddActivityModal({ visible, onClose, onAdd, editingActivity }: AddActivityModalProps) {
  const { colors: tc } = useTheme();
  const [step, setStep] = useState<'choose' | 'library' | 'custom' | 'quick' | 'edit'>('choose');
  const [drills, setDrills] = useState<DrillOption[]>([]);
  const [customDrillOptions, setCustomDrillOptions] = useState<DrillOption[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<DrillOption | null>(null);
  const [duration, setDuration] = useState('10');
  const [notes, setNotes] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDesc, setQuickDesc] = useState('');

  useEffect(() => {
    if (visible) {
      if (editingActivity) {
        setDuration(String(editingActivity.duration_minutes));
        setNotes(editingActivity.activity_notes || '');
        if (editingActivity.activity_type === 'quick_activity') {
          setStep('quick');
          setQuickTitle(editingActivity.title);
          setQuickDesc(editingActivity.description);
        } else {
          setStep('edit');
        }
      } else {
        setStep('choose');
        setSelected(null);
        setDuration('10');
        setNotes('');
        setQuickTitle('');
        setQuickDesc('');
        setSearch('');
      }
    }
  }, [visible, editingActivity]);

  useEffect(() => {
    if (step === 'library' && drills.length === 0) {
      setLoading(true);
      supabase.from('drill_list')
        .select('id, name, category, difficulty, duration, player_count, svg_url')
        .order('name')
        .then(({ data }) => {
          setDrills((data || []).map((d: any) => ({
            id: d.id, name: d.name, category: d.category, difficulty: d.difficulty,
            duration: d.duration, player_count: d.player_count, svg_url: d.svg_url,
          })));
          setLoading(false);
        });
    }
  }, [step]);

  useEffect(() => {
    if (step === 'custom') {
      (async () => {
        const customs = await getCustomDrills();
        setCustomDrillOptions(customs.map(d => ({
          id: d.id,
          name: d.formData.name || 'Untitled',
          category: d.formData.category,
          difficulty: d.formData.difficulty,
          duration: d.formData.duration,
          player_count: d.formData.playerCount,
          svg_url: undefined,
        })));
      })();
    }
  }, [step]);

  const filtered = drills.filter(d => !search || d.name.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = () => {
    const dur = parseInt(duration) || 10;
    if (step === 'edit' && editingActivity) {
      onAdd({ ...editingActivity, duration_minutes: dur, activity_notes: notes });
    } else if (step === 'quick') {
      if (!quickTitle.trim()) return;
      onAdd({
        id: editingActivity?.id || generateActivityId(), sort_order: 0,
        activity_type: 'quick_activity', library_drill_id: null, custom_drill_id: null,
        title: quickTitle, description: quickDesc, duration_minutes: dur, activity_notes: notes,
      });
    } else if (selected) {
      const isLibrary = step === 'library';
      const isCustom = step === 'custom';
      onAdd({
        id: editingActivity?.id || generateActivityId(), sort_order: 0,
        activity_type: isCustom ? 'custom_drill' : 'library_drill',
        library_drill_id: isLibrary ? selected.id : null,
        custom_drill_id: isCustom ? selected.id : null,
        title: '', description: '', duration_minutes: dur, activity_notes: notes,
        drill_name: selected.name, drill_svg_url: selected.svg_url,
        drill_category: selected.category, drill_difficulty: selected.difficulty,
        drill_player_count: selected.player_count,
      });
    }
    onClose();
  };

  const canSubmit = step === 'edit' ? true : step === 'quick' ? !!quickTitle.trim() : !!selected;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={ms.backdrop}>
        <View style={ms.modal}>
          {/* Header */}
          <View style={ms.mHeader}>
            <Text style={ms.mTitle}>
              {editingActivity ? 'Edit Activity' : step === 'choose' ? 'Add Activity' : step === 'library' ? 'Drill Library' : step === 'quick' ? 'Quick Activity' : 'Edit Activity'}
            </Text>
            <TouchableOpacity onPress={onClose}><X size={20} color={tc.foreground} /></TouchableOpacity>
          </View>

          <ScrollView style={ms.mBody} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {step === 'choose' && (
              <View style={ms.chooseGrid}>
                <TouchableOpacity style={ms.chooseCard} onPress={() => setStep('library')}>
                  <Library size={24} color={tc.primary} />
                  <Text style={ms.chooseLabel}>From Library</Text>
                  <Text style={ms.chooseDesc}>Pick a drill from the library</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.chooseCard} onPress={() => setStep('quick')}>
                  <FileText size={24} color={tc.primary} />
                  <Text style={ms.chooseLabel}>Quick Activity</Text>
                  <Text style={ms.chooseDesc}>Create a custom activity</Text>
                </TouchableOpacity>
                <TouchableOpacity style={ms.chooseCard} onPress={() => setStep('custom')}>
                  <PenTool size={24} color={tc.primary} />
                  <Text style={ms.chooseLabel}>My Drills</Text>
                  <Text style={ms.chooseDesc}>Use a drill you created</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'library' && (
              <View style={{ gap: spacing.sm }}>
                <View style={ms.searchRow}>
                  <Search size={16} color={tc.mutedForeground} />
                  <TextInput style={ms.searchInput} placeholder="Search drills..." placeholderTextColor={tc.mutedForeground} value={search} onChangeText={setSearch} />
                </View>
                {loading ? (
                  <ActivityIndicator size="large" color={tc.primary} style={{ marginTop: 40 }} />
                ) : filtered.length === 0 ? (
                  <Text style={ms.emptyText}>No drills found</Text>
                ) : (
                  <View style={ms.drillGrid}>
                    {filtered.slice(0, 20).map(drill => (
                      <TouchableOpacity
                        key={drill.id}
                        style={[ms.drillCard, selected?.id === drill.id && ms.drillCardSelected]}
                        onPress={() => { setSelected(drill); setDuration(String(parseInt(drill.duration || '') || 15)); }}
                      >
                        {drill.svg_url && (
                          <View style={ms.drillImg}>
                            <Image source={{ uri: drill.svg_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                          </View>
                        )}
                        <View style={{ padding: spacing.sm }}>
                          <Text style={ms.drillName} numberOfLines={1}>{drill.name}</Text>
                          <Text style={ms.drillMeta}>{drill.difficulty}{drill.duration ? ` · ${drill.duration}` : ''}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {selected && (
                  <View style={ms.detailSection}>
                    <Text style={ms.fieldLabel}>Duration (minutes)</Text>
                    <TextInput style={ms.fieldInput} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
                    <Text style={ms.fieldLabel}>Notes (optional)</Text>
                    <TextInput style={[ms.fieldInput, { height: 60 }]} value={notes} onChangeText={setNotes} placeholder="Coaching notes..." placeholderTextColor={tc.mutedForeground} multiline />
                  </View>
                )}
              </View>
            )}

            {step === 'custom' && (
              <View style={{ gap: spacing.sm }}>
                {customDrillOptions.length === 0 ? (
                  <Text style={ms.emptyText}>No custom drills yet</Text>
                ) : (
                  <View style={ms.drillGrid}>
                    {customDrillOptions.map(drill => (
                      <TouchableOpacity
                        key={drill.id}
                        style={[ms.drillCard, selected?.id === drill.id && ms.drillCardSelected]}
                        onPress={() => { setSelected(drill); setDuration(String(parseInt(drill.duration || '') || 15)); }}
                      >
                        <View style={[ms.drillImg, { justifyContent: 'center', alignItems: 'center' }]}>
                          <PenTool size={20} color="rgba(255,255,255,0.5)" />
                        </View>
                        <View style={{ padding: spacing.sm }}>
                          <Text style={ms.drillName} numberOfLines={1}>{drill.name}</Text>
                          <Text style={ms.drillMeta}>{drill.difficulty}{drill.duration ? ` · ${drill.duration}` : ''}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {selected && (
                  <View style={ms.detailSection}>
                    <Text style={ms.fieldLabel}>Duration (minutes)</Text>
                    <TextInput style={ms.fieldInput} value={duration} onChangeText={setDuration} keyboardType="number-pad" />
                    <Text style={ms.fieldLabel}>Notes (optional)</Text>
                    <TextInput style={[ms.fieldInput, { height: 60 }]} value={notes} onChangeText={setNotes} placeholder="Coaching notes..." placeholderTextColor={tc.mutedForeground} multiline />
                  </View>
                )}
              </View>
            )}

            {step === 'quick' && (
              <View style={{ gap: spacing.md }}>
                <View><Text style={ms.fieldLabel}>Activity Title</Text><TextInput style={ms.fieldInput} value={quickTitle} onChangeText={setQuickTitle} placeholder="e.g., Warm-up, 4v4 Game" placeholderTextColor={tc.mutedForeground} /></View>
                <View><Text style={ms.fieldLabel}>Description</Text><TextInput style={[ms.fieldInput, { height: 80 }]} value={quickDesc} onChangeText={setQuickDesc} placeholder="Describe the activity..." placeholderTextColor={tc.mutedForeground} multiline /></View>
                <View><Text style={ms.fieldLabel}>Duration (minutes)</Text><TextInput style={[ms.fieldInput, { width: 100 }]} value={duration} onChangeText={setDuration} keyboardType="number-pad" /></View>
                <View><Text style={ms.fieldLabel}>Notes (optional)</Text><TextInput style={[ms.fieldInput, { height: 60 }]} value={notes} onChangeText={setNotes} placeholder="Private coaching notes..." placeholderTextColor={tc.mutedForeground} multiline /></View>
              </View>
            )}

            {step === 'edit' && editingActivity && (
              <View style={{ gap: spacing.md }}>
                <View style={ms.editDrillInfo}>
                  <Text style={ms.editDrillName}>{editingActivity.drill_name || editingActivity.title || 'Activity'}</Text>
                  {editingActivity.drill_difficulty && <Text style={ms.editDrillMeta}>{editingActivity.drill_difficulty}</Text>}
                </View>
                <View><Text style={ms.fieldLabel}>Duration (minutes)</Text><TextInput style={[ms.fieldInput, { width: 100 }]} value={duration} onChangeText={setDuration} keyboardType="number-pad" /></View>
                <View><Text style={ms.fieldLabel}>Notes (optional)</Text><TextInput style={[ms.fieldInput, { height: 60 }]} value={notes} onChangeText={setNotes} placeholder="Coaching notes..." placeholderTextColor={tc.mutedForeground} multiline /></View>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={ms.mFooter}>
            {step !== 'choose' && step !== 'edit' ? (
              <TouchableOpacity onPress={() => { setStep('choose'); setSelected(null); setSearch(''); }}>
                <Text style={ms.backText}>← Back</Text>
              </TouchableOpacity>
            ) : <View />}
            <TouchableOpacity style={[ms.submitBtn, !canSubmit && { opacity: 0.4 }]} onPress={handleSubmit} disabled={!canSubmit}>
              <Text style={ms.submitText}>{editingActivity ? 'Update' : 'Add Activity'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Activity Card ───────────────────────────────────────────────────
function ActivityCard({ activity, index, startTime, onMoveUp, onMoveDown, onEdit, onDelete, isFirst, isLast }: {
  activity: SessionActivity; index: number; startTime: number;
  onMoveUp: () => void; onMoveDown: () => void; onEdit: () => void; onDelete: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const { colors: tc } = useTheme();
  const title = activity.title || activity.drill_name || 'Untitled';
  const formatMin = (m: number) => { const h = Math.floor(m / 60); const mm = m % 60; return `${h}:${mm.toString().padStart(2, '0')}`; };

  return (
    <View style={ac.card}>
      <View style={ac.topRow}>
        <View style={ac.timeline}>
          <Text style={ac.timeText}>{formatMin(startTime)}</Text>
          <View style={ac.dot} />
        </View>
        <View style={ac.info}>
          <Text style={ac.title} numberOfLines={1}>{title}</Text>
          <View style={ac.metaRow}>
            <Clock size={12} color={tc.mutedForeground} />
            <Text style={ac.meta}>{activity.duration_minutes} min</Text>
            {activity.drill_difficulty && <Text style={ac.meta}>· {activity.drill_difficulty}</Text>}
          </View>
        </View>
        <View style={ac.actions}>
          <TouchableOpacity onPress={onMoveUp} disabled={isFirst} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <ChevronUp size={18} color={isFirst ? tc.border : tc.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onMoveDown} disabled={isLast} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <ChevronDown size={18} color={isLast ? tc.border : tc.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Pencil size={14} color={tc.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Trash2 size={14} color={tc.destructive} />
          </TouchableOpacity>
        </View>
      </View>
      {activity.drill_svg_url && (
        <View style={ac.diagramWrap}>
          <Image source={{ uri: activity.drill_svg_url }} style={ac.diagram} contentFit="contain" />
        </View>
      )}
      {activity.description ? <Text style={ac.desc} numberOfLines={2}>{activity.description}</Text> : null}
      {activity.activity_notes ? (
        <View style={ac.notesRow}><StickyNote size={12} color={tc.primary} /><Text style={ac.notesText}>{activity.activity_notes}</Text></View>
      ) : null}
    </View>
  );
}

// ── Main Session Editor ─────────────────────────────────────────────
export default function SessionEditorScreen() {
  const router = useRouter();
  const { colors: tc, isDark } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const isNew = !params.id;

  const [session, setSession] = useState(emptySession());
  const [activities, setActivities] = useState<SessionActivity[]>([]);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<SessionActivity | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [newEquipName, setNewEquipName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    if (!isNew && params.id) {
      (async () => {
        const existing = await getSession(params.id!);
        if (existing) {
          setSession(existing);
          setActivities(existing.activities || []);
          setEquipment(existing.equipment || []);
          setExistingId(existing.id);
        } else {
          router.back();
        }
      })();
    }
  }, [params.id]);

  const totalDuration = useMemo(() => activities.reduce((s, a) => s + a.duration_minutes, 0), [activities]);
  const calcStart = (i: number) => activities.slice(0, i).reduce((s, a) => s + a.duration_minutes, 0);

  const moveActivity = (from: number, to: number) => {
    if (to < 0 || to >= activities.length) return;
    const updated = [...activities];
    const [item] = updated.splice(from, 1);
    updated.splice(to, 0, item);
    setActivities(updated.map((a, i) => ({ ...a, sort_order: i })));
  };

  const handleAddActivity = (activity: SessionActivity) => {
    if (editingActivity) {
      setActivities(prev => prev.map(a => a.id === editingActivity.id ? { ...activity, sort_order: a.sort_order } : a));
      setEditingActivity(null);
    } else {
      setActivities(prev => [...prev, { ...activity, sort_order: prev.length }]);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = { ...session, equipment, activities };
      if (existingId) {
        await updateSession(existingId, data);
      } else {
        const created = await saveSession(data);
        setExistingId(created.id);
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to save session');
    } finally { setSaving(false); }
  };

  const datePickerValue = session.session_date
    ? new Date(session.session_date + 'T00:00:00')
    : new Date();

  const timePickerValue = session.session_time
    ? (() => { const [h, m] = session.session_time.split(':'); const d = new Date(); d.setHours(parseInt(h), parseInt(m)); return d; })()
    : new Date();

  return (
    <SafeAreaView style={[s.container, { backgroundColor: tc.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tc.background} />
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}><ArrowLeft size={22} color={tc.foreground} /></TouchableOpacity>
        <Text style={s.headerTitle}>{isNew ? 'New Session' : 'Edit Session'}</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Session Details */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>SESSION DETAILS</Text>
            <View style={s.fieldGroup}><Text style={s.label}>Title</Text><TextInput style={s.input} value={session.title} onChangeText={v => setSession({...session, title: v})} placeholder="e.g., Tuesday U12 Training" placeholderTextColor={tc.mutedForeground} /></View>
            <View style={s.fieldGroup}><Text style={s.label}>Team / Group</Text><TextInput style={s.input} value={session.team_name} onChangeText={v => setSession({...session, team_name: v})} placeholder="e.g., U12 Boys" placeholderTextColor={tc.mutedForeground} /></View>
            <View style={s.row}>
              <View style={[s.fieldGroup, { flex: 1 }]}>
                <Text style={s.label}>Date</Text>
                <TouchableOpacity style={s.input} onPress={() => { setShowTimePicker(false); setShowDatePicker(true); }}>
                  <Text style={{ color: session.session_date ? tc.foreground : tc.mutedForeground, fontSize: 14 }}>
                    {session.session_date || 'Select date'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={[s.fieldGroup, { flex: 1 }]}>
                <Text style={s.label}>Time</Text>
                <TouchableOpacity style={s.input} onPress={() => { setShowDatePicker(false); setShowTimePicker(true); }}>
                  <Text style={{ color: session.session_time ? tc.foreground : tc.mutedForeground, fontSize: 14 }}>
                    {session.session_time || 'Select time'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.fieldGroup}><Text style={s.label}>Session Goals</Text><TextInput style={[s.input, { height: 60 }]} value={session.session_goals} onChangeText={v => setSession({...session, session_goals: v})} placeholder="What do you want to achieve?" placeholderTextColor={tc.mutedForeground} multiline /></View>
          </View>

          {/* Activities */}
          <View style={s.section}>
            <View style={s.sectionHeader}><Text style={s.sectionTitle}>ACTIVITIES</Text><Text style={s.sectionMeta}>{totalDuration} min</Text></View>
            {activities.length === 0 ? (
              <Text style={s.emptyText}>No activities yet. Add your first below.</Text>
            ) : (
              activities.map((act, i) => (
                <ActivityCard key={act.id} activity={act} index={i} startTime={calcStart(i)}
                  onMoveUp={() => moveActivity(i, i - 1)} onMoveDown={() => moveActivity(i, i + 1)}
                  onEdit={() => { setEditingActivity(act); setShowAddModal(true); }}
                  onDelete={() => setActivities(prev => prev.filter(a => a.id !== act.id))}
                  isFirst={i === 0} isLast={i === activities.length - 1} />
              ))
            )}
            <TouchableOpacity style={s.addDashed} onPress={() => { setEditingActivity(null); setShowAddModal(true); }}>
              <Plus size={16} color={tc.mutedForeground} /><Text style={s.addDashedText}>Add Activity</Text>
            </TouchableOpacity>
          </View>

          {/* Equipment */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>EQUIPMENT</Text>
            {equipment.length > 0 && (
              <View style={s.equipList}>
                {equipment.map((item, i) => (
                  <View key={i} style={s.equipChip}>
                    <Text style={s.equipText}>{item.name}{item.quantity > 0 ? ` (${item.quantity})` : ''}</Text>
                    <TouchableOpacity onPress={() => setEquipment(prev => prev.filter((_, idx) => idx !== i))}><X size={14} color={tc.mutedForeground} /></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <View style={s.equipAdd}>
              <TextInput style={[s.input, { flex: 1 }]} value={newEquipName} onChangeText={setNewEquipName} placeholder="Add equipment..." placeholderTextColor={tc.mutedForeground} />
              <TouchableOpacity style={s.equipAddBtn} onPress={() => { if (newEquipName.trim()) { setEquipment(prev => [...prev, { name: newEquipName.trim(), quantity: 0, checked: false }]); setNewEquipName(''); } }}>
                <Text style={s.equipAddBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Coach Notes */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>COACH NOTES</Text>
            <TextInput style={[s.input, { height: 80 }]} value={session.coach_notes} onChangeText={v => setSession({...session, coach_notes: v})} placeholder="Private notes..." placeholderTextColor={tc.mutedForeground} multiline />
          </View>

          {/* Save */}
          <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.5 }]} onPress={handleSave} disabled={saving}>
            <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save Session'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal */}
      <PickerModal
        visible={showDatePicker}
        mode="date"
        value={datePickerValue}
        onCancel={() => setShowDatePicker(false)}
        onConfirm={(date) => {
          setShowDatePicker(false);
          const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, '0'), d = String(date.getDate()).padStart(2, '0');
          setSession({ ...session, session_date: `${y}-${m}-${d}` });
        }}
      />

      {/* Time Picker Modal */}
      <PickerModal
        visible={showTimePicker}
        mode="time"
        value={timePickerValue}
        onCancel={() => setShowTimePicker(false)}
        onConfirm={(date) => {
          setShowTimePicker(false);
          const hh = String(date.getHours()).padStart(2, '0');
          const mm = String(date.getMinutes()).padStart(2, '0');
          setSession({ ...session, session_time: `${hh}:${mm}` });
        }}
      />

      <AddActivityModal visible={showAddModal} onClose={() => { setShowAddModal(false); setEditingActivity(null); }} onAdd={handleAddActivity} editingActivity={editingActivity} />
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151823' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2a3142' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#e8eaed' },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  section: { backgroundColor: '#1e2433', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#2a3142', padding: spacing.md, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: '#8b919e', letterSpacing: 1 },
  sectionMeta: { fontSize: 12, color: '#8b919e' },
  fieldGroup: { gap: spacing.xs },
  label: { fontSize: 12, fontWeight: '500', color: '#e8eaed' },
  input: { backgroundColor: '#151823', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: '#2a3142', paddingHorizontal: spacing.sm, paddingVertical: 10, color: '#e8eaed', fontSize: 14 },
  row: { flexDirection: 'row', gap: spacing.sm },
  emptyText: { textAlign: 'center', color: '#8b919e', fontSize: 13, paddingVertical: spacing.lg },
  addDashed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#2a3142', borderRadius: borderRadius.md, paddingVertical: 12, marginTop: spacing.sm },
  addDashedText: { fontSize: 13, color: '#8b919e' },
  equipList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  equipChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: '#151823', borderRadius: borderRadius.md, paddingHorizontal: spacing.sm, paddingVertical: 6, borderWidth: 1, borderColor: '#2a3142' },
  equipText: { fontSize: 13, color: '#e8eaed' },
  equipAdd: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  equipAddBtn: { backgroundColor: '#1e2433', borderWidth: 1, borderColor: '#2a3142', borderRadius: borderRadius.sm, paddingHorizontal: spacing.md, justifyContent: 'center' },
  equipAddBtnText: { fontSize: 13, color: '#e8eaed', fontWeight: '500' },
  saveBtn: { backgroundColor: '#4a9d6e', borderRadius: borderRadius.md, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
});

const ac = StyleSheet.create({
  card: { backgroundColor: '#151823', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#2a3142', padding: spacing.sm, marginBottom: spacing.sm },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  timeline: { alignItems: 'center', paddingTop: 2 },
  timeText: { fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#8b919e', marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#4a9d6e' },
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#e8eaed' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { fontSize: 11, color: '#8b919e' },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingTop: 2 },
  diagramWrap: { width: '100%', aspectRatio: 16 / 10, borderRadius: borderRadius.sm, overflow: 'hidden', marginTop: spacing.sm, backgroundColor: '#63b043' },
  diagram: { width: '100%', height: '100%' },
  desc: { fontSize: 13, color: '#8b919e', marginTop: spacing.xs },
  notesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.xs, backgroundColor: 'rgba(139,145,158,0.08)', borderRadius: borderRadius.sm, padding: spacing.xs },
  notesText: { flex: 1, fontSize: 12, color: '#8b919e' },
});

const ms = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#151823', borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, maxHeight: '90%' },
  mHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2a3142' },
  mTitle: { fontSize: 17, fontWeight: '600', color: '#e8eaed' },
  mBody: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  mFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderTopWidth: 1, borderTopColor: '#2a3142' },
  backText: { fontSize: 14, color: '#4a9d6e', fontWeight: '500' },
  submitBtn: { backgroundColor: '#4a9d6e', borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: spacing.lg },
  submitText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  chooseGrid: { gap: spacing.md },
  chooseCard: { backgroundColor: '#1e2433', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#2a3142', padding: spacing.lg, gap: spacing.xs },
  chooseLabel: { fontSize: 15, fontWeight: '600', color: '#e8eaed' },
  chooseDesc: { fontSize: 13, color: '#8b919e' },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e2433', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#2a3142', paddingHorizontal: spacing.sm, height: 40, gap: spacing.xs },
  searchInput: { flex: 1, color: '#e8eaed', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#8b919e', fontSize: 13, paddingVertical: 40 },
  drillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  drillCard: { width: '48%', borderRadius: borderRadius.md, borderWidth: 2, borderColor: '#2a3142', overflow: 'hidden', backgroundColor: '#1e2433' },
  drillCardSelected: { borderColor: '#4a9d6e' },
  drillImg: { width: '100%', aspectRatio: 4 / 3 },
  drillName: { fontSize: 13, fontWeight: '500', color: '#e8eaed' },
  drillMeta: { fontSize: 10, color: '#8b919e', marginTop: 2 },
  detailSection: { borderTopWidth: 1, borderTopColor: '#2a3142', paddingTop: spacing.md, marginTop: spacing.md, gap: spacing.sm },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: '#e8eaed', marginBottom: 4 },
  fieldInput: { backgroundColor: '#1e2433', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: '#2a3142', paddingHorizontal: spacing.sm, paddingVertical: 10, color: '#e8eaed', fontSize: 14 },
  editDrillInfo: { backgroundColor: '#1e2433', borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#2a3142', padding: spacing.md },
  editDrillName: { fontSize: 15, fontWeight: '600', color: '#e8eaed' },
  editDrillMeta: { fontSize: 12, color: '#8b919e', marginTop: 4 },
});
