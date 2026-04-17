import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { borderRadius, spacing } from '../../theme/colors';

export interface TooltipStep {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface OnboardingTooltipProps {
  visible: boolean;
  steps: TooltipStep[];
  onDismiss: () => void;
}

/**
 * Renders as an absolutely-positioned overlay that floats BELOW whichever
 * container it is placed inside.  The container must have `overflow: 'visible'`
 * (or wrap the tooltip in a zero-height view) so the tooltip doesn't push
 * sibling content down.
 *
 * Usage:  Place <OnboardingTooltip /> inside a wrapper View that sits between
 *         the header and the scrollable content.  The wrapper should be
 *         { zIndex: 1000, height: 0 } so it takes no layout space.
 */
export function OnboardingTooltip({
  visible,
  steps,
  onDismiss,
}: OnboardingTooltipProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-10)).current;
  const [currentStep, setCurrentStep] = useState(0);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowing(true);
      setCurrentStep(0);
      fadeAnim.setValue(0);
      slideAnim.setValue(-10);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, delay: 400, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setShowing(false);
      });
    }
  }, [visible]);

  if (!showing || steps.length === 0) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep >= steps.length - 1;
  const hasMultipleSteps = steps.length > 1;

  const handleNext = () => {
    if (isLastStep) {
      onDismiss();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.tooltip,
          { backgroundColor: colors.primary, borderColor: 'rgba(255,255,255,0.15)' },
        ]}
      >
        <View style={[styles.caret, { borderBottomColor: colors.primary }]} />

        <View style={styles.content}>
          {step.icon && <View style={styles.iconWrap}>{step.icon}</View>}
          <View style={styles.textWrap}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.description}>{step.description}</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          {hasMultipleSteps && (
            <View style={styles.dots}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === currentStep && styles.dotActive]}
                />
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.7}>
            <Text style={styles.nextText}>{isLastStep ? 'Got it' : 'Next'}</Text>
            {!isLastStep && <ChevronRight size={14} color="#fff" />}
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: spacing.md,
    right: spacing.md,
    zIndex: 1000,
  },
  caret: {
    position: 'absolute',
    top: -8,
    left: 24,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  tooltip: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.85)',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#ffffff',
    width: 16,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: borderRadius.sm,
    marginLeft: 'auto',
  },
  nextText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});
