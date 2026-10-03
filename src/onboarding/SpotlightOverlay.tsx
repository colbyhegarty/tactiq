import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  InteractionManager,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

const OVERLAY_OPACITY = 0.65;
const HIGHLIGHT_PADDING = 6;
const HIGHLIGHT_BORDER_RADIUS = 10;

export interface SpotlightTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SpotlightOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Measured position of the element to highlight. If omitted, shows centered tooltip only. */
  target?: SpotlightTarget | null;
  /** Heading text */
  heading: string;
  /** Body message */
  message: string;
  /** Called when the highlighted area is tapped (performs the action AND advances guide) */
  onTargetPress?: () => void;
  /** Show tooltip above or below the target. 'auto' picks based on position. */
  tooltipPosition?: 'above' | 'below' | 'auto';
  /** Extra padding around the highlighted element */
  padding?: number;
  /** Celebratory style for congrats messages */
  celebrate?: boolean;
  /** Optional button text — for steps that have a dismiss button (like explanatory tips) */
  buttonText?: string;
  /** Called when button is pressed */
  onButtonPress?: () => void;
  /** Called when X or dark area is tapped — skips / dismisses */
  onSkip?: () => void;
  /** Border radius for the highlight cutout */
  highlightRadius?: number;
  /** Non-blocking mode: no Modal, no dark overlay. Floats on top but lets user interact with UI underneath. */
  nonBlocking?: boolean;
}

/**
 * Measures a View ref's position on screen.
 * Returns null until a valid, stable measurement is obtained.
 *
 * Waits for the view to complete layout, then measures its window position.
 * Re-measures whenever deps change or the view re-layouts. Two consecutive
 * measurements must agree (within 1px) to confirm the layout has settled,
 * preventing stale coordinates from navigation transitions or async renders.
 */
export function useMeasure(ref: React.RefObject<any>, deps: any[] = []) {
  const [layout, setLayout] = useState<SpotlightTarget | null>(null);
  const lastRaw = useRef<SpotlightTarget | null>(null);
  const cancelledRef = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screen = Dimensions.get('window');

  const clearRetry = () => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  };

  /** Validate that coordinates are on-screen and the element has real size */
  const isValid = (t: SpotlightTarget): boolean =>
    t.width > 2 &&
    t.height > 2 &&
    t.x >= -t.width &&
    t.y >= -t.height &&
    t.x < screen.width + t.width &&
    t.y < screen.height + t.height;

  /** Check if two measurements agree within 1px (layout has settled) */
  const isStable = (a: SpotlightTarget, b: SpotlightTarget): boolean =>
    Math.abs(a.x - b.x) <= 1 &&
    Math.abs(a.y - b.y) <= 1 &&
    Math.abs(a.width - b.width) <= 1 &&
    Math.abs(a.height - b.height) <= 1;

  const measure = (attempt = 0) => {
    if (cancelledRef.current) return;
    if (!ref.current) {
      // Ref not attached yet — retry up to 20 times
      if (attempt < 20) {
        retryTimer.current = setTimeout(() => measure(attempt + 1), 100);
      }
      return;
    }

    ref.current.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        if (cancelledRef.current) return;
        const measured = { x, y, width, height };

        if (!isValid(measured)) {
          // Invalid measurement — retry
          if (attempt < 20) {
            retryTimer.current = setTimeout(() => measure(attempt + 1), 100);
          }
          return;
        }

        // Require two consecutive stable measurements to confirm layout settled
        if (lastRaw.current && isStable(lastRaw.current, measured)) {
          setLayout(measured);
          lastRaw.current = measured;
        } else {
          // First valid measurement or position changed — record and re-check.
          // 150ms gap gives layout shifts (canvas sizing, safe-area insets)
          // time to settle so the stability check catches them.
          lastRaw.current = measured;
          if (attempt < 20) {
            retryTimer.current = setTimeout(() => measure(attempt + 1), 150);
          } else {
            // Max attempts — accept the last valid measurement
            setLayout(measured);
          }
        }
      },
    );
  };

  // Reset and re-measure when deps change
  useEffect(() => {
    cancelledRef.current = false;
    lastRaw.current = null;
    setLayout(null);
    clearRetry();

    // Wait for in-flight interactions (React Navigation screen transitions,
    // LayoutAnimations, etc.) to finish before measuring. Without this,
    // measureInWindow can return coordinates mid-transition that pass the
    // stability check (two readings 80ms apart agree during a smooth
    // animation) but point to the wrong position.
    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelledRef.current) return;
      // One more rAF so the post-interaction layout pass has committed
      requestAnimationFrame(() => {
        if (cancelledRef.current) return;
        measure(0);
      });
    });

    return () => {
      cancelledRef.current = true;
      clearRetry();
      task.cancel();
    };
  }, deps);

  return layout;
}

