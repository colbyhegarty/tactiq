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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DrillDetailModal } from '../src/components/DrillDetailModal';
import { ShareSessionModal } from '../src/components/ShareSessionModal';
import { fetchDrillById } from '../src/lib/api';
import { exportAndSharePDF } from '../src/lib/sessionPdf';
import { getSession } from '../src/lib/sessionStorage';
import { getUserProfile } from '../src/lib/storage';
import { borderRadius, spacing } from '../src/theme/colors';
import { useTheme } from '../src/theme/ThemeContext';
import { usePaywallGate, PaywallModal } from '../src/subscription';
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
  const v = create_v(tc);
  const sm = create_sm(tc);
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
          <View style={sm.diagramWrap}><Image source={{ uri: activity.drill_svg_url + '?v=2' }} style={sm.diagram} contentFit="cover" /></View>
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
  const v = create_v(tc);
  const sm = create_sm(tc);
  const insets = useSafeAreaInsets();
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
      <View style={[sm.container, { backgroundColor: tc.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
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
      </View>
    </Modal>
  );
}

// ── Expandable Activity Details ─────────────────────────────────────
function ActivityDetailsDropdown({ activity, drillData }: { activity: SessionActivity; drillData: Drill | null }) {
  const { colors: tc } = useTheme();
  const v = create_v(tc);
  const sm = create_sm(tc);
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
  const v = create_v(tc);
  const sm = create_sm(tc);
  const params = useLocalSearchParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [drillDetails, setDrillDetails] = useState<Record<string, Drill>>({});
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [loadingDrillId, setLoadingDrillId] = useState<string | null>(null);
  const [sessionMode, setSessionMode] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pdfSettings, setPdfSettings] = useState<PdfSettings>(defaultPdfSettings);
  const { gate, paywallVisible, paywallReason, dismissPaywall } = usePaywallGate();

  const handleExportPDF = async () => {
    if (!session) return;
    // Gate: free users cannot export
    const allowed = await gate('export_pdf');
    if (!allowed) return;

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

  const handleShareToContacts = async () => {
    // Gate: free users cannot share
    const allowed = await gate('share_session');
    if (!allowed) return;
    setShareModalOpen(true);
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
                      <View style={v.actDiagram}><Image source={{ uri: activity.drill_svg_url + '?v=2' }} style={{ width: '100%', height: '100%' }} contentFit="cover" /></View>
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
          <TouchableOpacity style={v.shareContactsBtn} onPress={handleShareToContacts}>
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
      <PaywallModal visible={paywallVisible} onDismiss={dismissPaywall} reason={paywallReason} />
    </SafeAreaView>
  );
}

function create_v(tc: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: tc.border },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: tc.foreground },
  headerDate: { fontSize: 11, color: tc.mutedForeground },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tc.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full },
  startBtnText: { fontSize: 13, fontWeight: '600', color: tc.primaryForeground },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  overviewCard: { backgroundColor: tc.card, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: tc.border, padding: spacing.md },
  overviewGrid: { flexDirection: 'row', gap: spacing.sm },
  overviewItem: { flex: 1, alignItems: 'center', gap: spacing.sm, backgroundColor: tc.primaryLight, borderRadius: borderRadius.md, padding: spacing.sm },
  overviewIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: tc.primary, justifyContent: 'center', alignItems: 'center' },
  overviewLabel: { fontSize: 9, color: tc.mutedForeground, fontWeight: '600', letterSpacing: 0.5 },
  overviewValue: { fontSize: 12, fontWeight: '600', color: tc.foreground },
  goalsSection: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: tc.border },
  goalsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  goalsLabel: { fontSize: 10, fontWeight: '600', color: tc.mutedForeground, letterSpacing: 0.5 },
  goalsText: { fontSize: 13, color: tc.foreground, lineHeight: 20, paddingLeft: spacing.lg },
  activitiesSection: {},
  activitiesHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  activitiesIcon: { width: 28, height: 28, borderRadius: borderRadius.sm, backgroundColor: tc.primary, justifyContent: 'center', alignItems: 'center' },
  activitiesTitle: { fontSize: 11, fontWeight: '700', color: tc.foreground, letterSpacing: 1 },
  activitiesBadge: { backgroundColor: tc.primaryLight, paddingHorizontal: 8, paddingVertical: 2, borderRadius: borderRadius.full },
  activitiesBadgeText: { fontSize: 10, fontWeight: '600', color: tc.primary },
  emptyActivities: { backgroundColor: tc.card, borderRadius: borderRadius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: tc.border, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: tc.mutedForeground },
  activityRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  timelineCol: { alignItems: 'center', width: 40 },
  timeNode: { width: 40, height: 40, borderRadius: 20, backgroundColor: tc.card, borderWidth: 2, borderColor: 'rgba(74,157,110,0.3)', justifyContent: 'center', alignItems: 'center' },
  timeNodeText: { fontSize: 9, fontWeight: '700', color: tc.primary },
  timelineLine: { flex: 1, width: 2, backgroundColor: 'rgba(74,157,110,0.15)', marginTop: 4 },
  activityCard: { flex: 1, backgroundColor: tc.card, borderRadius: borderRadius.lg, borderWidth: 1, borderColor: tc.border, padding: spacing.md },
  actCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  actCardTitle: { fontSize: 14, fontWeight: '600', color: tc.foreground, flex: 1, marginRight: spacing.sm },
  actDurBadge: { backgroundColor: tc.primaryLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full },
  actDurText: { fontSize: 10, fontWeight: '600', color: tc.primary },
  actDesc: { fontSize: 13, color: tc.mutedForeground, lineHeight: 19 },
  actDiagram: { width: '100%', aspectRatio: 16 / 10, borderRadius: borderRadius.md, overflow: 'hidden', marginTop: spacing.sm, backgroundColor: tc.fieldDark },
  actNotes: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: tc.primaryLight, borderRadius: borderRadius.sm, padding: spacing.sm },
  actNotesText: { flex: 1, fontSize: 12, color: tc.foreground },
  // Dropdown styles
  dropdownContainer: { marginTop: spacing.sm },
  dropdownToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm, backgroundColor: tc.primaryLight, borderWidth: 1, borderColor: 'rgba(74,157,110,0.15)' },
  dropdownToggleText: { fontSize: 12, fontWeight: '600', color: tc.primary },
  dropdownContent: { marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, backgroundColor: 'rgba(74,157,110,0.03)', borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.primaryLight },
  dropdownSection: {},
  dropdownSectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  dropdownSectionLabel: { fontSize: 10, fontWeight: '700', color: tc.primary, letterSpacing: 0.8 },
  dropdownBullet: { flexDirection: 'row', gap: 6, marginBottom: 3 },
  dropdownBulletDot: { color: 'rgba(74,157,110,0.6)', marginTop: 1, fontSize: 11 },
  dropdownBulletText: { flex: 1, fontSize: 12, color: tc.foreground, lineHeight: 18 },
  // Equipment & share
  equipSection: { backgroundColor: tc.card, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: tc.border, padding: spacing.md },
  equipList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  equipChip: { backgroundColor: tc.background, paddingHorizontal: 14, paddingVertical: 8, borderRadius: borderRadius.full, borderWidth: 1, borderColor: tc.border },
  equipText: { fontSize: 13, color: tc.foreground },
  shareRow: { flexDirection: 'row', gap: spacing.sm },
  shareBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: tc.primary, borderRadius: borderRadius.lg, paddingVertical: 14 },
  shareBtnText: { fontSize: 14, fontWeight: '600', color: tc.primaryForeground },
  shareContactsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: tc.border, borderRadius: borderRadius.lg, paddingVertical: 14 },
  shareContactsText: { fontSize: 14, fontWeight: '500', color: tc.primary },
}); };

