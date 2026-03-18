import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import {
  X,
  Clock,
  Users,
  GraduationCap,
  ClipboardList,
  Play,
  RefreshCw,
  Lightbulb,
  Edit,
} from 'lucide-react-native';
import { CustomDrill } from '../types/customDrill';
import { getCategoryColor, getDifficultyColor } from '../lib/api';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { FIELD_COLORS } from '../types/customDrill';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface CustomDrillDetailModalProps {
  drill: CustomDrill | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (drill: CustomDrill) => void;
}

type TabKey = 'setup' | 'instructions' | 'variations' | 'coaching';

export function CustomDrillDetailModal({
  drill,
  isOpen,
  onClose,
  onEdit,
}: CustomDrillDetailModalProps) {
  const { colors: tc } = useTheme();
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

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const modalStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const handleClose = () => {
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 }, () => {
      runOnJS(onClose)();
    });
  };

  if (!drill) return null;

  const { formData, diagramData } = drill;
  const categoryColor = getCategoryColor(formData.category);
  const difficultyColor = getDifficultyColor(formData.difficulty);

  const hasSetup = !!formData.setupText;
  const hasInstructions = !!formData.instructionsText;
  const hasVariations = !!formData.variationsText;
  const hasCoachingPoints = !!formData.coachingPointsText;
  const hasAnyContent = hasSetup || hasInstructions || hasVariations || hasCoachingPoints;

  const formatText = (text?: string) => {
    if (!text) return null;
    const lines = text.split('\n').filter((line) => line.trim());
    return lines.map((line, index) => {
      const trimmed = line.trim();
      const isBullet =
        trimmed.startsWith('•') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('-');
      const numberedMatch = trimmed.match(/^(\d+)[\.\)]\s*(.+)/);
      const content = isBullet
        ? trimmed.replace(/^[•*-]\s*/, '')
        : numberedMatch
          ? numberedMatch[2]
          : trimmed;

      if (isBullet || numberedMatch) {
        return (
          <View key={index} style={styles.bulletItem}>
            <Text style={styles.bulletPoint}>▸</Text>
            <Text style={styles.bulletText}>{content}</Text>
          </View>
        );
      }
      return (
        <Text key={index} style={styles.paragraphText}>
          {trimmed}
        </Text>
      );
    });
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'setup':
        return formatText(formData.setupText);
      case 'instructions':
        return formatText(formData.instructionsText);
      case 'variations':
        return formatText(formData.variationsText);
      case 'coaching':
        return formatText(formData.coachingPointsText);
      default:
        return null;
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      <Animated.View style={[styles.modalContainer, modalStyle]}>
        <View style={styles.modal}>
          {/* Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <X size={24} color={tc.foreground} />
          </TouchableOpacity>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <Text style={styles.title}>
              {formData.name || 'Untitled Drill'}
            </Text>

            {/* Badges */}
            <View style={styles.badgesRow}>
              {formData.category ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: categoryColor.bg },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: categoryColor.text }]}>
                    {formData.category.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {formData.difficulty ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: difficultyColor.bg },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: difficultyColor.text }]}
                  >
                    {formData.difficulty.charAt(0) +
                      formData.difficulty.slice(1).toLowerCase()}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.badgesRow}>
              {formData.playerCount ? (
                <View style={styles.badgeOutline}>
                  <Users size={12} color={tc.mutedForeground} />
                  <Text style={styles.badgeOutlineText}>
                    {formData.playerCount} players
                  </Text>
                </View>
              ) : null}
              {formData.duration ? (
                <View style={styles.badgeOutline}>
                  <Clock size={12} color={tc.mutedForeground} />
                  <Text style={styles.badgeOutlineText}>
                    {formData.duration}
                  </Text>
                </View>
              ) : null}
              {formData.ageGroup ? (
                <View style={styles.badgeOutline}>
                  <GraduationCap size={12} color={tc.mutedForeground} />
                  <Text style={styles.badgeOutlineText}>
                    {formData.ageGroup}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Diagram Preview */}
            <View style={styles.diagramSection}>
              <View style={styles.diagramContainer}>
                <View style={styles.fieldBg}>
                  {diagramData.players.length > 0 ? (
                    <View style={StyleSheet.absoluteFill}>
                      {diagramData.players.map((player, i) => {
                        const roleColors: Record<string, string> = {
                          ATTACKER: '#e63946',
                          DEFENDER: '#457b9d',
                          GOALKEEPER: '#f1fa3c',
                          NEUTRAL: '#f4a261',
                        };
                        return (
                          <View
                            key={i}
                            style={[
                              styles.playerDot,
                              {
                                backgroundColor:
                                  roleColors[player.role] || '#f4a261',
                                left: `${Math.min(Math.max(player.position.x, 5), 95)}%`,
                                top: `${Math.min(Math.max(player.position.y, 5), 95)}%`,
                              },
                            ]}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.noPlayersText}>No diagram</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Overview */}
            {formData.description ? (
              <View style={styles.overviewSection}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionIcon}>📋</Text>
                  <Text style={styles.sectionTitle}>Overview</Text>
                </View>
                <Text style={styles.overviewText}>{formData.description}</Text>
              </View>
            ) : null}

            {/* Tabbed Content */}
            {hasAnyContent && (
              <View style={styles.tabbedSection}>
                <View style={styles.tabsHeader}>
                  {hasSetup && (
                    <TouchableOpacity
                      style={[
                        styles.tab,
                        activeTab === 'setup' && styles.tabActive,
                      ]}
                      onPress={() => setActiveTab('setup')}
                    >
                      <ClipboardList
                        size={16}
                        color={
                          activeTab === 'setup'
                            ? tc.foreground
                            : tc.mutedForeground
                        }
                      />
                    </TouchableOpacity>
                  )}
                  {hasInstructions && (
                    <TouchableOpacity
                      style={[
                        styles.tab,
                        activeTab === 'instructions' && styles.tabActive,
                      ]}
                      onPress={() => setActiveTab('instructions')}
                    >
                      <Play
                        size={16}
                        color={
                          activeTab === 'instructions'
                            ? tc.foreground
                            : tc.mutedForeground
                        }
                      />
                    </TouchableOpacity>
                  )}
                  {hasVariations && (
                    <TouchableOpacity
                      style={[
                        styles.tab,
                        activeTab === 'variations' && styles.tabActive,
                      ]}
                      onPress={() => setActiveTab('variations')}
                    >
                      <RefreshCw
                        size={16}
                        color={
                          activeTab === 'variations'
                            ? tc.foreground
                            : tc.mutedForeground
                        }
                      />
                    </TouchableOpacity>
                  )}
                  {hasCoachingPoints && (
                    <TouchableOpacity
                      style={[
                        styles.tab,
                        activeTab === 'coaching' && styles.tabActive,
                      ]}
                      onPress={() => setActiveTab('coaching')}
                    >
                      <Lightbulb
                        size={16}
                        color={
                          activeTab === 'coaching'
                            ? tc.foreground
                            : tc.mutedForeground
                        }
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.tabContent}>{getTabContent()}</View>
              </View>
            )}

            {/* Actions */}
            {onEdit && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButtonOutline}
                  onPress={() => onEdit(drill)}
                >
                  <Edit size={18} color={tc.primary} />
                  <Text style={styles.actionButtonOutlineText}>Edit Drill</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#151823',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: SCREEN_HEIGHT * 0.92,
    minHeight: SCREEN_HEIGHT * 0.5,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#2a3142',
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e2433',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl + 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e8eaed',
    marginBottom: spacing.md,
    paddingRight: 50,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: '#2a3142',
  },
  badgeOutlineText: {
    fontSize: 11,
    color: '#8b919e',
  },
  diagramSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  diagramContainer: {
    aspectRatio: 4 / 3,
    backgroundColor: '#1e2433',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a3142',
  },
  fieldBg: {
    flex: 1,
    backgroundColor: FIELD_COLORS.GRASS_DARK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerDot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    marginLeft: -7,
    marginTop: -7,
  },
  noPlayersText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  overviewSection: {
    backgroundColor: 'rgba(74, 157, 110, 0.08)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(74, 157, 110, 0.15)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionIcon: { fontSize: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e8eaed',
  },
  overviewText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#8b919e',
  },
  tabbedSection: { marginBottom: spacing.lg },
  tabsHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e2433',
    borderRadius: borderRadius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  tabActive: { backgroundColor: '#151823' },
  tabContent: {
    backgroundColor: '#1e2433',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#2a3142',
  },
  bulletItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bulletPoint: {
    color: '#4a9d6e',
    fontSize: 12,
    marginTop: 2,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#e8eaed',
  },
  paragraphText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#e8eaed',
    marginBottom: spacing.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#4a9d6e',
  },
  actionButtonOutlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a9d6e',
  },
});
