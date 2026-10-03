import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CalendarDays,
  ChevronRight,
  Library,
  PenTool,
  Compass,
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { borderRadius, spacing } from '../theme/colors';
import { track } from '../lib/analytics';
import { OnboardingGoal, useOnboarding } from './OnboardingContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface GoalOption {
  key: OnboardingGoal;
  icon: typeof CalendarDays;
  title: string;
  subtitle: string;
}

const GOALS: GoalOption[] = [
  {
    key: 'build_practice',
    icon: CalendarDays,
    title: 'Build a practice plan',
    subtitle: 'Organize drills into a structured session',
  },
  {
    key: 'find_drills',
    icon: Library,
    title: 'Find the right drill',
    subtitle: 'Browse 300+ drills by category, age group & more',
  },
  {
    key: 'create_drill',
    icon: PenTool,
    title: 'Create my own drill',
    subtitle: 'Design custom drills with the visual editor',
  },
  {
    key: 'explore',
    icon: Compass,
    title: 'Explore on my own',
    subtitle: "Look around and see what's here",
  },
];

interface OnboardingFlowProps {
  visible: boolean;
}

export function OnboardingFlow({ visible }: OnboardingFlowProps) {
  const { colors } = useTheme();
  const { completeOnboarding } = useOnboarding();
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const [cardAnims] = useState(() =>
    GOALS.map(() => new Animated.Value(0)),
  );

  useEffect(() => {
    if (visible) {
      track('onboarding_started', {});

      // Animate header
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();

      // Stagger cards
      cardAnims.forEach((anim, i) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: 300 + i * 100,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [visible]);

  const handleGoalSelect = (goal: OnboardingGoal) => {
    // Navigate before completing onboarding so the target screen is already
    // pushing in while the modal fades — prevents a flash of the Library tab.
    if (goal === 'create_drill') {
      router.push('/drill-editor');
    }
    completeOnboarding(goal);
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={[s.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <Animated.View
          style={[
            s.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={[s.welcomeLabel, { color: colors.primary }]}>
            WELCOME TO TACTIQ
          </Text>
          <Text style={[s.title, { color: colors.foreground }]}>
            What brings you here today?
          </Text>
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            We'll point you in the right direction.
          </Text>
        </Animated.View>

        {/* Goal Cards */}
        <View style={s.goals}>
          {GOALS.map((goal, index) => {
            const Icon = goal.icon;
            return (
              <Animated.View
                key={goal.key}
                style={{
                  opacity: cardAnims[index],
                  transform: [
                    {
                      translateY: cardAnims[index].interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                }}
              >
                <TouchableOpacity
                  style={[
                    s.goalCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleGoalSelect(goal.key)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      s.goalIcon,
                      { backgroundColor: colors.primaryLight },
                    ]}
                  >
                    <Icon size={22} color={colors.primary} />
                  </View>
                  <View style={s.goalText}>
                    <Text style={[s.goalTitle, { color: colors.foreground }]}>
                      {goal.title}
                    </Text>
                    <Text
                      style={[
                        s.goalSubtitle,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {goal.subtitle}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  welcomeLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  goals: {
    gap: spacing.sm,
  },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goalText: {
    flex: 1,
    gap: 2,
  },
  goalTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  goalSubtitle: {
    fontSize: 13,
  },
});