function create_sm(tc: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: tc.border },
  sessionName: { fontSize: 12, color: tc.mutedForeground, fontWeight: '500' },
  activityCount: { fontSize: 14, fontWeight: '700', color: tc.foreground, marginTop: 2 },
  progressBg: { height: 4, backgroundColor: tc.border, marginHorizontal: spacing.md, borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: tc.primary, borderRadius: 2 },
  slideContent: { padding: spacing.md, paddingBottom: 20, gap: spacing.md },
  timeBadge: { backgroundColor: tc.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full, alignSelf: 'flex-start' },
  timeBadgeText: { fontSize: 12, fontWeight: '600', color: tc.primary },
  actTitle: { fontSize: 24, fontWeight: '700', color: tc.foreground },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  metaText: { fontSize: 14, color: tc.mutedForeground },
  descText: { fontSize: 14, color: tc.foreground, lineHeight: 22 },
  diagramWrap: { borderRadius: borderRadius.xl, overflow: 'hidden', backgroundColor: tc.fieldDark, aspectRatio: 4 / 3 },
  diagram: { width: '100%', height: '100%' },
  viewDrillBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: tc.border, borderRadius: borderRadius.md, paddingVertical: 12 },
  viewDrillText: { fontSize: 14, color: tc.primary, fontWeight: '500' },
  sectionCard: { backgroundColor: tc.card, borderRadius: borderRadius.xl, borderWidth: 1, borderColor: tc.border, padding: spacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: tc.primary, letterSpacing: 1 },
  bullet: { flexDirection: 'row', gap: spacing.sm, marginBottom: 6 },
  bulletDot: { color: 'rgba(74,157,110,0.6)', marginTop: 2, fontSize: 12 },
  bulletText: { flex: 1, fontSize: 14, color: tc.foreground, lineHeight: 22 },
  notesCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: tc.primaryLight, borderRadius: borderRadius.lg, padding: spacing.md, alignItems: 'flex-start' },
  notesLabel: { fontSize: 10, fontWeight: '600', color: tc.mutedForeground, letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 14, color: tc.foreground, lineHeight: 22 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: tc.border },
  navCount: { fontSize: 12, color: tc.mutedForeground, fontWeight: '500' },
  endBtn: { backgroundColor: tc.primary, borderRadius: borderRadius.md, paddingVertical: 10, paddingHorizontal: 20 },
  endBtnText: { fontSize: 13, fontWeight: '600', color: tc.primaryForeground },
}); };
