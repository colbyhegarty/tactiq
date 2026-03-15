import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Edit, Trash2, Clock, Users, Target } from 'lucide-react-native';
import { CustomDrill } from '../types/customDrill';
import { getDifficultyColor, getCategoryColor } from '../lib/api';
import { colors, borderRadius, spacing } from '../theme/colors';
import { FIELD_COLORS } from '../types/customDrill';

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
  const { formData } = drill;
  const categoryColor = getCategoryColor(formData.category);
  const difficultyColor = getDifficultyColor(formData.difficulty);

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

  return (
    <TouchableOpacity
      style={[styles.card, compact && styles.cardCompact]}
      onPress={() => onView(drill)}
      activeOpacity={0.8}
    >
      {/* Diagram Preview */}
      <View style={styles.diagramContainer}>
        {/* Simple field background with player dot indicators */}
        <View style={styles.fieldBg}>
          {drill.diagramData.players.length > 0 ? (
            <View style={styles.playerDotsContainer}>
              {drill.diagramData.players.slice(0, 12).map((player, i) => {
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
                        backgroundColor: roleColors[player.role] || '#f4a261',
                        left: `${Math.min(Math.max(player.position.x, 5), 95)}%`,
                        top: `${Math.min(Math.max(player.position.y, 5), 95)}%`,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ) : (
            <Text style={styles.noPlayers}>No diagram</Text>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={[styles.content, compact && styles.contentCompact]}>
        <Text
          style={[styles.title, compact && styles.titleCompact]}
          numberOfLines={compact ? 2 : 1}
        >
          {formData.name || 'Untitled Drill'}
        </Text>

        {/* Tags */}
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

        {/* Description (hidden in compact) */}
        {!compact && formData.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {formData.description}
          </Text>
        ) : null}

        {/* Meta */}
        <View style={styles.meta}>
          {(formData.playerCount || playerCount) ? (
            <View style={styles.metaItem}>
              <Users size={12} color={colors.mutedForeground} />
              <Text style={styles.metaText}>
                {formData.playerCount || playerCount}
              </Text>
            </View>
          ) : null}
          {formData.duration ? (
            <View style={styles.metaItem}>
              <Clock size={12} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{formData.duration}</Text>
            </View>
          ) : null}
          {formData.ageGroup ? (
            <View style={styles.metaItem}>
              <Target size={12} color={colors.mutedForeground} />
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
              <Edit size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.footerButton}
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={14} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  cardCompact: {
    marginHorizontal: spacing.xs,
    marginVertical: spacing.xs,
  },
  diagramContainer: {
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  fieldBg: {
    flex: 1,
    backgroundColor: FIELD_COLORS.GRASS_DARK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerDotsContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  playerDot: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    marginLeft: -5,
    marginTop: -5,
  },
  noPlayers: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  content: {
    padding: spacing.md,
  },
  contentCompact: {
    padding: spacing.sm,
  },
  title: {
    color: colors.foreground,
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
    color: colors.mutedForeground,
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
    color: colors.mutedForeground,
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dateText: {
    color: colors.mutedForeground,
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
