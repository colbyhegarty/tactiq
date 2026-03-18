import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Calendar,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Clock,
  Edit, Eye,
  ListChecks,
  Mail,
  Play,
  Share2,
  StickyNote,
  Target,
  Users,
  X
} from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions, FlatList, Modal,
  ScrollView, StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrillDetailModal } from '../src/components/DrillDetailModal';
import { ShareSessionModal } from '../src/components/ShareSessionModal';
import { fetchDrillById } from '../src/lib/api';
import { exportAndSharePDF } from '../src/lib/sessionPdf';
import { getSession } from '../src/lib/sessionStorage';
import { getUserProfile } from '../src/lib/storage';
import { borderRadius, spacing } from '../src/theme/colors';
import { useTheme } from '../src/theme/ThemeContext';
import { Drill, PdfSettings, defaultPdfSettings } from '../src/types/drill';
import { Session, SessionActivity } from '../src/types/session';

const { width: SW } = Dimensions.get('window');

function formatTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : `${h}h ${m.toString().padStart(2, '0')}m`;
}

function formatBullets(text: string): string[] {
  return text.split(/\n|(?:\d+\.\s)/).map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
}

// ── Activity Page (single activity rendered at full screen width) ────
function ActivityPage({ activity, startMin, drillData, onViewDrill, loadingDrillId, pageWidth }: {
  activity: SessionActivity; startMin: number; drillData: Drill | null;
  onViewDrill: (a: SessionActivity) => void; loadingDrillId: string | null; pageWidth: number;
}) {
  const { colors: tc } = useTheme();
  const title = activity.title || activity.drill_name || 'Activity';
  return (
    <View style={{ width: pageWidth }}>
      <ScrollView contentContainerStyle={sm.slideContent} showsVerticalScrollIndicator={false}>
        <View style={sm.timeBadge}><Text style={sm.timeBadgeText}>{formatTime(startMin)} – {formatTime(startMin + activity.duration_minutes)}</Text></View>
        <Text style={sm.actTitle}>{title}</Text>
        <View style={sm.metaRow}>
          <Clock size={16} color={tc.mutedForeground} /><Text style={sm.metaText}>{activity.duration_minutes} min</Text>
          {(activity.drill_player_count || drillData?.player_count) && (<><Users size={16} color={tc.mutedForeground} /><Text style={sm.metaText}>{activity.drill_player_count || drillData?.player_count}</Text></>)}
        </View>
        {activity.description && !drillData && <Text style={sm.descText}>{activity.description}</Text>}
        {activity.drill_svg_url && (
          <View style={sm.diagramWrap}><Image source={{ uri: activity.drill_svg_url }} style={sm.diagram} contentFit="cover" /></View>
        )}
        {activity.library_drill_id && (
          <TouchableOpacity style={sm.viewDrillBtn} onPress={() => onViewDrill(activity)} disabled={loadingDrillId === activity.id}>
            <Eye size={16} color={tc.primary} /><Text style={sm.viewDrillText}>{loadingDrillId === activity.id ? 'Loading...' : 'View Full Drill Details'}</Text>
          </TouchableOpacity>
        )}
        {(drillData?.setup || activity.drill_setup) && (
          <View style={sm.sectionCard}>
            <View style={sm.sectionHead}><ListChecks size={14} color={tc.primary} /><Text style={sm.sectionLabel}>SETUP</Text></View>
            {formatBullets(drillData?.setup || activity.drill_setup || '').map((p, i) => (
              <View key={i} style={sm.bullet}><Text style={sm.bulletDot}>▸</Text><Text style={sm.bulletText}>{p}</Text></View>
            ))}
          </View>
        )}
        {(drillData?.instructions || activity.drill_instructions) && (
          <View style={sm.sectionCard}>
            <View style={sm.sectionHead}><ListChecks size={14} color={tc.primary} /><Text style={sm.sectionLabel}>INSTRUCTIONS</Text></View>
            {formatBullets(drillData?.instructions || activity.drill_instructions || '').map((p, i) => (
              <View key={i} style={sm.bullet}><Text style={sm.bulletDot}>▸</Text><Text style={sm.bulletText}>{p}</Text></View>
            ))}
          </View>
        )}
        {activity.activity_notes && (
          <View style={sm.notesCard}><StickyNote size={14} color={tc.primary} /><View style={{ flex: 1 }}><Text style={sm.notesLabel}>COACH NOTES</Text><Text style={sm.notesText}>{activity.activity_notes}</Text></View></View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Session Mode ────────────────────────────────────────────────────
function SessionMode({ session, drillDetails, onExit, onViewDrill, loadingDrillId }: {
  session: Session; drillDetails: Record<string, Drill>;
  onExit: () => void; onViewDrill: (a: SessionActivity) => void; loadingDrillId: string | null;
}) {
  const { colors: tc, isDark } = useTheme();
  const [idx, setIdx] = useState(0);
  const [pageWidth, setPageWidth] = useState(SW);
  const flatListRef = useRef<FlatList>(null);
  const activities = session.activities;
  const progress = ((idx + 1) / activities.length) * 100;

  // Compute start times
  const startTimes: number[] = [];
  let acc = 0;
  for (const a of activities) { startTimes.push(acc); acc += a.duration_minutes; }

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setIdx(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderPage = useCallback(({ item, index }: { item: SessionActivity; index: number }) => (
    <ActivityPage
      activity={item}
      startMin={startTimes[index]}
      drillData={item.library_drill_id ? drillDetails[item.library_drill_id] || null : null}
      onViewDrill={onViewDrill}
      loadingDrillId={loadingDrillId}
      pageWidth={pageWidth}
    />
  ), [drillDetails, loadingDrillId, onViewDrill, startTimes, pageWidth]);

  const isLast = idx === activities.length - 1;

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <SafeAreaView style={sm.container} edges={['top', 'bottom']}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
      >
        <StatusBar barStyle="light-content" />
        {/* Header */}
        <View style={sm.header}>
          <View style={{ flex: 1 }}>
            <Text style={sm.sessionName} numberOfLines={1}>{session.title}</Text>
            <Text style={sm.activityCount}>Activity {idx + 1} of {activities.length}</Text>
          </View>
          <TouchableOpacity onPress={onExit}><X size={22} color={tc.foreground} /></TouchableOpacity>
        </View>
        <View style={sm.progressBg}><View style={[sm.progressFill, { width: `${progress}%` }]} /></View>

        {/* Horizontal paging FlatList */}
        <FlatList
          ref={flatListRef}
          data={activities}
          keyExtractor={(item) => item.id}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          getItemLayout={(_, index) => ({ length: pageWidth, offset: pageWidth * index, index })}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          windowSize={3}
        />

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

// ── Expandable Activity Details ─────────────────────────────────────
function ActivityDetailsDropdown({ activity, drillData }: { activity: SessionActivity; drillData: Drill | null }) {
  const { colors: tc } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const setup = drillData?.setup || activity.drill_setup || '';
  const instructions = drillData?.instructions || activity.drill_instructions || '';

  if (!setup && !instructions) return null;

  return (
    <View style={v.dropdownContainer}>
      <TouchableOpacity style={v.dropdownToggle} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
        <Text style={v.dropdownToggleText}>Setup & Instructions</Text>
        {expanded
          ? <ChevronUp size={16} color={tc.primary} />
          : <ChevronDown size={16} color={tc.primary} />
        }
      </TouchableOpacity>
      {expanded && (
        <View style={v.dropdownContent}>
          {setup ? (
            <View style={v.dropdownSection}>
              <View style={v.dropdownSectionHead}>
                <ListChecks size={12} color={tc.primary} />
                <Text style={v.dropdownSectionLabel}>SETUP</Text>
              </View>
              {formatBullets(setup).map((p, i) => (
                <View key={i} style={v.dropdownBullet}>
                  <Text style={v.dropdownBulletDot}>▸</Text>
                  <Text style={v.dropdownBulletText}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {instructions ? (
            <View style={[v.dropdownSection, setup ? { marginTop: spacing.sm } : undefined]}>
              <View style={v.dropdownSectionHead}>
                <ListChecks size={12} color={tc.primary} />
                <Text style={v.dropdownSectionLabel}>INSTRUCTIONS</Text>
              </View>
              {formatBullets(instructions).map((p, i) => (
                <View key={i} style={v.dropdownBullet}>
                  <Text style={v.dropdownBulletDot}>▸</Text>
                  <Text style={v.dropdownBulletText}>{p}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </View>
  );
}

// ── Main Session View ───────────────────────────────────────────────
export default function SessionViewScreen() {
  const router = useRouter();
  const { colors: tc, isDark } = useTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [drillDetails, setDrillDetails] = useState<Record<string, Drill>>({});
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [loadingDrillId, setLoadingDrillId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<PdfSettings>(defaultPdfSettings);

  const handleExportPDF = async () => {
    if (!session) return;
    setExporting(true);
    try {
      await exportAndSharePDF(session, drillDetails, pdfSettings);
    } catch (err: any) {
      if (!err?.message?.includes('cancelled') && !err?.message?.includes('canceled')) {
        Alert.alert('Error', 'Failed to export PDF.');
      }
    } finally {
      setExporting(false);
    }
  };

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

  // Load PDF settings from profile
  useEffect(() => {
    (async () => {
      const profile = await getUserProfile();
      if (profile.pdfSettings) setPdfSettings(profile.pdfSettings);
    })();
  }, []);

  const handleViewDrill = async (activity: SessionActivity) => {
    if (!activity.library_drill_id) return;
    setLoadingDrillId(activity.id);
    try {
      const d = await fetchDrillById(activity.library_drill_id);
      if (d) setSelectedDrill(d);
    } catch {} finally { setLoadingDrillId(null); }
  };

  if (!session) return (
    <SafeAreaView style={[v.container, { backgroundColor: tc.background }]}><ActivityIndicator size="large" color={tc.primary} style={{ marginTop: 100 }} /></SafeAreaView>
  );

  const totalDuration = session.activities.reduce((s, a) => s + a.duration_minutes, 0);
  let runTime = 0;

  return (
    <SafeAreaView style={[v.container, { backgroundColor: tc.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tc.background} />
      {/* Header */}
      <View style={v.header}>
        <TouchableOpacity onPress={() => router.back()} style={v.backBtn}><ArrowLeft size={22} color={tc.foreground} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={v.headerTitle} numberOfLines={1}>{session.title || 'Untitled Session'}</Text>
          {session.session_date && <Text style={v.headerDate}>{new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>}
        </View>
        <View style={v.headerActions}>
          {session.activities.length > 0 && (
            <TouchableOpacity style={v.startBtn} onPress={() => setSessionMode(true)}>
              <Play size={14} color={tc.primaryForeground} fill={tc.primaryForeground} />
              <Text style={v.startBtnText}>Start</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleExportPDF} disabled={exporting} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Share2 size={18} color={tc.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push({ pathname: '/session-editor', params: { id: session.id } })} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Edit size={18} color={tc.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={v.content} showsVerticalScrollIndicator={false}>
        {/* Overview card */}
        <View style={v.overviewCard}>
          <View style={v.overviewGrid}>
            {session.session_date && (
              <View style={v.overviewItem}>
                <View style={v.overviewIcon}><Calendar size={16} color={tc.primaryForeground} /></View>
                <Text style={v.overviewLabel}>DATE</Text>
                <Text style={v.overviewValue}>{new Date(session.session_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
              </View>
            )}
            {session.team_name && (
              <View style={v.overviewItem}>
                <View style={v.overviewIcon}><Users size={16} color={tc.primaryForeground} /></View>
                <Text style={v.overviewLabel}>TEAM</Text>
                <Text style={v.overviewValue}>{session.team_name}</Text>
              </View>
            )}
            <View style={v.overviewItem}>
              <View style={[v.overviewIcon, { backgroundColor: tc.accent }]}><Clock size={16} color={tc.accentForeground} /></View>
              <Text style={v.overviewLabel}>DURATION</Text>
              <Text style={v.overviewValue}>{formatTime(totalDuration)}</Text>
            </View>
          </View>
          {session.session_goals ? (
            <View style={v.goalsSection}>
              <View style={v.goalsHeader}><Target size={14} color={tc.primary} /><Text style={v.goalsLabel}>SESSION GOALS</Text></View>
              <Text style={v.goalsText}>{session.session_goals}</Text>
            </View>
          ) : null}
        </View>

        {/* Activities */}
        <View style={v.activitiesSection}>
          <View style={v.activitiesHeader}>
            <View style={v.activitiesIcon}><Clipboard size={14} color={tc.primaryForeground} /></View>
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
                  <View style={v.timelineCol}>
                    <View style={v.timeNode}><Text style={v.timeNodeText}>{formatTime(startMin).replace(' min', 'm')}</Text></View>
                    {index < session.activities.length - 1 && <View style={v.timelineLine} />}
                  </View>
                  <View style={v.activityCard}>
                    <View style={v.actCardHeader}>
                      <Text style={v.actCardTitle} numberOfLines={1}>{title}</Text>
                      <View style={v.actDurBadge}><Text style={v.actDurText}>{activity.duration_minutes} min</Text></View>
                    </View>
                    {activity.description && !drillData && <Text style={v.actDesc}>{activity.description}</Text>}
                    {activity.drill_svg_url && (
                      <View style={v.actDiagram}><Image source={{ uri: activity.drill_svg_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" /></View>
                    )}
                    {/* Expandable setup & instructions dropdown */}
                    <ActivityDetailsDropdown activity={activity} drillData={drillData || null} />
                    {activity.activity_notes && (
                      <View style={v.actNotes}><StickyNote size={12} color={tc.primary} /><Text style={v.actNotesText}>{activity.activity_notes}</Text></View>
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
              <View style={v.activitiesIcon}><Clipboard size={14} color={tc.primaryForeground} /></View>
              <Text style={v.activitiesTitle}>EQUIPMENT</Text>
            </View>
            <View style={v.equipList}>
              {session.equipment.map((item, i) => (
                <View key={i} style={v.equipChip}><Text style={v.equipText}>{item.name}{item.quantity > 0 ? ` ×${item.quantity}` : ''}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* Share actions */}
        <View style={v.shareRow}>
          <TouchableOpacity style={v.shareBtn} onPress={handleExportPDF} disabled={exporting}>
            <Share2 size={16} color={tc.primaryForeground} />
            <Text style={v.shareBtnText}>{exporting ? 'Exporting...' : 'Export PDF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={v.shareContactsBtn} onPress={() => setShareModalOpen(true)}>
            <Mail size={16} color={tc.primary} />
            <Text style={v.shareContactsText}>Share to Contacts</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {sessionMode && (
        <SessionMode session={session} drillDetails={drillDetails} onExit={() => setSessionMode(false)} onViewDrill={handleViewDrill} loadingDrillId={loadingDrillId} />
      )}

      <DrillDetailModal drill={selectedDrill} isOpen={selectedDrill !== null} onClose={() => setSelectedDrill(null)} isSaved={false} onSave={() => {}} />
      <ShareSessionModal session={session} drillDetails={drillDetails} isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} />
    </SafeAreaView>
  );
}

const v = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151823' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#2a3142' },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#e8eaed' },
  headerDate: { fontSize: 11, color: '#8b919e' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4a9d6e', paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full },
  startBtnText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  overviewCard: { backgroundColor: '#1e2433', borderRadius: borderRadius.xl, borderWidth: 1, borderColor: '#2a3142', padding: spacing.md },
  overviewGrid: { flexDirection: 'row', gap: spacing.sm },
  overviewItem: { flex: 1, alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(74,157,110,0.06)', borderRadius: borderRadius.md, padding: spacing.sm },
  overviewIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#4a9d6e', justifyContent: 'center', alignItems: 'center' },
  overviewLabel: { fontSize: 9, color: '#8b919e', fontWeight: '600', letterSpacing: 0.5 },
  overviewValue: { fontSize: 12, fontWeight: '600', color: '#e8eaed' },
  goalsSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: '#2a3142' },
  goalsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  goalsLabel: { fontSize: 10, fontWeight: '600', color: '#8b919e', letterSpacing: 0.5 },
  goalsText: { fontSize: 13, color: 'rgba(232,234,237,0.8)', lineHeight: 20, paddingLeft: spacing.lg },
  activitiesSection: {},
  activitiesHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  activitiesIcon: { width: 28, height: 28, borderRadius: borderRadius.sm, backgroundColor: '#4a9d6e', justifyContent: 'center', alignItems: 'center' },
  activitiesTitle: { fontSize: 11, fontWeight: '700', color: '#e8eaed', letterSpacing: 1 },
  activitiesBadge: { backgroundColor: 'rgba(74, 157, 110, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  activitiesBadgeText: { fontSize: 10, fontWeight: '600', color: '#4a9d6e' },
  emptyActivities: { backgroundColor: '#1e2433', borderRadius: borderRadius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2a3142', padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#8b919e' },
  activityRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  timelineCol: { alignItems: 'center', width: 40 },
  timeNode: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e2433', borderWidth: 2, borderColor: 'rgba(74,157,110,0.3)', justifyContent: 'center', alignItems: 'center' },
  timeNodeText: { fontSize: 9, fontWeight: '700', color: '#4a9d6e' },
  timelineLine: { flex: 1, width: 2, backgroundColor: 'rgba(74,157,110,0.15)', marginTop: 4 },
  activityCard: { flex: 1, backgroundColor: '#1e2433', borderRadius: borderRadius.lg, borderWidth: 1, borderColor: '#2a3142', padding: spacing.md },
  actCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  actCardTitle: { fontSize: 14, fontWeight: '600', color: '#e8eaed', flex: 1, marginRight: spacing.sm },
  actDurBadge: { backgroundColor: 'rgba(74, 157, 110, 0.1)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  actDurText: { fontSize: 10, fontWeight: '600', color: '#4a9d6e' },
  actDesc: { fontSize: 13, color: '#8b919e', lineHeight: 19 },
  actDiagram: { width: '100%', aspectRatio: 16 / 10, borderRadius: borderRadius.md, overflow: 'hidden', marginTop: spacing.sm, backgroundColor: '#63b043' },
  actNotes: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: 'rgba(139,145,158,0.08)', borderRadius: borderRadius.sm, padding: spacing.sm },
  actNotesText: { flex: 1, fontSize: 12, color: 'rgba(232,234,237,0.8)' },
  // Dropdown styles
  dropdownContainer: { marginTop: spacing.sm },
  dropdownToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: 'rgba(74,157,110,0.06)', borderWidth: 1, borderColor: 'rgba(74,157,110,0.15)' },
  dropdownToggleText: { fontSize: 12, fontWeight: '600', color: '#4a9d6e' },
  dropdownContent: { marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: 'rgba(74,157,110,0.03)', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: 'rgba(74,157,110,0.1)' },
  dropdownSection: {},
  dropdownSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dropdownSectionLabel: { fontSize: 10, fontWeight: '700', color: '#4a9d6e', letterSpacing: 0.8 },
  dropdownBullet: { flexDirection: 'row', gap: 6, marginBottom: 3 },
  dropdownBulletDot: { color: 'rgba(74,157,110,0.6)', marginTop: 1, fontSize: 11 },
  dropdownBulletText: { flex: 1, fontSize: 12, color: 'rgba(232,234,237,0.8)', lineHeight: 18 },
  // Equipment & share
  equipSection: { backgroundColor: '#1e2433', borderRadius: borderRadius.xl, borderWidth: 1, borderColor: '#2a3142', padding: spacing.md },
  equipList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  equipChip: { backgroundColor: '#151823', paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: '#2a3142' },
  equipText: { fontSize: 13, color: '#e8eaed' },
  shareRow: { flexDirection: 'row', gap: spacing.sm },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#4a9d6e', borderRadius: borderRadius.lg, paddingVertical: 14 },
  shareBtnText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  shareContactsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#2a3142', borderRadius: borderRadius.lg, paddingVertical: 14 },
  shareContactsText: { fontSize: 14, fontWeight: '500', color: '#4a9d6e' },
});

const sm = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#151823' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#2a3142' },
  sessionName: { fontSize: 12, color: '#8b919e', fontWeight: '500' },
  activityCount: { fontSize: 14, fontWeight: '700', color: '#e8eaed', marginTop: 2 },
  progressBg: { height: 4, backgroundColor: '#2a3142', marginHorizontal: spacing.md, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#4a9d6e', borderRadius: 2 },
  slideContent: { padding: spacing.md, paddingBottom: 20, gap: spacing.md },
  timeBadge: { backgroundColor: 'rgba(74, 157, 110, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, alignSelf: 'flex-start' },
  timeBadgeText: { fontSize: 12, fontWeight: '600', color: '#4a9d6e' },
  actTitle: { fontSize: 24, fontWeight: '700', color: '#e8eaed' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 14, color: '#8b919e' },
  descText: { fontSize: 14, color: 'rgba(232,234,237,0.8)', lineHeight: 22 },
  diagramWrap: { borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: '#63b043', aspectRatio: 4 / 3 },
  diagram: { width: '100%', height: '100%' },
  viewDrillBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: '#2a3142', borderRadius: borderRadius.md, paddingVertical: 12 },
  viewDrillText: { fontSize: 14, color: '#4a9d6e', fontWeight: '500' },
  sectionCard: { backgroundColor: '#1e2433', borderRadius: borderRadius.xl, borderWidth: 1, borderColor: '#2a3142', padding: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#4a9d6e', letterSpacing: 1 },
  bullet: { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  bulletDot: { color: 'rgba(74,157,110,0.6)', marginTop: 2, fontSize: 12 },
  bulletText: { flex: 1, fontSize: 14, color: 'rgba(232,234,237,0.8)', lineHeight: 22 },
  notesCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: 'rgba(139,145,158,0.08)', borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'flex-start' },
  notesLabel: { fontSize: 10, fontWeight: '600', color: '#8b919e', letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 14, color: 'rgba(232,234,237,0.8)', lineHeight: 22 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: '#2a3142' },
  navCount: { fontSize: 12, color: '#8b919e', fontWeight: '500' },
  endBtn: { backgroundColor: '#4a9d6e', borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: 20 },
  endBtnText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
});
