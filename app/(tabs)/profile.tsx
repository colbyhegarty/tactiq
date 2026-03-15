import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  BookmarkX,
  Calendar,
  CalendarDays,
  Camera,
  Clock,
  Copy,
  Edit,
  LayoutGrid, LayoutList,
  PenTool,
  Save,
  Settings,
  Trash2,
  User,
  Users,
  X
} from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal, Pressable,
  ScrollView, StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactsManager } from '../../src/components/ContactsManager';
import { CustomDrillCard } from '../../src/components/CustomDrillCard';
import { CustomDrillDetailModal } from '../../src/components/CustomDrillDetailModal';
import { DrillCard } from '../../src/components/DrillCard';
import { DrillDetailModal } from '../../src/components/DrillDetailModal';
import { clearContacts, Contact, getContacts } from '../../src/lib/contactsStorage';
import { clearCustomDrills, deleteCustomDrill, getCustomDrills } from '../../src/lib/customDrillStorage';
import { deleteSession, duplicateSession, getSessions } from '../../src/lib/sessionStorage';
import { clearAllData, getSavedDrills, getUserProfile, removeDrill, saveUserProfile } from '../../src/lib/storage';
import { borderRadius, colors, spacing } from '../../src/theme/colors';
import { CustomDrill } from '../../src/types/customDrill';
import { Drill, UserProfile } from '../../src/types/drill';
import { Session } from '../../src/types/session';

