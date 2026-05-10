import { Image } from 'expo-image';
import { Bookmark, BookmarkCheck, Clock, Eye, Search, Target, Users } from 'lucide-react-native';
import React, { memo, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { getCategoryColor, getDifficultyColor } from '../lib/api';
import { LockedDrillOverlay } from '../subscription/LockedDrillOverlay';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Drill } from '../types/drill';

const CARD_MARGIN = spacing.md;

interface DrillCardProps {
  drill: Drill;
  onPress: (drill: Drill) => void;
  onSave?: (drill: Drill) => void;
  isSaved?: boolean;
  compact?: boolean;
  onQuickView?: (drill: Drill) => void;
  isLocked?: boolean;
}

const styleCache = new Map<any, ReturnType<typeof create_styles>>();
function getStyles(tc: any) {
  if (!styleCache.has(tc)) styleCache.set(tc, create_styles(tc));
  return styleCache.get(tc)!;
}

function DrillCardInner({
  drill,
  onPress,
  onSave,
  isSaved = false,
  compact = false,
  onQuickView,
  isLocked = false,
}: DrillCardProps) {
  const { colors: tc } = useTheme();
  const styles = getStyles(tc);
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const scale = useSharedValue(1);

  const cardAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const imageUri = useMemo(
    () => (drill.svg_url ? `${drill.svg_url}?v=17` : null),
    [drill.svg_url],
  );

  const categoryColor = useMemo(() => getCategoryColor(drill.category), [drill.category]);
  const difficultyColor = useMemo(() => getDifficultyColor(drill.difficulty), [drill.difficulty]);

  const categoryTags = useMemo(() => {
    if (!drill.category) return null;
    return drill.category.split(',').map((cat, index) => {
      const catColor = getCategoryColor(cat.trim());
      return (
        <View key={index} style={[styles.tag, { backgroundColor: catColor.bg }]}>
          <Text style={[styles.tagText, { color: catColor.text }]}>
            {cat.trim().toUpperCase()}
          </Text>
        </View>
      );
    });
  }, [drill.category, styles]);

  return (
    <Animated.View
      style={[styles.card, compact && styles.cardCompact, cardAnimStyle]}
      onTouchStart={() => {
        scale.value = withTiming(1.03, { duration: 150 });
        setIsPressed(true);
      }}
      onTouchEnd={() => {
        scale.value = withTiming(1, { duration: 200 });
        setIsPressed(false);
      }}
      onTouchCancel={() => {
        scale.value = withTiming(1, { duration: 200 });
        setIsPressed(false);
      }}
    >
      {/* Diagram Image */}
      <View style={styles.imageContainer}>
        <Pressable
          style={styles.imageContainer}
          onPress={() => {
            if (isLocked) {
              onPress(drill);
            } else {
              setShowOverlay((v) => !v);
            }
          }}
        >
          {imageUri && !imageError ? (
            <>
              <Image
                source={{ uri: imageUri }}
                style={[styles.image, isLocked && styles.imageLocked]}
                contentFit="cover"
                transition={200}
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={() => { setImageError(true); setImageLoading(false); }}
              />
              {imageLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color={tc.primary} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No diagram</Text>
            </View>
          )}

          {isLocked && <LockedDrillOverlay />}

          {!isLocked && (
            <TouchableOpacity
              style={[styles.bookmarkButton, isSaved && styles.bookmarkButtonSaved]}
              onPress={(e) => { e.stopPropagation?.(); onSave?.(drill); }}
              hitSlop={8}
            >
              {isSaved ? (
                <BookmarkCheck size={compact ? 14 : 16} color={tc.primaryForeground} fill={tc.primaryForeground} />
              ) : (
                <Bookmark size={compact ? 14 : 16} color={tc.mutedForeground} />
              )}
            </TouchableOpacity>
          )}

          {showOverlay && !isLocked && (
            <View style={styles.overlay}>
              {onQuickView && (
                <TouchableOpacity
                  style={[styles.overlayBtnWhite, compact && styles.overlayBtnCompact]}
                  onPress={() => { setShowOverlay(false); onQuickView(drill); }}
                >
                  {compact ? (
                    <Search size={18} color={tc.primary} />
                  ) : (
                    <Text style={styles.overlayBtnWhiteText}>Quick View</Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.overlayBtnGreen, compact && styles.overlayBtnCompact]}
                onPress={() => { setShowOverlay(false); onPress(drill); }}
              >
                {compact ? (
                  <Eye size={18} color="#fff" />
                ) : (
                  <Text style={styles.overlayBtnGreenText}>View Drill</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </View>

      {/* Content */}
      <TouchableOpacity
        style={[styles.content, compact && styles.contentCompact]}
        onPress={() => onPress(drill)}
        activeOpacity={0.7}
      >
        <View>
          <Text
            style={[styles.title, compact && styles.titleCompact, isPressed && styles.titlePressed]}
            numberOfLines={compact ? 2 : 1}
          >
            {drill.name}
          </Text>

          <View style={styles.tags}>
            {categoryTags}
            {drill.difficulty && (
              <View style={[styles.tag, { backgroundColor: difficultyColor.bg }]}>
                <Text style={[styles.tagText, { color: difficultyColor.text }]}>
                  {drill.difficulty.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

          {!compact && drill.description && (
            <Text style={styles.description} numberOfLines={2}>
              {drill.description}
            </Text>
          )}
        </View>

        <View style={styles.spacer} />

        <View style={styles.meta}>
          {drill.player_count != null && (
            <View style={styles.metaItem}>
              <Users size={12} color={tc.mutedForeground} />
              <Text style={styles.metaText}>
                {drill.player_count_display || `${drill.player_count}+`}
              </Text>
            </View>
          )}
          {drill.duration != null && (
            <View style={styles.metaItem}>
              <Clock size={12} color={tc.mutedForeground} />
              <Text style={styles.metaText}>{drill.duration} min</Text>
            </View>
          )}
          {!compact && drill.age_group && (
            <View style={styles.metaItem}>
              <Target size={12} color={tc.mutedForeground} />
              <Text style={styles.metaText}>{drill.age_group}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export const DrillCard = memo(DrillCardInner);

function create_styles(tc: any) { return StyleSheet.create({
  card: {
    backgroundColor: tc.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: tc.border,
    marginHorizontal: CARD_MARGIN,
    marginVertical: spacing.sm,
    overflow: 'hidden',
  },
  cardCompact: {
    marginHorizontal: spacing.xs,
    marginVertical: spacing.xs,
    flex: 1,
  },
  imageContainer: {
    aspectRatio: 4 / 3,
    backgroundColor: tc.fieldDark,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  imageLocked: { opacity: 0.15 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(99, 176, 67, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: tc.mutedForeground, fontSize: 14 },
  bookmarkButton: {
    position: 'absolute', top: spacing.sm, left: spacing.sm,
    width: 32, height: 32, borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  bookmarkButtonSaved: { backgroundColor: tc.primary },
  content: { flex: 1, padding: spacing.md },
  contentCompact: { padding: spacing.sm },
  title: { color: tc.foreground, fontSize: 16, fontWeight: '600', marginBottom: spacing.sm },
  titleCompact: { fontSize: 13, marginBottom: 4 },
  titlePressed: { color: tc.primary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  tagText: { fontSize: 10, fontWeight: '600' },
  description: { color: tc.mutedForeground, fontSize: 13, lineHeight: 18, marginBottom: spacing.sm },
  spacer: { flex: 1 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: tc.mutedForeground, fontSize: 11 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
    flexDirection: 'row', gap: 8, zIndex: 20,
  },
  overlayBtnWhite: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  overlayBtnWhiteText: { color: tc.primary, fontSize: 13, fontWeight: '600' },
  overlayBtnGreen: {
    backgroundColor: tc.primary,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
  },
  overlayBtnCompact: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 22 },
  overlayBtnGreenText: { color: '#fff', fontSize: 13, fontWeight: '600' },
}); };