export function SpotlightOverlay({
  visible,
  target,
  heading,
  message,
  onTargetPress,
  tooltipPosition = 'auto',
  padding = HIGHLIGHT_PADDING,
  celebrate = false,
  buttonText,
  onButtonPress,
  onSkip,
  highlightRadius = HIGHLIGHT_BORDER_RADIUS,
  nonBlocking = false,
}: SpotlightOverlayProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const screen = Dimensions.get('window');

  // Don't render until the target has been measured. When `target` is explicitly
  // `null` (useMeasure hasn't resolved yet), the overlay waits. When `target` is
  // `undefined` (no target prop passed), a centered tooltip shows immediately.
  // This prevents the overlay from appearing with stale/wrong coordinates during
  // navigation transitions or before layout has settled.
  const targetPending = target === null;
  const ready = visible && !targetPending;

  useEffect(() => {
    if (ready) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [ready]);

  // Highlight rectangle (with padding)
  const hl = visible && target
    ? {
        x: target.x - padding,
        y: target.y - padding,
        w: target.width + padding * 2,
        h: target.height + padding * 2,
      }
    : null;

  // Decide tooltip position
  const resolvedPosition =
    tooltipPosition !== 'auto'
      ? tooltipPosition
      : hl
        ? hl.y > screen.height / 2
          ? 'above'
          : 'below'
        : 'below';

  const tooltipTop = hl
    ? resolvedPosition === 'above'
      ? hl.y - 12 // tooltip will be positioned above via alignItems
      : hl.y + hl.h + 12
    : screen.height / 2 - 60;

  const bgColor = celebrate ? colors.primary : colors.coachMark;
  const borderColor = colors.primary;
  const textColor = celebrate ? colors.primaryForeground : colors.foreground;
  const subTextColor = celebrate
    ? 'rgba(255,255,255,0.85)'
    : colors.mutedForeground;

  // ── Shared tooltip card ──────────────────────────────────────────
  const tooltipCard = (
    <View
      style={[
        s.tooltipContainer,
        hl
          ? resolvedPosition === 'above'
            ? { position: 'absolute', bottom: screen.height - hl.y + 12, left: 0, right: 0 }
            : { position: 'absolute', top: tooltipTop, left: 0, right: 0 }
          : { flex: 1, justifyContent: 'center' },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          s.tooltip,
          {
            backgroundColor: bgColor,
            borderColor: borderColor,
            transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
          },
        ]}
      >
        {heading && (
          <Text style={[s.heading, { color: textColor }]}>{heading}</Text>
        )}
        <Text style={[s.message, { color: heading ? subTextColor : textColor }]}>
          {message}
        </Text>

        {buttonText && onButtonPress && (
          <TouchableOpacity
            style={[
              s.button,
              {
                backgroundColor: celebrate
                  ? 'rgba(255,255,255,0.2)'
                  : colors.primary,
              },
            ]}
            onPress={onButtonPress}
            activeOpacity={0.7}
          >
            <Text
              style={[
                s.buttonText,
                { color: colors.primaryForeground },
              ]}
            >
              {buttonText}
            </Text>
          </TouchableOpacity>
        )}

        {onSkip && (
          <TouchableOpacity onPress={onSkip} hitSlop={12} style={s.close}>
            <X
              size={14}
              color={
                celebrate
                  ? 'rgba(255,255,255,0.6)'
                  : colors.mutedForeground
              }
            />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );

  // ── Non-blocking mode: no Modal, no dark overlay ───────────────
  if (nonBlocking) {
    if (!ready) return null;
    return (
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: fadeAnim, zIndex: 999 }]}
        pointerEvents="box-none"
      >
        {/* Highlight border around target */}
        {hl && (
          <View
            style={[
              s.highlightBorder,
              {
                top: hl.y - 2,
                left: hl.x - 2,
                width: hl.w + 4,
                height: hl.h + 4,
                borderRadius: highlightRadius,
                borderColor: colors.primary,
              },
            ]}
            pointerEvents="none"
          />
        )}
        {tooltipCard}
      </Animated.View>
    );
  }

  // ── Standard blocking mode with Modal ──────────────────────────
  return (
    <Modal transparent visible={ready} animationType="none" statusBarTranslucent onRequestClose={onSkip}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
        {/* Dark overlay — built from 4 rectangles with a cutout */}
        {hl ? (
          <>
            {/* Top */}
            <TouchableWithoutFeedback onPress={onSkip}>
              <View
                style={[
                  s.darkRegion,
                  { top: 0, left: 0, right: 0, height: hl.y },
                ]}
              />
            </TouchableWithoutFeedback>
            {/* Bottom */}
            <TouchableWithoutFeedback onPress={onSkip}>
              <View
                style={[
                  s.darkRegion,
                  { top: hl.y + hl.h, left: 0, right: 0, bottom: 0 },
                ]}
              />
            </TouchableWithoutFeedback>
            {/* Left */}
            <TouchableWithoutFeedback onPress={onSkip}>
              <View
                style={[
                  s.darkRegion,
                  { top: hl.y, left: 0, width: hl.x, height: hl.h },
                ]}
              />
            </TouchableWithoutFeedback>
            {/* Right */}
            <TouchableWithoutFeedback onPress={onSkip}>
              <View
                style={[
                  s.darkRegion,
                  {
                    top: hl.y,
                    left: hl.x + hl.w,
                    right: 0,
                    height: hl.h,
                  },
                ]}
              />
            </TouchableWithoutFeedback>

            {/* Highlight border/glow around the target */}
            <View
              style={[
                s.highlightBorder,
                {
                  top: hl.y - 2,
                  left: hl.x - 2,
                  width: hl.w + 4,
                  height: hl.h + 4,
                  borderRadius: highlightRadius,
                  borderColor: colors.primary,
                },
              ]}
            />

            {/* Touchable cutout — tapping the highlighted element triggers the action */}
            {onTargetPress && (
              <TouchableOpacity
                style={{
                  position: 'absolute',
                  top: hl.y,
                  left: hl.x,
                  width: hl.w,
                  height: hl.h,
                  borderRadius: highlightRadius,
                }}
                onPress={onTargetPress}
                activeOpacity={0.9}
              />
            )}
          </>
        ) : (
          /* No target — full dark overlay for centered tooltip (congrats) */
          <TouchableWithoutFeedback onPress={onSkip}>
            <View style={[s.darkRegion, StyleSheet.absoluteFill]} />
          </TouchableWithoutFeedback>
        )}

        {tooltipCard}
      </Animated.View>
    </Modal>
  );
}

