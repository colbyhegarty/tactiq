import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Library, PenTool, CalendarDays, User, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { borderRadius, spacing } from '../../theme/colors';
import { useOnboarding } from '../OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
  colors: any;
}

function FeatureItem({ icon, title, description, delay, colors }: FeatureItemProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.featureRow,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={[styles.featureIcon, { backgroundColor: colors.primaryLight }]}>{icon}</View>
      <View style={styles.featureText}>
        <Text style={[styles.featureTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{description}</Text>
      </View>
    </Animated.View>
  );
}

export function WelcomeModal() {
  const { colors } = useTheme();
  const { hasCompleted, markCompleted, dismissAll, loaded } = useOnboarding();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const isVisible = loaded && !hasCompleted('welcome');

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      ]).start();
    }
  }, [isVisible]);

  const handleGetStarted = () => {
    markCompleted('welcome');
  };

  const handleSkipAll = () => {
    dismissAll();
  };

  if (!isVisible) return null;

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.border, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Header */}
          <Image
            source={require('../../../assets/images/icon.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.foreground }]}>Welcome to Tactiq</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Your toolkit for creating, organizing, and running soccer training sessions.
          </Text>

          {/* Features */}
          <View style={styles.features}>
            <FeatureItem
              icon={<Library size={18} color={colors.primary} />}
              title="Browse Drills"
              description="Explore a library of drills with filters and previews"
              delay={100}
              colors={colors}
            />
            <FeatureItem
              icon={<PenTool size={18} color={colors.primary} />}
              title="Create Your Own"
              description="Design custom drills from scratch or modify existing ones"
              delay={200}
              colors={colors}
            />
            <FeatureItem
              icon={<CalendarDays size={18} color={colors.primary} />}
              title="Plan Sessions"
              description="Build full training sessions with multiple activities"
              delay={250}
              colors={colors}
            />
            <FeatureItem
              icon={<User size={18} color={colors.primary} />}
              title="Your Profile"
              description="Save drills, manage sessions, and export to PDF"
              delay={300}
              colors={colors}
            />
          </View>

          {/* Buttons */}
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Get Started</Text>
            <ChevronRight size={18} color={colors.primaryForeground} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkipAll} activeOpacity={0.7}>
            <Text style={[styles.skipText, { color: colors.mutedForeground }]}>Skip all tips</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: 'center',
  },
  headerLogo: {
    width: 72,
    height: 72,
    borderRadius: 16,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  features: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 1,
  },
  featureDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    width: '100%',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontSize: 13,
  },
});
