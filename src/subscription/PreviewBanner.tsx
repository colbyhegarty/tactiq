import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Eye } from 'lucide-react-native';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface PreviewBannerProps {
  remaining: number;
  total: number;
}

/**
 * Small banner shown at the top of a Pro drill detail view during
 * the preview period. Tells the user how many free previews remain.
 */
export function PreviewBanner({ remaining, total }: PreviewBannerProps) {
  const { colors } = useTheme();

  return (
    <View style={[s.container, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
      <Eye size={14} color={colors.primary} />
      <Text style={[s.text, { color: colors.primary }]}>
        {remaining > 0
          ? `${remaining} Pro drill preview${remaining === 1 ? '' : 's'} left`
          : `You've used all ${total} free previews`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
});