/**
 * A non-modal inline tip that renders inside a section body.
 * Does NOT darken the screen — the user can still interact with everything.
 */
export function InlineTip({
  visible,
  heading,
  message,
  onDismiss,
}: {
  visible: boolean;
  heading: string;
  message: string;
  onDismiss?: () => void;
}) {
  const { colors } = useTheme();
  if (!visible) return null;
  return (
    <View
      style={[
        inlineTipStyles.container,
        { backgroundColor: colors.card, borderColor: colors.primary },
      ]}
    >
      <Text style={[inlineTipStyles.heading, { color: colors.foreground }]}>
        {heading}
      </Text>
      <Text
        style={[inlineTipStyles.message, { color: colors.mutedForeground }]}
      >
        {message}
      </Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={12} style={inlineTipStyles.close}>
          <X size={14} color={colors.mutedForeground} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const inlineTipStyles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.xs,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  heading: {
    fontSize: 14,
    fontWeight: '700',
    paddingRight: spacing.lg,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    paddingRight: spacing.lg,
  },
  close: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 2,
  },
});

const s = StyleSheet.create({
  darkRegion: {
    position: 'absolute',
    backgroundColor: `rgba(0,0,0,${OVERLAY_OPACITY})`,
  },
  highlightBorder: {
    position: 'absolute',
    borderWidth: 2,
  },
  tooltipContainer: {
    paddingHorizontal: spacing.md,
  },
  tooltip: {
    marginHorizontal: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    paddingRight: spacing.lg,
  },
  message: {
    fontSize: 13,
    lineHeight: 19,
    paddingRight: spacing.lg,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    marginTop: 6,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  close: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 2,
  },
});
