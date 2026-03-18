import { useFocusEffect, useRouter } from 'expo-router';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight, Clock, Copy, Edit, Plus, Trash2, Users, X } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, LayoutAnimation, Platform, ScrollView, StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteSession, duplicateSession, getSessions } from '../../src/lib/sessionStorage';
import { borderRadius, spacing } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';
import { Session } from '../../src/types/session';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

// ── Inline Calendar ─────────────────────────────────────────────────
function InlineCalendar({
  onSelectDate, selectedDate, sessionDates,
}: {
  onSelectDate: (date: string | null) => void;
  selectedDate: string | null;
  sessionDates: Set<string>;
}) {
  const today = new Date();
  const { colors: tc } = useTheme();
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
    <View style={cal.container}>
      {/* Month nav */}
      <View style={cal.monthRow}>
        <TouchableOpacity onPress={prevMonth} style={cal.monthBtn}>
          <ChevronLeft size={20} color={tc.foreground} />
        </TouchableOpacity>
        <Text style={cal.monthLabel}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
        <TouchableOpacity onPress={nextMonth} style={cal.monthBtn}>
          <ChevronRight size={20} color={tc.foreground} />
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
              onPress={() => onSelectDate(isSelected ? null : dateStr)}
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
        <TouchableOpacity style={cal.clearBtn} onPress={() => onSelectDate(null)}>
          <Text style={cal.clearText}>Clear Filter</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main Screen ─────────────────────────────────────────────────────

export default function SessionsScreen() {
  const { colors: tc, isDark } = useTheme();
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

  const toggleCalendar = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalendarOpen(prev => !prev);
  };

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
              <Edit size={16} color={tc.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => handleDuplicate(session.id)}>
              <Copy size={16} color={tc.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => handleDelete(session.id, session.title)}>
              <Trash2 size={16} color={tc.destructive} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={st.cardMeta}>
          {session.session_date ? (
            <View style={st.metaRow}>
              <Calendar size={14} color={tc.mutedForeground} />
              <Text style={st.metaText}>{formatDate(session.session_date)}{session.session_time ? ` at ${session.session_time}` : ''}</Text>
            </View>
          ) : null}
          {session.team_name ? (
            <View style={st.metaRow}><Users size={14} color={tc.mutedForeground} /><Text style={st.metaText}>{session.team_name}</Text></View>
          ) : null}
          <View style={st.metaRow}>
            <Clock size={14} color={tc.mutedForeground} />
            <Text style={st.metaText}>{activityCount} {activityCount === 1 ? 'activity' : 'activities'} · {totalDuration} min</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[st.container, { backgroundColor: tc.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tc.background} />

      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <View style={st.logoContainer}><CalendarDays size={20} color={tc.primaryForeground} /></View>
          <Text style={st.headerTitle}>My Sessions</Text>
        </View>
        <View style={st.headerRight}>
          <TouchableOpacity style={[st.headerBtn, (calendarOpen || filterDate) && st.headerBtnActive]} onPress={toggleCalendar}>
            <Calendar size={22} color={(calendarOpen || filterDate) ? tc.primaryForeground : tc.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={st.headerBtn} onPress={() => router.push('/session-editor')}>
            <Plus size={22} color={tc.foreground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Inline Calendar */}
      {calendarOpen && (
        <InlineCalendar
          onSelectDate={setFilterDate}
          selectedDate={filterDate}
          sessionDates={sessionDates}
        />
      )}

      {/* Active filter banner (shown when calendar is collapsed but filter is active) */}
      {filterDate && !calendarOpen && (
        <View style={st.filterBanner}>
          <Calendar size={14} color={tc.primary} />
          <Text style={st.filterText}>{formatDisplayDate(filterDate)}</Text>
          <TouchableOpacity onPress={() => setFilterDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={tc.primary} />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={st.scrollView} contentContainerStyle={st.scrollContent} showsVerticalScrollIndicator={false}>
        {displayedSessions.length === 0 ? (
          <View style={st.emptyState}>
            <View style={st.emptyIcon}><CalendarDays size={32} color={tc.mutedForeground} /></View>
            <Text style={st.emptyTitle}>{filterDate ? 'No sessions on this day' : 'No sessions yet'}</Text>
            <Text style={st.emptySubtitle}>{filterDate ? 'Try selecting a different date' : 'Create your first training session'}</Text>
            {!filterDate && (
              <TouchableOpacity style={st.createButton} onPress={() => router.push('/session-editor')}>
                <Plus size={16} color={tc.primaryForeground} /><Text style={st.createButtonText}>Create Session</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {displayedSessions.map(renderSessionCard)}
            <TouchableOpacity style={st.createOutlineButton} onPress={() => router.push('/session-editor')}>
              <Plus size={16} color={tc.foreground} /><Text style={st.createOutlineText}>Create New Session</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151823' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#2a3142' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoContainer: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: '#4a9d6e', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#e8eaed' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  headerBtnActive: { backgroundColor: '#4a9d6e' },
  filterBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: 'rgba(74,157,110,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(74,157,110,0.25)' },
  filterText: { flex: 1, fontSize: 13, fontWeight: '500', color: '#4a9d6e' },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 120 },
  sessionCard: { backgroundColor: '#1e2433', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#2a3142', padding: spacing.md, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#e8eaed', flex: 1, marginRight: spacing.sm },
  cardActions: { flexDirection: 'row', gap: spacing.md },
  cardMeta: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: 13, color: '#8b919e' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 3 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1e2433', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#e8eaed', marginBottom: spacing.xs },
  emptySubtitle: { fontSize: 14, color: '#8b919e', marginBottom: spacing.lg },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: '#4a9d6e', paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md },
  createButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  createOutlineButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#2a3142', borderRadius: borderRadius.lg, paddingVertical: 14, marginTop: spacing.md },
  createOutlineText: { fontSize: 14, fontWeight: '500', color: '#e8eaed' },
});

const cal = StyleSheet.create({
  container: { backgroundColor: '#1e2433', borderBottomWidth: 1, borderBottomColor: '#2a3142', paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '600', color: '#e8eaed' },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekText: { fontSize: 11, fontWeight: '600', color: '#8b919e' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 3 },
  dayCellSelected: { backgroundColor: '#4a9d6e', borderRadius: 20 },
  dayText: { fontSize: 14, color: '#e8eaed' },
  dayTextToday: { color: '#4a9d6e', fontWeight: '700' },
  dayTextSelected: { color: '#ffffff', fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#4a9d6e' },
  clearBtn: { alignSelf: 'center', marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#2a3142' },
  clearText: { fontSize: 13, color: '#8b919e' },
});
