import { Image } from 'expo-image';
import { Bookmark, BookmarkCheck, Clock, Target, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { getCategoryColor, getDifficultyColor } from '../lib/api';
import { borderRadius, colors, spacing } from '../theme/colors';
import { Drill } from '../types/drill';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = spacing.md;

interface DrillCardProps {
  drill: Drill;
  onPress: (drill: Drill) => void;
  onSave?: (drill: Drill) => void;
  isSaved?: boolean;
  compact?: boolean;
  onQuickView?: (drill: Drill) => void;
}

export function DrillCard({
  drill,
  onPress,
  onSave,
  isSaved = false,
  compact = false,
  onQuickView,
}: DrillCardProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const categoryColor = getCategoryColor(drill.category);
  const difficultyColor = getDifficultyColor(drill.difficulty);
  const scale = useSharedValue(1);
  const titleColorActive = useSharedValue(0);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    color: titleColorActive.value > 0.5 ? colors.primary : colors.foreground,
  }));

  const [showOverlay, setShowOverlay] = useState(false);

  return (
    <Animated.View
      style={[styles.card, compact && styles.cardCompact, cardAnimStyle]}
      onTouchStart={() => {
        scale.value = withTiming(1.03, { duration: 150 });
        titleColorActive.value = withTiming(1, { duration: 150 });
      }}
      onTouchEnd={() => {
        scale.value = withTiming(1, { duration: 200 });
        titleColorActive.value = withTiming(0, { duration: 200 });
      }}
      onTouchCancel={() => {
        scale.value = withTiming(1, { duration: 200 });
        titleColorActive.value = withTiming(0, { duration: 200 });
      }}
    >
      {/* Diagram Image */}
      <View style={styles.imageContainer}>
        <TouchableOpacity
          style={styles.imageContainer}
          onPress={() => setShowOverlay(!showOverlay)}
          activeOpacity={0.95}
        >
          {drill.svg_url && !imageError ? (
            <>
              <Image
                source={{ uri: drill.svg_url }}
                style={styles.image}
                contentFit="cover"
                transition={200}
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => { setImageError(true); setImageLoading(false); }}
              />
              {imageLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No diagram</Text>
            </View>
          )}

          {/* Bookmark Button */}
          <TouchableOpacity
            style={[styles.bookmarkButton, isSaved && styles.bookmarkButtonSaved]}
            onPress={(e) => { e.stopPropagation?.(); onSave?.(drill); }}
          >
            {isSaved ? (
              <BookmarkCheck size={compact ? 14 : 16} color={colors.primaryForeground} fill={colors.primaryForeground} />
            ) : (
              <Bookmark size={compact ? 14 : 16} color={colors.mutedForeground} />
            )}
          </TouchableOpacity>

          {/* Animated Badge */}
          {drill.has_animation && (
            <View style={styles.animatedBadge}>
              <Text style={styles.animatedDot}>●</Text>
              <Text style={styles.animatedText}>Animated</Text>
            </View>
          )}

          {/* Tap overlay with Quick View + View Drill */}
          {showOverlay && (
            <View style={styles.overlay}>
              {onQuickView && (
                <TouchableOpacity style={styles.overlayBtnWhite} onPress={() => { setShowOverlay(false); onQuickView(drill); }}>
                  <Text style={styles.overlayBtnWhiteText}>Quick View</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.overlayBtnGreen} onPress={() => { setShowOverlay(false); onPress(drill); }}>
                <Text style={styles.overlayBtnGreenText}>View Drill</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={[styles.content, compact && styles.contentCompact]}>
        {/* Title */}
        <Animated.Text style={[styles.title, compact && styles.titleCompact, titleAnimStyle]} numberOfLines={compact ? 2 : 1}>
          {drill.name}
        </Animated.Text>

        {/* Tags */}
        <View style={styles.tags}>
          {drill.category?.split(',').map((cat, index) => {
            const catColor = getCategoryColor(cat.trim());
            return (
              <View key={index} style={[styles.tag, { backgroundColor: catColor.bg }]}>
                <Text style={[styles.tagText, { color: catColor.text }]}>
                  {cat.trim().toUpperCase()}
                </Text>
              </View>
            );
          })}
          {drill.difficulty && (
            <View style={[styles.tag, { backgroundColor: difficultyColor.bg }]}>
              <Text style={[styles.tagText, { color: difficultyColor.text }]}>
                {drill.difficulty.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Description (hidden in compact) */}
        {!compact && drill.description && (
          <Text style={styles.description} numberOfLines={2}>
            {drill.description}
          </Text>
        )}

        {/* Meta Info */}
        <View style={styles.meta}>
          {drill.player_count != null && (
            <View style={styles.metaItem}>
              <Users size={12} color={colors.mutedForeground} />
              <Text style={styles.metaText}>
                {drill.player_count_display || `${drill.player_count}+`}
              </Text>
            </View>
          )}
          {drill.duration != null && (
            <View style={styles.metaItem}>
              <Clock size={12} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{drill.duration} min</Text>
            </View>
          )}
          {!compact && drill.age_group && (
            <View style={styles.metaItem}>
              <Target size={12} color={colors.mutedForeground} />
              <Text style={styles.metaText}>{drill.age_group}</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginHorizontal: CARD_MARGIN,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  cardCompact: {
    marginHorizontal: spacing.xs,
    marginVertical: spacing.xs,
  },
  imageContainer: {
    aspectRatio: 4 / 3,
    backgroundColor: colors.fieldDark,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(99, 176, 67, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: colors.mutedForeground,
    fontSize: 14,
  },
  bookmarkButton: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookmarkButtonSaved: {
    backgroundColor: colors.primary,
  },
  animatedBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  animatedDot: {
    color: colors.accentForeground,
    fontSize: 8,
  },
  animatedText: {
    color: colors.accentForeground,
    fontSize: 11,
    fontWeight: '500',
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    zIndex: 20,
  },
  overlayBtnWhite: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  overlayBtnWhiteText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  overlayBtnGreen: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  overlayBtnGreenText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