type ProfileTab = 'custom' | 'saved' | 'sessions';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>({
    name: '', email: '', teamName: '',
    defaultAgeGroup: 'Not Specified', defaultSkillLevel: 'Not Specified', defaultPlayerCount: 12,
  });
  const [savedDrills, setSavedDrills] = useState<Drill[]>([]);
  const [customDrills, setCustomDrills] = useState<CustomDrill[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [selectedCustomDrill, setSelectedCustomDrill] = useState<CustomDrill | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('custom');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [gridCols, setGridCols] = useState<1 | 2>(2);

  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    const [p, saved, custom, sess, cont] = await Promise.all([
      getUserProfile(), getSavedDrills(), getCustomDrills(), getSessions(), getContacts(),
    ]);
    setProfile(p);
    setSavedDrills(saved);
    setCustomDrills(custom);
    setSessions(sess.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    setContacts(cont);
  };

  const handleProfileChange = (key: keyof UserProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSaveProfile = async () => {
    await saveUserProfile(profile);
    setHasChanges(false);
    setSettingsOpen(false);
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled && result.assets[0]) {
      handleProfileChange('avatarUrl', result.assets[0].uri);
    }
  };

  const handleRemoveDrill = async (drill: Drill) => {
    await removeDrill(drill.id);
    setSavedDrills((prev) => prev.filter((d) => d.id !== drill.id));
    setSelectedDrill(null);
  };

  const handleDeleteCustomDrill = async (id: string) => {
    await deleteCustomDrill(id);
    setCustomDrills((prev) => prev.filter((d) => d.id !== id));
  };

  const handleDeleteSession = (id: string, title: string) => {
    Alert.alert('Delete Session', `Delete "${title || 'Untitled Session'}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
      }},
    ]);
  };

  const handleDuplicateSession = async (id: string) => {
    const dup = await duplicateSession(id);
    if (dup) setSessions(prev => [dup, ...prev]);
  };

  const handleClearAllData = () => {
    Alert.alert('Clear All Data', 'Delete all your data? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: async () => {
        await clearAllData();
        await clearCustomDrills();
        await clearContacts();
        await loadData();
      }},
    ]);
  };

  const getInitials = (name: string) =>
    name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || 'DF';

  const tabCounts = { custom: customDrills.length, saved: savedDrills.length, sessions: sessions.length };

  const renderColumnToggle = () => (
    <View style={ps.viewToggle}>
      <TouchableOpacity style={[ps.toggleBtn, gridCols === 1 && ps.toggleBtnActive]} onPress={() => setGridCols(1)}>
        <LayoutList size={14} color={gridCols === 1 ? colors.primaryForeground : colors.mutedForeground} />
      </TouchableOpacity>
      <TouchableOpacity style={[ps.toggleBtn, gridCols === 2 && ps.toggleBtnActive]} onPress={() => setGridCols(2)}>
        <LayoutGrid size={14} color={gridCols === 2 ? colors.primaryForeground : colors.mutedForeground} />
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = (icon: React.ReactNode, title: string, subtitle: string) => (
    <View style={ps.emptyState}>
      <View style={ps.emptyIcon}>{icon}</View>
      <Text style={ps.emptyTitle}>{title}</Text>
      <Text style={ps.emptySubtitle}>{subtitle}</Text>
    </View>
  );

  const renderCustomDrills = () => {
    if (customDrills.length === 0)
      return renderEmptyState(<PenTool size={28} color={colors.mutedForeground} />, 'No custom drills yet', 'Create your first drill with the visual editor');
    return (
      <View>
        <View style={ps.tabSubHeader}><Text style={ps.tabCount}>{customDrills.length} drills</Text>{renderColumnToggle()}</View>
        <View style={gridCols === 2 ? ps.grid2 : undefined}>
          {customDrills.map((drill) => (
            <View key={drill.id} style={gridCols === 2 ? ps.gridItem : undefined}>
              <CustomDrillCard drill={drill} onView={setSelectedCustomDrill} onDelete={handleDeleteCustomDrill} compact={gridCols === 2} />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSavedDrills = () => {
    if (savedDrills.length === 0)
      return renderEmptyState(<BookmarkX size={28} color={colors.mutedForeground} />, 'No saved drills yet', 'Save drills from the Library to access them here');
    return (
      <View>
        <View style={ps.tabSubHeader}><Text style={ps.tabCount}>{savedDrills.length} saved</Text>{renderColumnToggle()}</View>
        <View style={gridCols === 2 ? ps.grid2 : undefined}>
          {savedDrills.map((drill) => (
            <View key={drill.id} style={gridCols === 2 ? ps.gridItem : undefined}>
              <DrillCard drill={drill} onPress={setSelectedDrill} onSave={handleRemoveDrill} isSaved={true} compact={gridCols === 2} />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const renderSessions = () => {
    if (sessions.length === 0)
      return renderEmptyState(<CalendarDays size={28} color={colors.mutedForeground} />, 'No sessions yet', 'Create a training session to see it here');
    return (
      <View>
        <View style={ps.tabSubHeader}><Text style={ps.tabCount}>{sessions.length} sessions</Text></View>
        {sessions.map((session) => {
          const totalDur = session.activities.reduce((s, a) => s + a.duration_minutes, 0);
          const actCount = session.activities.length;
          return (
            <TouchableOpacity
              key={session.id}
              style={ps.sessionCard}
              onPress={() => router.push({ pathname: '/session-view', params: { id: session.id } })}
              activeOpacity={0.7}
            >
              <View style={ps.sessionCardHeader}>
                <Text style={ps.sessionTitle} numberOfLines={1}>{session.title || 'Untitled Session'}</Text>
                <View style={ps.sessionActions}>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => router.push({ pathname: '/session-editor', params: { id: session.id } })}>
                    <Edit size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => handleDuplicateSession(session.id)}>
                    <Copy size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => handleDeleteSession(session.id, session.title)}>
                    <Trash2 size={14} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={ps.sessionMeta}>
                {session.session_date ? (
                  <View style={ps.sessionMetaRow}><Calendar size={13} color={colors.mutedForeground} /><Text style={ps.sessionMetaText}>{formatDate(session.session_date)}{session.session_time ? ` at ${session.session_time}` : ''}</Text></View>
                ) : null}
                {session.team_name ? (
                  <View style={ps.sessionMetaRow}><Users size={13} color={colors.mutedForeground} /><Text style={ps.sessionMetaText}>{session.team_name}</Text></View>
                ) : null}
                <View style={ps.sessionMetaRow}><Clock size={13} color={colors.mutedForeground} /><Text style={ps.sessionMetaText}>{actCount} {actCount === 1 ? 'activity' : 'activities'} · {totalDur} min</Text></View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={ps.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={ps.header}>
        <View style={ps.headerLeft}>
          <View style={ps.logoContainer}><User size={20} color={colors.primaryForeground} /></View>
          <Text style={ps.headerTitle}>My Profile</Text>
        </View>
        <TouchableOpacity style={ps.settingsButton} onPress={() => setSettingsOpen(true)}>
          <Settings size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <ScrollView style={ps.scrollView} contentContainerStyle={ps.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={ps.profileCard}>
          <View style={ps.banner} />
          <View style={ps.profileBody}>
            <View style={ps.avatarRow}>
              <TouchableOpacity style={ps.avatar} onPress={handlePickAvatar}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={{ width: 64, height: 64, borderRadius: 32 }} />
                ) : (
                  <Text style={ps.avatarText}>{getInitials(profile.name)}</Text>
                )}
                <View style={ps.cameraOverlay}><Camera size={14} color="#fff" /></View>
              </TouchableOpacity>
              <View style={ps.profileInfo}>
                <Text style={ps.profileName}>{profile.name || 'Coach'}</Text>
                <Text style={ps.profileTeam}>{profile.teamName || 'No team set'}</Text>
              </View>
            </View>
            <View style={ps.statsRow}>
              <View style={ps.statBox}><Text style={ps.statNumber}>{customDrills.length}</Text><Text style={ps.statLabel}>My Drills</Text></View>
              <View style={ps.statBox}><Text style={ps.statNumber}>{savedDrills.length}</Text><Text style={ps.statLabel}>Saved</Text></View>
              <View style={ps.statBox}><Text style={ps.statNumber}>{sessions.length}</Text><Text style={ps.statLabel}>Sessions</Text></View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={ps.tabBar}>
          {([
            { key: 'custom' as ProfileTab, icon: PenTool, label: 'Drills' },
            { key: 'saved' as ProfileTab, icon: BookmarkX, label: 'Saved' },
            { key: 'sessions' as ProfileTab, icon: CalendarDays, label: 'Sessions' },
          ]).map(({ key, icon: Icon, label }) => (
            <TouchableOpacity key={key} style={[ps.tabItem, activeTab === key && ps.tabItemActive]} onPress={() => setActiveTab(key)}>
              <Icon size={14} color={activeTab === key ? colors.foreground : colors.mutedForeground} />
              <Text style={[ps.tabLabel, activeTab === key && ps.tabLabelActive]}>{label} ({tabCounts[key]})</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={ps.tabContent}>
          {activeTab === 'custom' && renderCustomDrills()}
          {activeTab === 'saved' && renderSavedDrills()}
          {activeTab === 'sessions' && renderSessions()}
        </View>
      </ScrollView>

      {/* Settings Modal */}
      <Modal visible={settingsOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setSettingsOpen(false)}>
        <Pressable style={ps.settingsBackdrop} onPress={() => setSettingsOpen(false)} />
        <View style={ps.settingsSheet}>
          <View style={ps.settingsHandle}><View style={ps.handle} /></View>
          <TouchableOpacity style={ps.settingsClose} onPress={() => setSettingsOpen(false)}>
            <X size={22} color={colors.foreground} />
          </TouchableOpacity>

          <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={ps.settingsForm} showsVerticalScrollIndicator={false}>
            <Text style={ps.settingsTitle}>Settings</Text>

            <View style={ps.formGroup}>
              <Text style={ps.formLabel}>Name</Text>
              <TextInput style={ps.formInput} placeholder="Your name" placeholderTextColor={colors.mutedForeground} value={profile.name} onChangeText={(v) => handleProfileChange('name', v)} />
            </View>
            <View style={ps.formGroup}>
              <Text style={ps.formLabel}>Email</Text>
              <TextInput style={ps.formInput} placeholder="your@email.com" placeholderTextColor={colors.mutedForeground} value={profile.email} onChangeText={(v) => handleProfileChange('email', v)} keyboardType="email-address" autoCapitalize="none" />
            </View>
            <View style={ps.formGroup}>
              <Text style={ps.formLabel}>Team / Organization</Text>
              <TextInput style={ps.formInput} placeholder="Your team name" placeholderTextColor={colors.mutedForeground} value={profile.teamName} onChangeText={(v) => handleProfileChange('teamName', v)} />
            </View>

            <TouchableOpacity style={[ps.saveButton, !hasChanges && ps.saveButtonDisabled]} onPress={handleSaveProfile} disabled={!hasChanges}>
              <Save size={16} color={colors.primaryForeground} />
              <Text style={ps.saveButtonText}>Save Settings</Text>
            </TouchableOpacity>

            <View style={ps.contactsDivider} />
            <ContactsManager contacts={contacts} onContactsChange={setContacts} />

            <TouchableOpacity style={ps.clearDataButton} onPress={handleClearAllData}>
              <Text style={ps.clearDataText}>Clear All Data</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      <DrillDetailModal drill={selectedDrill} isOpen={selectedDrill !== null} onClose={() => setSelectedDrill(null)} isSaved={true} onSave={handleRemoveDrill} />
      <CustomDrillDetailModal drill={selectedCustomDrill} isOpen={selectedCustomDrill !== null} onClose={() => setSelectedCustomDrill(null)} />
    </SafeAreaView>
  );
}

const ps = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoContainer: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground },
  settingsButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.md, paddingTop: spacing.lg, paddingBottom: 120 },
  profileCard: { borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden', marginBottom: spacing.lg },
  banner: { height: 80, backgroundColor: colors.primary, opacity: 0.7 },
  profileBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  avatarRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, marginTop: -32 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: colors.card, overflow: 'hidden' },
  avatarText: { fontSize: 22, fontWeight: '700', color: colors.primaryForeground },
  cameraOverlay: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  profileInfo: { flex: 1, paddingBottom: 4 },
  profileName: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  profileTeam: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.md, backgroundColor: 'rgba(139, 145, 158, 0.1)' },
  statNumber: { fontSize: 18, fontWeight: '700', color: colors.foreground },
  statLabel: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
  tabBar: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.md },
  tabItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: borderRadius.sm },
  tabItemActive: { backgroundColor: colors.background },
  tabLabel: { fontSize: 11, fontWeight: '500', color: colors.mutedForeground },
  tabLabelActive: { color: colors.foreground, fontWeight: '600' },
  tabContent: { minHeight: 200 },
  tabSubHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  tabCount: { fontSize: 13, color: colors.mutedForeground },
  viewToggle: { flexDirection: 'row', gap: 4 },
  toggleBtn: { width: 28, height: 28, borderRadius: borderRadius.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '50%' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 2, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, borderRadius: borderRadius.lg },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: colors.foreground, marginBottom: spacing.xs },
  emptySubtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: spacing.xl },
  // Session cards with full actions
  sessionCard: { backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  sessionCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.sm },
  sessionTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, flex: 1, marginRight: spacing.sm },
  sessionActions: { flexDirection: 'row', gap: spacing.md },
  sessionMeta: { gap: 4 },
  sessionMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionMetaText: { fontSize: 12, color: colors.mutedForeground },
  // Settings modal
  settingsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  settingsSheet: { backgroundColor: colors.background, borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, paddingBottom: 40 },
  settingsHandle: { alignItems: 'center', paddingVertical: spacing.sm },
  handle: { width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2 },
  settingsClose: { position: 'absolute', top: spacing.md, right: spacing.md, width: 36, height: 36, borderRadius: 18, backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  settingsTitle: { fontSize: 20, fontWeight: '700', color: colors.foreground, marginBottom: spacing.md },
  settingsForm: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg },
  formGroup: { gap: spacing.xs },
  formLabel: { fontSize: 13, fontWeight: '500', color: colors.foreground },
  formInput: { backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.foreground, fontSize: 15 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: borderRadius.md, marginTop: spacing.sm },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontSize: 14, fontWeight: '600', color: colors.primaryForeground },
  contactsDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  clearDataButton: { alignItems: 'center', paddingVertical: 12, marginTop: spacing.sm },
  clearDataText: { fontSize: 13, color: colors.destructive, fontWeight: '500' },
});
