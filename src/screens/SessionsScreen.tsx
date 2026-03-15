import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Pressable,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Plus, Calendar, Clock, Users, ChevronLeft, ChevronRight, X, Target,
} from 'lucide-react-native';
import { Session } from '../types/session';
import { getSessions } from '../lib/sessionStorage'; // <-- adjust if your function is named differently
import { colors, spacing, borderRadius } from '../theme/colors';

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

function formatDisplayDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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

// ── Session Card ─────────────────────────────────────────────────────
function SessionCard({ session, onPress }: { session: Session; onPress: () => void }) {
  const totalMin = session.activities.reduce((s, a) => s + a.duration_minutes, 0);
  const dateDisplay = session.session_date
    ? new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.7}>
      <View style={sc.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={sc.title} numberOfLines={1}>{session.title || 'Untitled Session'}</Text>
          <View style={sc.metaRow}>
            {dateDisplay && (
              <View style={sc.metaChip}>
                <Calendar size={11} color={colors.mutedForeground} />
                <Text style={sc.metaText}>{dateDisplay}</Text>
              </View>
            )}
            {session.session_time && (
              <View style={sc.metaChip}>
                <Clock size={11} color={colors.mutedForeground} />
                <Text style={sc.metaText}>{session.session_time}</Text>
              </View>
            )}
            {session.team_name ? (
              <View style={sc.metaChip}>
                <Users size={11} color={colors.mutedForeground} />
                <Text style={sc.metaText}>{session.team_name}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {totalMin > 0 && (
          <View style={sc.durBadge}>
            <Text style={sc.durText}>{totalMin} min</Text>
          </View>
        )}
      </View>
      {session.activities.length > 0 && (
        <Text style={sc.actCount}>
          {session.activities.length} activit{session.activities.length === 1 ? 'y' : 'ies'}
        </Text>
      )}
      {session.session_goals ? (
        <View style={sc.goalsRow}>
          <Target size={11} color={colors.primary} />
          <Text style={sc.goalsText} numberOfLines={2}>{session.session_goals}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────
export default function SessionsScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterDate, setFilterDate] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      const all = await getSessions(); // <-- adjust if named differently
      // Sort newest first
      all.sort((a, b) => {
        if (a.session_date && b.session_date) return b.session_date.localeCompare(a.session_date);
        if (a.session_date) return -1;
        if (b.session_date) return 1;
        return b.created_at.localeCompare(a.created_at);
      });
      setSessions(all);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Reload every time the tab comes into focus
  useFocusEffect(useCallback(() => { loadSessions(); }, [loadSessions]));

  const onRefresh = () => { setRefreshing(true); loadSessions(); };

  // Set of dates that have sessions (for calendar dots)
  const sessionDates = useMemo(() => {
    const s = new Set<string>();
    sessions.forEach(sess => { if (sess.session_date) s.add(sess.session_date); });
    return s;
  }, [sessions]);

  // Filter by selected date
  const displayed = useMemo(() => {
    if (!filterDate) return sessions;
    return sessions.filter(s => s.session_date === filterDate);
  }, [sessions, filterDate]);

  return (
    <SafeAreaView style={st.container} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <Text style={st.headerTitle}>Sessions</Text>
        <View style={st.headerActions}>
          <TouchableOpacity
            style={[st.iconBtn, filterDate && st.iconBtnActive]}
            onPress={() => setCalendarOpen(true)}
          >
            <Calendar size={20} color={filterDate ? colors.primaryForeground : colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={st.addBtn}
            onPress={() => router.push('/session-editor')}
          >
            <Plus size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Active filter indicator */}
      {filterDate && (
        <View style={st.filterBar}>
          <Text style={st.filterText}>{formatDisplayDate(filterDate)}</Text>
          <TouchableOpacity onPress={() => setFilterDate(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      ) : displayed.length === 0 ? (
        <View style={st.empty}>
          <Text style={st.emptyTitle}>{filterDate ? 'No sessions on this day' : 'No sessions yet'}</Text>
          <Text style={st.emptyDesc}>
            {filterDate ? 'Try selecting a different date or clear the filter.' : 'Create your first training session to get started.'}
          </Text>
          {!filterDate && (
            <TouchableOpacity style={st.emptyBtn} onPress={() => router.push('/session-editor')}>
              <Plus size={16} color={colors.primaryForeground} />
              <Text style={st.emptyBtnText}>New Session</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              onPress={() => router.push({ pathname: '/session-view', params: { id: item.id } })}
            />
          )}
        />
      )}

      {/* Calendar modal */}
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

// ── Styles ───────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  iconBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  filterBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    backgroundColor: 'rgba(74,157,110,0.1)', borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: 'rgba(74,157,110,0.25)',
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  filterText: { fontSize: 13, fontWeight: '500', color: colors.primary },
  list: { padding: spacing.md, paddingBottom: 120, gap: spacing.sm },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground, marginBottom: spacing.xs },
  emptyDesc: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: 12, paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: colors.primaryForeground },
});

const sc = StyleSheet.create({
  card: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm,
  },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  title: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, color: colors.mutedForeground },
  durBadge: {
    backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  durText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  actCount: { fontSize: 12, color: colors.mutedForeground },
  goalsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  goalsText: { flex: 1, fontSize: 12, color: colors.mutedForeground, lineHeight: 18 },
});

const cal = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: {
    backgroundColor: colors.background, borderRadius: borderRadius.xl,
    borderWidth: 1, borderColor: colors.border,
    width: '88%', padding: spacing.md,
  },
  monthRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  monthBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  monthLabel: { fontSize: 16, fontWeight: '600', color: colors.foreground },
  weekRow: { flexDirection: 'row', marginBottom: spacing.xs },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  weekText: { fontSize: 11, fontWeight: '600', color: colors.mutedForeground },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, gap: 3,
  },
  dayCellSelected: { backgroundColor: colors.primary, borderRadius: 20 },
  dayText: { fontSize: 14, color: colors.foreground },
  dayTextToday: { color: colors.primary, fontWeight: '700' },
  dayTextSelected: { color: colors.primaryForeground, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.primary },
  clearBtn: {
    alignSelf: 'center', marginTop: spacing.md,
    paddingVertical: 8, paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
  },
  clearText: { fontSize: 13, color: colors.mutedForeground },
});
