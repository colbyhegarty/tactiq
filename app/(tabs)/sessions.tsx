import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Edit, Plus, Trash2, Users, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Modal, Pressable,
  ScrollView, StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteSession, duplicateSession, getSessions } from '../../src/lib/sessionStorage';
import { borderRadius, colors, spacing } from '../../src/theme/colors';
import { Session } from '../../src/types/session';

// ── Calendar helpers ─────────────────────────────────────────────────
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ── Calendar Modal ───────────────────────────────────────────────────
function CalendarModal({
  visible, onClose, onSelectDate, selectedDate, sessionDates,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectDate: (date: string | null) => void;
  selectedDate: string | null;
  sessionDates: Set<string>;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={cal.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={cal.modal}>
          {/* Month nav */}
          <View style={cal.monthRow}>
            <TouchableOpacity onPress={prevMonth} style={cal.monthBtn}>
              <ChevronLeft size={20} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={cal.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={cal.monthBtn}>
              <ChevronRight size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={cal.weekRow}>
            {DAYS_OF_WEEK.map(d => (
              <View key={d} style={cal.weekCell}>
                <Text style={cal.weekText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <View style={cal.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={cal.dayCell} />;
              const dateStr = toDateStr(viewYear, viewMonth, day);
              const isSelected = dateStr === selectedDate;
              const isToday = dateStr === todayStr;
              const hasSession = sessionDates.has(dateStr);

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[cal.dayCell, isSelected && cal.dayCellSelected]}
                  onPress={() => { onSelectDate(isSelected ? null : dateStr); onClose(); }}
                >
                  <Text style={[
                    cal.dayText,
                    isToday && cal.dayTextToday,
                    isSelected && cal.dayTextSelected,
                  ]}>
                    {day}
                  </Text>
                  {hasSession && !isSelected && <View style={cal.dot} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Clear filter */}
          {selectedDate && (
            <TouchableOpacity style={cal.clearBtn} onPress={() => { onSelectDate(null); onClose(); }}>
              <Text style={cal.clearText}>Clear Filter</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────

export default function SessionsScreen() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const router = useRouter();

  useFocusEffect(useCallback(() => { loadSessions(); }, []));

  const loadSessions = async () => {
    const sess = await getSessions();
    setSessions(sess.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  };

  const handleDelete = (id: string, title: string) => {
    Alert.alert('Delete Session', `Delete "${title || 'Untitled Session'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
      }},
    ]);
  };

  const handleDuplicate = async (id: string) => {
    const dup = await duplicateSession(id);
    if (dup) setSessions(prev => [dup, ...prev]);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  // Set of dates that have sessions (for calendar dots)
  const sessionDates = useMemo(() => {
    const s = new Set<string>();
    sessions.forEach(sess => { if (sess.session_date) s.add(sess.session_date); });
    return s;
  }, [sessions]);

  const displayedSessions = filterDate
    ? sessions.filter(s => s.session_date === filterDate)
    : sessions;

  const renderSessionCard = (session: Session) => {
    const totalDuration = session.activities.reduce((sum, a) => sum + a.duration_minutes, 0);
    const activityCount = session.activities.length;

    return (
      <TouchableOpacity
        key={session.id}
        style={st.sessionCard}
        onPress={() => router.push({ pathname: '/session-view', params: { id: session.id } })}
        activeOpacity={0.7}
      >
        <View style={st.cardHeader}>
          <Text style={st.cardTitle} numberOfLines={1}>{session.title || 'Untitled Session'}</Text>
          <View style={st.cardActions}>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.push({ pathname: '/session-editor', params: { id: session.id } })}>
              <Edit size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => handleDuplicate(session.id)}>
              <Copy size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => handleDelete(session.id, session.title)}>
              <Trash2 size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={st.cardMeta}>
          {session.session_date ? (
            <View style={st.metaRow}>
              <Calendar size={14} color={colors.mutedForeground} />
              <Text style={st.metaText}>{formatDate(session.session_date)}{session.session_time ? ` at ${session.session_time}` : ''}</Text>
            </View>
          ) : null}
          {session.team_name ? (
            <View style={st.metaRow}><Users size={14} color={colors.mutedForeground} /><Text style={st.metaText}>{session.team_name}</Text></View>
          ) : null}
          <View style={st.metaRow}>
            <Clock size={14} color={colors.mutedForeground} />
            <Text style={st.metaText}>{activityCount} {activityCount === 1 ? 'activity' : 'activities'} · {totalDuration} min</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <View style={st.logoContainer}><CalendarDays size={20} color={colors.primaryForeground} /></View>
          <Text style={st.headerTitle}>My Sessions</Text>
        </View>
        <View style={st.headerRight}>
          <TouchableOpacity style={[st.headerBtn, filterDate && st.headerBtnActive]} onPress={() => setCalendarOpen(true)}>
            <Calendar size={22} color={filterDate ? colors.primaryForeground : colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={st.headerBtn} onPress={() => router.push('/session-editor')}>
            <Plus size={22} color={colors.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Active filter banner */}
      {filterDate && (
        <View style={st.filterBanner}>
          <Calendar size={14} color={colors.primary} />
          <Text style={st.filterText}>{formatDisplayDate(filterDate)}</Text>
          <TouchableOpacity onPress={() => setFilterDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={st.scrollView} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
        {displayedSessions.length === 0 ? (
          <View style={st.emptyState}>
            <View style={st.emptyIcon}><CalendarDays size={32} color={colors.mutedForeground} /></View>
            <Text style={st.emptyTitle}>{filterDate ? 'No sessions on this day' : 'No sessions yet'}</Text>
            <Text style={st.emptySubtitle}>{filterDate ? 'Try selecting a different date' : 'Create your first training session'}</Text>
            {!filterDate && (
              <TouchableOpacity style={st.createButton} onPress={() => router.push('/session-editor')}>
                <Plus size={16} color={colors.primaryForeground} /><Text style={st.createButtonText}>Create Session</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {displayedSessions.map(renderSessionCard)}
            <TouchableOpacity style={st.createOutlineButton} onPress={() => router.push('/session-editor')}>
              <Plus size={16} color={colors.foreground} /><Text style={st.createOutlineText}>Create New Session</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Calendar Modal */}
      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        onSelectDate={setFilterDate}
        selectedDate={filterDate}
        sessionDates={sessionDates}
      />
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoContainer: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  headerBtnActive: { backgroundColor: colors.primary },
  filterBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: 'rgba(74,157,110,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(74,157,110,0.25)' },
  filterText: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.primary },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 120 },
  sessionCard: { backgroundColor: colors.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { fontSize: 17, fontWeight: '600', color: colors.foreground, flex: 1, marginRight: spacing.sm },
  cardActions: { flexDirection: 'row', gap: spacing.md },
  cardMeta: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: 13, color: colors.mutedForeground },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 3 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: 14, color: colors.mutedForeground, marginBottom: spacing.lg },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md },
  createButtonText: { fontSize: 14, fontWeight: '600', color: colors.primaryForeground },
  createOutlineButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.lg, paddingVertical: 14, marginTop: spacing.md },
  createOutlineText: { fontSize: 14, fontWeight: '500', color: colors.foreground },
});

const cal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: colors.background, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, width: '88%', padding: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekText: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 3 },
  dayCellSelected: { backgroundColor: colors.primary, borderRadius: 20 },
  dayText: { fontSize: 14, color: colors.foreground },
  dayTextToday: { color: colors.primary, fontWeight: '700' },
  dayTextSelected: { color: colors.primaryForeground, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary },
  clearBtn: { alignSelf: 'center', marginTop: spacing.md, paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border },
  clearText: { fontSize: 13, color: colors.mutedForeground },
});
