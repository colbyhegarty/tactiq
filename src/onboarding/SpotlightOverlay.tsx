import React, { useCallback, useEffect, useRef, useState } from 'react';
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
 * Returns `{ layout, onLayout }` — attach `onLayout` to the target View so
 * the hook knows when the Fabric renderer has committed native layout.
 *
 * In production builds (optimised Hermes bytecode), JS runs fast enough that
 * timer-based approaches (InteractionManager, rAF, setTimeout) can fire
 * before the Fabric renderer commits layout diffs to the UI thread.
 * `measureInWindow` then returns stale coordinates that pass the stability
 * check because the view is sitting at a consistent *wrong* position.
 *
 * By listening to the native `onLayout` event on the target view, we know
 * the UI-thread layout has actually committed and can measure reliably.
 * The hook also runs a timer-based fallback so it works even if onLayout
 * fires before the effect mounts (e.g. fast re-renders).
 */
export function useMeasure(
  ref: React.RefObject<any>,
  deps: any[] = [],
): { layout: SpotlightTarget | null; onLayout: () => void } {
  const [layout, setLayout] = useState<SpotlightTarget | null>(null);
  const lastRaw = useRef<SpotlightTarget | null>(null);
  const cancelledRef = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
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

  const measure = useCallback((attempt = 0) => {
    if (cancelledRef.current) return;
    if (!ref.current) {
      if (attempt < 25) {
        retryTimer.current = setTimeout(() => measure(attempt + 1), 100);
      }
      return;
    }

    ref.current.measureInWindow(
      (x: number, y: number, width: number, height: number) => {
        if (cancelledRef.current) return;
        const measured = { x, y, width, height };

        if (!isValid(measured)) {
          if (attempt < 25) {
            retryTimer.current = setTimeout(() => measure(attempt + 1), 150);
          }
          return;
        }

        // Require two consecutive stable measurements to confirm layout settled.
        // 150ms gap catches slow layout shifts (canvas sizing, safe-area insets).
        if (lastRaw.current && isStable(lastRaw.current, measured)) {
          setLayout(measured);
          lastRaw.current = measured;
        } else {
          lastRaw.current = measured;
          if (attempt < 25) {
            retryTimer.current = setTimeout(() => measure(attempt + 1), 150);
          } else {
            setLayout(measured);
          }
        }
      },
    );
  }, [ref]);

  /**
   * Attach this to the target view's `onLayout` prop.
   * When Fabric commits layout to the UI thread, this fires on the JS side,
   * telling us measureInWindow will now return correct coordinates.
   * Each onLayout restarts the measurement cycle from scratch.
   */
  const handleLayout = useCallback(() => {
    if (cancelledRef.current) return;
    // Reset any in-flight measurement — the position may have changed
    clearRetry();
    lastRaw.current = null;
    // Small delay for ancestor layouts to also settle, then measure
    retryTimer.current = setTimeout(() => {
      if (cancelledRef.current) return;
      measure(0);
    }, 50);
  }, [measure]);

  // Timer-based fallback: also start measuring after interactions complete.
  // This handles the case where onLayout fires before the effect mounts
  // (fast component re-renders) or when deps change without a new layout.
  useEffect(() => {
    cancelledRef.current = false;
    lastRaw.current = null;
    setLayout(null);
    clearRetry();
    if (taskRef.current) { taskRef.current.cancel(); taskRef.current = null; }

    const task = InteractionManager.runAfterInteractions(() => {
      if (cancelledRef.current) return;
      // Chain rAFs to let multiple frame commits pass before measuring —
      // a single rAF isn't always enough for Fabric's async commit.
      requestAnimationFrame(() => {
        if (cancelledRef.current) return;
        requestAnimationFrame(() => {
          if (cancelledRef.current) return;
          measure(0);
        });
      });
    });
    taskRef.current = task;

    return () => {
      cancelledRef.current = true;
      clearRetry();
      if (taskRef.current) { taskRef.current.cancel(); taskRef.current = null; }
    };
  }, deps);

  return { layout, onLayout: handleLayout };
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
