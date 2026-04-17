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
import { usePaywallGate, PaywallModal } from '../../src/subscription';
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
  const st = create_st(tc);
  const cal = create_cal(tc);
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
  const st = create_st(tc);
  const cal = create_cal(tc);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const router = useRouter();
  const { gate, paywallVisible, paywallReason, dismissPaywall } = usePaywallGate();

  useFocusEffect(useCallback(() => { loadSessions(); }, []));

  const loadSessions = async () => {
    const sess = await getSessions();
    setSessions(sess.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  };

  /** Gated session creation — free users can only have 1 session */
  const handleCreateSession = async () => {
    const allowed = await gate('create_session');
    if (!allowed) return;
    router.push('/session-editor');
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
    const allowed = await gate('create_session');
    if (!allowed) return;
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
          <TouchableOpacity style={st.headerBtn} onPress={handleCreateSession}>
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
              <TouchableOpacity style={st.createButton} onPress={handleCreateSession}>
                <Plus size={16} color={tc.primaryForeground} /><Text style={st.createButtonText}>Create Session</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {displayedSessions.map(renderSessionCard)}
            <TouchableOpacity style={st.createOutlineButton} onPress={handleCreateSession}>
              <Plus size={16} color={tc.foreground} /><Text style={st.createOutlineText}>Create New Session</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <PaywallModal
        visible={paywallVisible}
        onDismiss={dismissPaywall}
        reason={paywallReason}
      />
    </SafeAreaView>
  );
}

function create_st(tc: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: tc.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoContainer: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: tc.primary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: tc.foreground },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  headerBtnActive: { backgroundColor: tc.primary },
  filterBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: tc.primaryLight, borderBottomWidth: 1, borderBottomColor: 'rgba(74,157,110,0.25)' },
  filterText: { flex: 1, fontSize: 13, fontWeight: '500', color: tc.primary },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.md, paddingBottom: 120 },
  sessionCard: { backgroundColor: tc.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: tc.border, padding: spacing.md, marginBottom: spacing.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardTitle: { fontSize: 17, fontWeight: '600', color: tc.foreground, flex: 1, marginRight: spacing.sm },
  cardActions: { flexDirection: 'row', gap: spacing.md },
  cardMeta: { gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  metaText: { fontSize: 13, color: tc.mutedForeground },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 3 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: tc.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: tc.foreground, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: 14, color: tc.mutedForeground, marginBottom: spacing.lg },
  createButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: tc.primary, paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md },
  createButtonText: { fontSize: 14, fontWeight: '600', color: tc.primaryForeground },
  createOutlineButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: tc.border, borderRadius: borderRadius.lg, paddingVertical: 14, marginTop: spacing.md },
  createOutlineText: { fontSize: 14, fontWeight: '500', color: tc.foreground },
}); };

function create_cal(tc: any) { return StyleSheet.create({
  container: { backgroundColor: tc.card, borderBottomWidth: 1, borderBottomColor: tc.border, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '600', color: tc.foreground },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekText: { fontSize: 11, fontWeight: '600', color: tc.mutedForeground },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 3 },
  dayCellSelected: { backgroundColor: tc.primary, borderRadius: 20 },
  dayText: { fontSize: 14, color: tc.foreground },
  dayTextToday: { color: tc.primary, fontWeight: '700' },
  dayTextSelected: { color: tc.primaryForeground, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: tc.primary },
  clearBtn: { alignSelf: 'center', marginTop: spacing.sm, paddingVertical: 8, paddingHorizontal: spacing.lg, borderRadius: borderRadius.md, borderWidth: 1, borderColor: tc.border },
  clearText: { fontSize: 13, color: tc.mutedForeground },
}); };
