import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Edit, Trash2, Clock, Users, Target } from 'lucide-react-native';
import { CustomDrill, DiagramData } from '../types/customDrill';
import { getDifficultyColor, getCategoryColor } from '../lib/api';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { DrillDiagramView } from './DrillDiagramView';
import { convertToDrillJson } from '../lib/drillConverter';

interface CustomDrillCardProps {
  drill: CustomDrill;
  onView: (drill: CustomDrill) => void;
  onEdit?: (drill: CustomDrill) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}

export function CustomDrillCard({
  drill,
  onView,
  onEdit,
  onDelete,
  compact = false,
}: CustomDrillCardProps) {
  const { colors: tc } = useTheme();
  const { formData } = drill;
  const categoryColor = getCategoryColor(formData.category);
  const difficultyColor = getDifficultyColor(formData.difficulty);

  const drillJson = useMemo(() => convertToDrillJson(drill.diagramData), [drill.diagramData]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Drill',
      `Are you sure you want to delete "${formData.name || 'Untitled Drill'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(drill.id),
        },
      ],
    );
  };

  const playerCount =
    drill.diagramData.players.length > 0
      ? drill.diagramData.players.length
      : undefined;

  const hasDiagramContent = drill.diagramData.players.length > 0 ||
    drill.diagramData.cones.length > 0 ||
    drill.diagramData.balls.length > 0 ||
    drill.diagramData.goals.length > 0;

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={() => onView(drill)}
      activeOpacity={0.8}
    >
      {/* Diagram Preview */}
      <View style={styles.diagramContainer}>
        {hasDiagramContent ? (
          <View style={styles.diagramInner} pointerEvents="none">
            <DrillDiagramView drillJson={drillJson} mode="static" targetAspectRatio={4 / 3} />
          </View>
        ) : (
          <View style={styles.fieldBg}>
            <Text style={styles.noPlayers}>No diagram</Text>
          </View>
        )}
      </View>

      {/* Content - flex:1 pushes footer to bottom */}
      <View style={[styles.content, compact && styles.contentCompact]}>
        {/* Top section: title, tags, description - can vary in height */}
        <View>
          <Text
            style={[styles.title, compact && styles.titleCompact]}
            numberOfLines={compact ? 2 : 1}
          >
            {formData.name || 'Untitled Drill'}
          </Text>

          {/* Tags */}
          {(formData.category || formData.difficulty) ? (
            <View style={styles.tags}>
              {formData.category ? (
                <View style={[styles.tag, { backgroundColor: categoryColor.bg }]}>
                  <Text style={[styles.tagText, { color: categoryColor.text }]}>
                    {formData.category.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {formData.difficulty ? (
                <View style={[styles.tag, { backgroundColor: difficultyColor.bg }]}>
                  <Text style={[styles.tagText, { color: difficultyColor.text }]}>
                    {formData.difficulty.charAt(0) +
                      formData.difficulty.slice(1).toLowerCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Description (hidden in compact) */}
          {!compact && formData.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {formData.description}
            </Text>
          ) : null}
        </View>

        {/* Spacer pushes meta to bottom of content area */}
        <View style={{ flex: 1 }} />

        {/* Meta - always at bottom of content area */}
        <View style={styles.meta}>
          {(formData.playerCount || playerCount) ? (
            <View style={styles.metaItem}>
              <Users size={12} color={tc.mutedForeground} />
              <Text style={styles.metaText}>
                {formData.playerCount || playerCount}
              </Text>
            </View>
          ) : null}
          {formData.duration ? (
            <View style={styles.metaItem}>
              <Clock size={12} color={tc.mutedForeground} />
              <Text style={styles.metaText}>{formData.duration}</Text>
            </View>
          ) : null}
          {formData.ageGroup ? (
            <View style={styles.metaItem}>
              <Target size={12} color={tc.mutedForeground} />
              <Text style={styles.metaText}>{formData.ageGroup}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.dateText}>
          {new Date(drill.updatedAt).toLocaleDateString()}
        </Text>
        <View style={styles.footerActions}>
          {onEdit && (
            <TouchableOpacity
              style={styles.footerButton}
              onPress={() => onEdit(drill)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Edit size={14} color={tc.mutedForeground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.footerButton}
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={14} color={tc.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1e2433',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#2a3142',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  cardCompact: {
    marginHorizontal: spacing.xs,
    marginVertical: spacing.xs,
    flex: 1,
  },
  diagramContainer: {
    aspectRatio: 4 / 3,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#63b043',
  },
  diagramInner: {
    width: '100%',
  },
  fieldBg: {
    flex: 1,
    backgroundColor: '#63b043',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPlayers: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  contentCompact: {
    padding: spacing.sm,
  },
  title: {
    color: '#e8eaed',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  titleCompact: {
    fontSize: 13,
    marginBottom: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.sm,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  description: {
    color: '#8b919e',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#8b919e',
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2a3142',
  },
  dateText: {
    color: '#8b919e',
    fontSize: 11,
  },
  footerActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerButton: {
    padding: 4,
  },
});
