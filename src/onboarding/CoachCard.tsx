import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface CoachCardProps {
  /** Icon component from lucide-react-native */
  icon: React.ComponentType<{ size: number; color: string }>;
  /** Short heading */
  title: string;
  /** 1-2 sentence explanation */
  description: string;
  /** Called when user taps the X to dismiss */
  onDismiss: () => void;
}

/**
 * A dismissible coach card shown once after onboarding to orient
 * the user on the screen that matches their selected goal.
 */
export function CoachCard({ icon: Icon, title, description, onDismiss }: CoachCardProps) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        s.container,
        {
          backgroundColor: colors.coachMark,
          borderColor: colors.primary,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[s.iconWrap, { backgroundColor: colors.primary }]}>
        <Icon size={16} color={colors.primaryForeground} />
      </View>
      <View style={s.textWrap}>
        <Text style={[s.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[s.description, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      </View>
      <TouchableOpacity onPress={onDismiss} hitSlop={12} style={s.close}>
        <X size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
  close: {
    padding: 2,
    marginTop: 1,
  },
});
