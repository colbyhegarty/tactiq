import { Image } from 'expo-image';
import {
  Bookmark, BookmarkCheck,
  ClipboardList,
  Clock,
  Film, GraduationCap,
  Image as ImageIcon,
  Lightbulb,
  Play,
  RefreshCw,
  Sparkles,
  Users,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Dimensions, Modal, Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { getCategoryColor, getDifficultyColor } from '../lib/api';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Drill } from '../types/drill';
import { DrillDiagramView } from './DrillDiagramView';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface DrillDetailModalProps {
  drill: Drill | null;
  isOpen: boolean;
  onClose: () => void;
  isSaved?: boolean;
  onSave?: (drill: Drill) => void;
  onUseAsTemplate?: (drill: Drill) => void;
}

type TabKey = 'setup' | 'instructions' | 'variations' | 'coaching';

export function DrillDetailModal({ drill, isOpen, onClose, isSaved = false, onSave, onUseAsTemplate }: DrillDetailModalProps) {
  const { colors: tc } = useTheme();
  const [viewMode, setViewMode] = useState<'static' | 'animated'>('animated');
  const [activeTab, setActiveTab] = useState<TabKey>('setup');
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, { damping: 20, stiffness: 90 });
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
              {drill.has_animation && <View style={s.badgeOutline}><Play size={12} color={tc.mutedForeground} /><Text style={s.badgeOutlineText}>Animated</Text></View>}
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
                  <Image source={{ uri: drill.svg_url }} style={s.diagramImage} contentFit="contain" transition={200} />
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
              <TouchableOpacity style={[s.actionButton, isSaved && s.actionButtonSecondary]} onPress={() => onSave?.(drill)}>
                {isSaved ? <BookmarkCheck size={18} color={tc.foreground} /> : <Bookmark size={18} color={tc.primaryForeground} />}
                <Text style={[s.actionButtonText, isSaved && s.actionButtonTextSecondary]}>{isSaved ? 'Saved' : 'Save to My Drills'}</Text>
              </TouchableOpacity>
              {onUseAsTemplate && (
                <TouchableOpacity style={s.actionButtonOutline} onPress={() => onUseAsTemplate(drill)}>
                  <Sparkles size={18} color={tc.primary} />
                  <Text style={s.actionButtonOutlineText}>Use as Template</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  modalContainer: { flex: 1, justifyContent: 'flex-end' },
  modal: { backgroundColor: '#151823', borderTopLeftRadius: 0, borderTopRightRadius: 0, maxHeight: SCREEN_HEIGHT, minHeight: SCREEN_HEIGHT },
  handleContainer: { alignItems: 'center', paddingVertical: spacing.sm },
  handle: { width: 40, height: 4, backgroundColor: '#2a3142', borderRadius: 2 },
  closeButton: { position: 'absolute', top: spacing.md, right: spacing.md, width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e2433', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl + 40 },
  title: { fontSize: 24, fontWeight: '700', color: '#e8eaed', marginBottom: spacing.md, paddingRight: 50 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: borderRadius.full },
  badgeText: { fontSize: 11, fontWeight: '600' },
  badgeOutline: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: borderRadius.full, borderWidth: 1, borderColor: '#2a3142' },
  badgeOutlineText: { fontSize: 11, color: '#8b919e' },
  diagramSection: { marginTop: spacing.md, marginBottom: spacing.lg },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#1e2433', borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.md, alignSelf: 'center' },
  toggleButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  toggleButtonActive: { backgroundColor: '#4a9d6e' },
  toggleText: { fontSize: 13, color: '#8b919e', fontWeight: '500' },
  toggleTextActive: { color: '#ffffff' },
  diagramContainer: { aspectRatio: 4 / 3, backgroundColor: '#1e2433', borderRadius: borderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: '#2a3142' },
  diagramImage: { width: '100%', height: '100%' },
  diagramPlaceholder: { height: 200, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e2433', borderRadius: borderRadius.lg },
  diagramPlaceholderText: { color: '#8b919e', fontSize: 14 },
  overviewSection: { backgroundColor: 'rgba(74, 157, 110, 0.08)', borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: 'rgba(74, 157, 110, 0.15)' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sectionIcon: { fontSize: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#e8eaed' },
  overviewText: { fontSize: 14, lineHeight: 22, color: '#8b919e' },
  tabbedSection: { marginBottom: spacing.lg },
  tabsHeader: { flexDirection: 'row', backgroundColor: '#1e2433', borderRadius: borderRadius.md, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  tabActive: { backgroundColor: '#151823' },
  tabContent: { backgroundColor: '#1e2433', borderRadius: borderRadius.lg, padding: spacing.md, borderWidth: 1, borderColor: '#2a3142' },
  bulletItem: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  bulletPoint: { color: '#4a9d6e', fontSize: 12, marginTop: 2 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 22, color: '#e8eaed' },
  paragraphText: { fontSize: 14, lineHeight: 22, color: '#e8eaed', marginBottom: spacing.sm },
  actionButtons: { flexDirection: 'row', gap: spacing.md },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: '#4a9d6e', paddingVertical: 14, borderRadius: borderRadius.md },
  actionButtonSecondary: { backgroundColor: '#1e2433', borderWidth: 1, borderColor: '#2a3142' },
  actionButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  actionButtonTextSecondary: { color: '#e8eaed' },
  actionButtonOutline: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 14, borderRadius: borderRadius.md, borderWidth: 1, borderColor: '#4a9d6e' },
  actionButtonOutlineText: { fontSize: 14, fontWeight: '600', color: '#4a9d6e' },
});
