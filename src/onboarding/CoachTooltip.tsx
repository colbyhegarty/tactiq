import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X, ChevronUp, ChevronRight, ChevronDown, ChevronLeft } from 'lucide-react-native';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

type ArrowDirection = 'up' | 'down' | 'left' | 'right' | 'none';

interface CoachTooltipProps {
  /** Main message text */
  message: string;
  /** Optional bold heading */
  heading?: string;
  /** Which direction the arrow points (toward the target element) */
  arrow?: ArrowDirection;
  /** Button text — omit to hide button entirely */
  buttonText?: string;
  /** Called when user taps the action button or X */
  onDismiss: () => void;
  /** If true, shows a celebratory style (green background, no arrow) */
  celebrate?: boolean;
  /** Auto-dismiss after this many milliseconds. X still available for immediate dismiss. */
  autoDismissMs?: number;
}

/**
 * Lightweight animated tooltip for guided onboarding flows.
 * Shows an arrow pointing toward a target UI element.
 */
export function CoachTooltip({
  message,
  heading,
  arrow = 'none',
  buttonText,
  onDismiss,
  celebrate = false,
  autoDismissMs,
}: CoachTooltipProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const dismissedRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        delay: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Auto-dismiss timer
  useEffect(() => {
    if (!autoDismissMs) return;
    const timer = setTimeout(() => {
      if (!dismissedRef.current) {
        dismissedRef.current = true;
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => onDismiss());
      }
    }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs]);

  const ArrowIcon =
    arrow === 'up' ? ChevronUp :
    arrow === 'down' ? ChevronDown :
    arrow === 'left' ? ChevronLeft :
    arrow === 'right' ? ChevronRight : null;

  const bgColor = celebrate ? colors.primary : colors.coachMark;
  const borderColor = celebrate ? colors.primary : colors.primary;
  const textColor = celebrate ? colors.primaryForeground : colors.foreground;
  const subTextColor = celebrate ? 'rgba(255,255,255,0.85)' : colors.mutedForeground;

  return (
    <Animated.View
      style={[
        s.container,
        {
          backgroundColor: bgColor,
          borderColor: borderColor,
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      {/* Arrow indicator pointing toward the target */}
      {ArrowIcon && (
        <View style={[
          s.arrowRow,
          arrow === 'up' && s.arrowUp,
          arrow === 'right' && s.arrowRight,
        ]}>
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [{
              translateY: arrow === 'up' ? -2 : arrow === 'down' ? 2 : 0,
            }, {
              translateX: arrow === 'right' ? 2 : arrow === 'left' ? -2 : 0,
            }],
          }}>
            <ArrowIcon size={20} color={celebrate ? colors.primaryForeground : colors.primary} />
          </Animated.View>
        </View>
      )}

      <View style={s.content}>
        <View style={s.textWrap}>
          {heading && (
            <Text style={[s.heading, { color: textColor }]}>{heading}</Text>
          )}
          <Text style={[s.message, { color: heading ? subTextColor : textColor }]}>
            {message}
          </Text>
        </View>
        {buttonText && (
          <TouchableOpacity
            style={[
              s.button,
              {
                backgroundColor: celebrate ? 'rgba(255,255,255,0.2)' : colors.primary,
              },
            ]}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={[s.buttonText, { color: colors.primaryForeground }]}>
              {buttonText}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity onPress={() => { if (!dismissedRef.current) { dismissedRef.current = true; onDismiss(); } }} hitSlop={12} style={s.close}>
        <X size={14} color={celebrate ? 'rgba(255,255,255,0.6)' : colors.mutedForeground} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  arrowRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  arrowUp: {
    marginTop: -4,
    marginBottom: 2,
  },
  arrowRight: {
    alignSelf: 'flex-end',
    marginRight: spacing.lg,
  },
  content: {
    gap: spacing.sm,
  },
  textWrap: {
    paddingRight: spacing.lg, // room for close button
    gap: 2,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 2,
  },
});
