import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Calendar,
  Clipboard,
  Clock,
  Edit, Eye,
  ListChecks,
  Play,
  StickyNote,
  Target,
  Users,
  X
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions, Modal,
  PanResponder,
  Animated as RNAnimated,
  ScrollView, StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrillDetailModal } from '../src/components/DrillDetailModal';
import { fetchDrillById } from '../src/lib/api';
import { getSession } from '../src/lib/sessionStorage';
import { borderRadius, colors, spacing } from '../src/theme/colors';
import { Drill } from '../src/types/drill';
import { Session, SessionActivity } from '../src/types/session';

const { width: SW, height: SH } = Dimensions.get('window');

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatBullets(text: string): string[] {
  return text.split(/\n|(?:\d+\.\s)/).map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}

// ── Session Mode ────────────────────────────────────────────────────
function SessionMode({ session, drillDetails, onExit, onViewDrill, loadingDrillId }: {
  session: Session; drillDetails: Record<string, Drill>;
  onExit: () => void; onViewDrill: (a: SessionActivity) => void; loadingDrillId: string | null;
}) {
  const [idx, setIdx] = useState(0);
  const pan = useRef(new RNAnimated.Value(0)).current;
  const activities = session.activities;
  const activity = activities[idx];
  const isFirst = idx === 0;
  const isLast = idx === activities.length - 1;
  const progress = ((idx + 1) / activities.length) * 100;

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dx) > Math.abs(g.dy * 1.5),
    onPanResponderMove: (_, g) => {
      let dx = g.dx;
      if ((dx > 0 && isFirst) || (dx < 0 && isLast)) dx *= 0.2;
      pan.setValue(dx);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -60 && !isLast) {
        RNAnimated.timing(pan, { toValue: -SW, duration: 250, useNativeDriver: true }).start(() => {
          setIdx(i => i + 1); pan.setValue(SW);
          RNAnimated.timing(pan, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        });
      } else if (g.dx > 60 && !isFirst) {
        RNAnimated.timing(pan, { toValue: SW, duration: 250, useNativeDriver: true }).start(() => {
          setIdx(i => i - 1); pan.setValue(-SW);
          RNAnimated.timing(pan, { toValue: 0, duration: 250, useNativeDriver: true }).start();
        });
      } else {
        RNAnimated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  let startMin = 0;
  for (let i = 0; i < idx; i++) startMin += activities[i].duration_minutes;
  const title = activity.title || activity.drill_name || 'Activity';
  const drillData = activity.library_drill_id ? drillDetails[activity.library_drill_id] : null;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <SafeAreaView style={sm.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="light-content" />
        {/* Header */}
        <View style={sm.header}>
          <View style={{ flex: 1 }}>
            <Text style={sm.sessionName} numberOfLines={1}>{session.title}</Text>
            <Text style={sm.activityCount}>Activity {idx + 1} of {activities.length}</Text>
          </View>
          <TouchableOpacity onPress={onExit}><X size={22} color={colors.foreground} /></TouchableOpacity>
        </View>
        <View style={sm.progressBg}><View style={[sm.progressFill, { width: `${progress}%` }]} /></View>

        {/* Swipeable content */}
        <RNAnimated.View style={[sm.slideWrap, { transform: [{ translateX: pan }] }]} {...panResponder.panHandlers}>
          <ScrollView contentContainerStyle={sm.slideContent} showsVerticalScrollIndicator={false}>
            <View style={sm.timeBadge}><Text style={sm.timeBadgeText}>{formatTime(startMin)} – {formatTime(startMin + activity.duration_minutes)}</Text></View>
            <Text style={sm.actTitle}>{title}</Text>
            <View style={sm.metaRow}>
              <Clock size={16} color={colors.mutedForeground} /><Text style={sm.metaText}>{activity.duration_minutes} min</Text>
              {(activity.drill_player_count || drillData?.player_count) && (<><Users size={16} color={colors.mutedForeground} /><Text style={sm.metaText}>{activity.drill_player_count || drillData?.player_count}</Text></>)}
            </View>
            {activity.description && !drillData && <Text style={sm.descText}>{activity.description}</Text>}
            {activity.drill_svg_url && (
              <View style={sm.diagramWrap}><Image source={{ uri: activity.drill_svg_url }} style={sm.diagram} contentFit="contain" /></View>
            )}
            {activity.library_drill_id && (
              <TouchableOpacity style={sm.viewDrillBtn} onPress={() => onViewDrill(activity)} disabled={loadingDrillId === activity.id}>
                <Eye size={16} color={colors.primary} /><Text style={sm.viewDrillText}>{loadingDrillId === activity.id ? 'Loading...' : 'View Full Drill Details'}</Text>
              </TouchableOpacity>
            )}
            {(drillData?.setup || activity.drill_setup) && (
              <View style={sm.sectionCard}>
                <View style={sm.sectionHead}><ListChecks size={14} color={colors.primary} /><Text style={sm.sectionLabel}>SETUP</Text></View>
                {formatBullets(drillData?.setup || activity.drill_setup || '').map((p, i) => (
                  <View key={i} style={sm.bullet}><Text style={sm.bulletDot}>▸</Text><Text style={sm.bulletText}>{p}</Text></View>
                ))}
              </View>
            )}
            {(drillData?.instructions || activity.drill_instructions) && (
              <View style={sm.sectionCard}>
                <View style={sm.sectionHead}><ListChecks size={14} color={colors.primary} /><Text style={sm.sectionLabel}>INSTRUCTIONS</Text></View>
                {formatBullets(drillData?.instructions || activity.drill_instructions || '').map((p, i) => (
                  <View key={i} style={sm.bullet}><Text style={sm.bulletDot}>▸</Text><Text style={sm.bulletText}>{p}</Text></View>
                ))}
              </View>
            )}
            {activity.activity_notes && (
              <View style={sm.notesCard}><StickyNote size={14} color={colors.primary} /><View style={{ flex: 1 }}><Text style={sm.notesLabel}>COACH NOTES</Text><Text style={sm.notesText}>{activity.activity_notes}</Text></View></View>
            )}
            {activities.length > 1 && (
              <Text style={sm.hint}>
                {isFirst ? 'Swipe left for next →' : isLast ? '← Swipe right for previous' : '← Swipe left or right →'}
              </Text>
            )}
          </ScrollView>
        </RNAnimated.View>

        {/* Footer */}
        <View style={sm.footer}>
          <Text style={sm.navCount}>{idx + 1} / {activities.length}</Text>
          <TouchableOpacity style={sm.endBtn} onPress={onExit}>
            <Text style={sm.endBtnText}>{isLast ? 'End Session' : 'Exit'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main Session View ───────────────────────────────────────────────
export default function SessionViewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [drillDetails, setDrillDetails] = useState<Record<string, Drill>>({});
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [loadingDrillId, setLoadingDrillId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState(false);

  useEffect(() => {
    if (params.id) {
      (async () => {
        const s = await getSession(params.id);
        if (s) {
          setSession(s);
          s.activities.forEach(async (a) => {
            if (a.library_drill_id) {
              try {
                const d = await fetchDrillById(a.library_drill_id);
                if (d) setDrillDetails(prev => ({ ...prev, [a.library_drill_id!]: d }));
              } catch {}
            }
          });
        } else { router.back(); }
      })();
    }
  }, [params.id]);

  const handleViewDrill = async (activity: SessionActivity) => {
    if (!activity.library_drill_id) return;
    setLoadingDrillId(activity.id);
    try {
      const d = await fetchDrillById(activity.library_drill_id);
      if (d) setSelectedDrill(d);
    } catch {} finally { setLoadingDrillId(null); }
  };

  if (!session) return (
    <SafeAreaView style={v.container}><ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} /></SafeAreaView>
  );

  const totalDuration = session.activities.reduce((s, a) => s + a.duration_minutes, 0);
  let runTime = 0;

  return (
    <SafeAreaView style={v.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      {/* Header */}
      <View style={v.header}>
        <TouchableOpacity onPress={() => router.back()} style={v.backBtn}><ArrowLeft size={22} color={colors.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={v.headerTitle} numberOfLines={1}>{session.title || 'Untitled Session'}</Text>
          {session.session_date && <Text style={v.headerDate}>{new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>}
        </View>
        <View style={v.headerActions}>
          {session.activities.length > 0 && (
            <TouchableOpacity style={v.startBtn} onPress={() => setSessionMode(true)}>
              <Play size={14} color={colors.primaryForeground} fill={colors.primaryForeground} />
              <Text style={v.startBtnText}>Start</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => router.push({ pathname: '/session-editor', params: { id: session.id } })}>
            <Edit size={18} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={v.content} showsVerticalScrollIndicator={false}>
        {/* Overview card */}
        <View style={v.overviewCard}>
          <View style={v.overviewGrid}>
            {session.session_date && (
              <View style={v.overviewItem}>
                <View style={v.overviewIcon}><Calendar size={16} color={colors.primaryForeground} /></View>
                <Text style={v.overviewLabel}>DATE</Text>
                <Text style={v.overviewValue}>{new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
            )}
            {session.team_name && (
              <View style={v.overviewItem}>
                <View style={v.overviewIcon}><Users size={16} color={colors.primaryForeground} /></View>
                <Text style={v.overviewLabel}>TEAM</Text>
                <Text style={v.overviewValue}>{session.team_name}</Text>
              </View>
            )}
            <View style={v.overviewItem}>
              <View style={[v.overviewIcon, { backgroundColor: colors.accent }]}><Clock size={16} color={colors.accentForeground} /></View>
              <Text style={v.overviewLabel}>DURATION</Text>
              <Text style={v.overviewValue}>{formatTime(totalDuration)}</Text>
            </View>
          </View>
          {session.session_goals ? (
            <View style={v.goalsSection}>
              <View style={v.goalsHeader}><Target size={14} color={colors.primary} /><Text style={v.goalsLabel}>SESSION GOALS</Text></View>
              <Text style={v.goalsText}>{session.session_goals}</Text>
            </View>
          ) : null}
        </View>

        {/* Activities */}
        <View style={v.activitiesSection}>
          <View style={v.activitiesHeader}>
            <View style={v.activitiesIcon}><Clipboard size={14} color={colors.primaryForeground} /></View>
            <Text style={v.activitiesTitle}>ACTIVITIES</Text>
            <View style={v.activitiesBadge}><Text style={v.activitiesBadgeText}>{session.activities.length}</Text></View>
          </View>

          {session.activities.length === 0 ? (
            <View style={v.emptyActivities}><Text style={v.emptyText}>No activities in this session.</Text></View>
          ) : (
            session.activities.map((activity, index) => {
              const startMin = runTime;
              runTime += activity.duration_minutes;
              const title = activity.title || activity.drill_name || 'Activity';
              const drillData = activity.library_drill_id ? drillDetails[activity.library_drill_id] : null;

              return (
                <View key={activity.id} style={v.activityRow}>
                  {/* Time node */}
                  <View style={v.timelineCol}>
                    <View style={v.timeNode}><Text style={v.timeNodeText}>{formatTime(startMin).replace(' min', 'm')}</Text></View>
                    {index < session.activities.length - 1 && <View style={v.timelineLine} />}
                  </View>
                  {/* Card */}
                  <View style={v.activityCard}>
                    <View style={v.actCardHeader}>
                      <Text style={v.actCardTitle} numberOfLines={1}>{title}</Text>
                      <View style={v.actDurBadge}><Text style={v.actDurText}>{activity.duration_minutes} min</Text></View>
                    </View>
                    {activity.description && !drillData && <Text style={v.actDesc}>{activity.description}</Text>}
                    {activity.drill_svg_url && (
                      <View style={v.actDiagram}><Image source={{ uri: activity.drill_svg_url }} style={{ width: '100%', height: '100%' }} contentFit="contain" /></View>
                    )}
                    {activity.activity_notes && (
                      <View style={v.actNotes}><StickyNote size={12} color={colors.primary} /><Text style={v.actNotesText}>{activity.activity_notes}</Text></View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Equipment */}
        {session.equipment.length > 0 && (
          <View style={v.equipSection}>
            <View style={v.activitiesHeader}>
              <View style={v.activitiesIcon}><Clipboard size={14} color={colors.primaryForeground} /></View>
              <Text style={v.activitiesTitle}>EQUIPMENT</Text>
            </View>
            <View style={v.equipList}>
              {session.equipment.map((item, i) => (
                <View key={i} style={v.equipChip}><Text style={v.equipText}>{item.name}{item.quantity > 0 ? ` ×${item.quantity}` : ''}</Text></View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Session Mode */}
      {sessionMode && (
        <SessionMode session={session} drillDetails={drillDetails} onExit={() => setSessionMode(false)} onViewDrill={handleViewDrill} loadingDrillId={loadingDrillId} />
      )}

      {/* Drill Modal */}
      <DrillDetailModal drill={selectedDrill} isOpen={selectedDrill !== null} onClose={() => setSelectedDrill(null)} isSaved={false} onSave={() => {}} />
    </SafeAreaView>
  );
}

const v = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
  headerDate: { fontSize: 11, color: colors.mutedForeground },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full },
  startBtnText: { fontSize: 13, fontWeight: '600', color: colors.primaryForeground },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  overviewCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  overviewGrid: { flexDirection: 'row', gap: spacing.sm },
  overviewItem: { flex: 1, alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(74,157,110,0.06)', borderRadius: borderRadius.md, padding: spacing.sm },
  overviewIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  overviewLabel: { fontSize: 9, color: colors.mutedForeground, fontWeight: '600', letterSpacing: 0.5 },
  overviewValue: { fontSize: 12, fontWeight: '600', color: colors.foreground },
  goalsSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  goalsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  goalsLabel: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, letterSpacing: 0.5 },
  goalsText: { fontSize: 13, color: 'rgba(232,234,237,0.8)', lineHeight: 20, paddingLeft: spacing.lg },
  activitiesSection: {},
  activitiesHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  activitiesIcon: { width: 28, height: 28, borderRadius: borderRadius.sm, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  activitiesTitle: { fontSize: 11, fontWeight: '700', color: colors.foreground, letterSpacing: 1 },
  activitiesBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  activitiesBadgeText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  emptyActivities: { backgroundColor: colors.card, borderRadius: borderRadius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: colors.mutedForeground },
  activityRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  timelineCol: { alignItems: 'center', width: 40 },
  timeNode: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: 'rgba(74,157,110,0.3)', justifyContent: 'center', alignItems: 'center' },
  timeNodeText: { fontSize: 9, fontWeight: '700', color: colors.primary },
  timelineLine: { flex: 1, width: 2, backgroundColor: 'rgba(74,157,110,0.15)', marginTop: 4 },
  activityCard: { flex: 1, backgroundColor: colors.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  actCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  actCardTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground, flex: 1, marginRight: spacing.sm },
  actDurBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  actDurText: { fontSize: 10, fontWeight: '600', color: colors.primary },
  actDesc: { fontSize: 13, color: colors.mutedForeground, lineHeight: 19 },
  actDiagram: { width: '100%', aspectRatio: 16 / 10, borderRadius: borderRadius.md, overflow: 'hidden', marginTop: spacing.sm, backgroundColor: '#63b043' },
  actNotes: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: 'rgba(139,145,158,0.08)', borderRadius: borderRadius.sm, padding: spacing.sm },
  actNotesText: { flex: 1, fontSize: 12, color: 'rgba(232,234,237,0.8)' },
  equipSection: { backgroundColor: colors.card, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  equipList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  equipChip: { backgroundColor: colors.background, paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border },
  equipText: { fontSize: 13, color: colors.foreground },
});

const sm = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  sessionName: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
  activityCount: { fontSize: 14, fontWeight: '700', color: colors.foreground, marginTop: 2 },
  progressBg: { height: 4, backgroundColor: colors.border, marginHorizontal: spacing.md, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  slideWrap: { flex: 1 },
  slideContent: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },
  timeBadge: { backgroundColor: colors.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, alignSelf: 'flex-start' },
  timeBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
  actTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 14, color: colors.mutedForeground },
  descText: { fontSize: 14, color: 'rgba(232,234,237,0.8)', lineHeight: 22 },
  diagramWrap: { borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: '#63b043', aspectRatio: 4 / 3 },
  diagram: { width: '100%', height: '100%' },
  viewDrillBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingVertical: 12 },
  viewDrillText: { fontSize: 14, color: colors.primary, fontWeight: '500' },
  sectionCard: { backgroundColor: colors.card, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.primary, letterSpacing: 1 },
  bullet: { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  bulletDot: { color: 'rgba(74,157,110,0.6)', marginTop: 2, fontSize: 12 },
  bulletText: { flex: 1, fontSize: 14, color: 'rgba(232,234,237,0.8)', lineHeight: 22 },
  notesCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: 'rgba(139,145,158,0.08)', borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'flex-start' },
  notesLabel: { fontSize: 10, fontWeight: '600', color: colors.mutedForeground, letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 14, color: 'rgba(232,234,237,0.8)', lineHeight: 22 },
  hint: { textAlign: 'center', fontSize: 12, color: 'rgba(139,145,158,0.5)', marginTop: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: 16 },
  navText: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  navCount: { fontSize: 12, color: colors.mutedForeground, fontWeight: '500' },
  endBtn: { backgroundColor: colors.primary, borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: 20 },
  endBtnText: { fontSize: 13, fontWeight: '600', color: colors.primaryForeground },
});
