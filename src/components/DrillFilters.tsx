import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { DrillFilterParams, DIFFICULTIES, AGE_GROUP_CATEGORIES } from '../lib/api';
import { colors, spacing, borderRadius } from '../theme/colors';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatDifficulty(difficulty: string): string {
  return difficulty.charAt(0) + difficulty.slice(1).toLowerCase();
}

interface DrillFiltersProps {
  categories: string[];
  ageGroups: string[];
  durations: string[];
  filters: DrillFilterParams;
  onFilterChange: (filters: DrillFilterParams) => void;
  resultCount?: number;
  isLoading?: boolean;
}

export function DrillFilters({
  categories,
  ageGroups,
  durations,
  filters,
  onFilterChange,
  resultCount,
  isLoading,
}: DrillFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Local search text for debouncing — keeps TextInput responsive
  const [searchText, setSearchText] = useState(filters.search || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local search text when filters.search is cleared externally (e.g. "Clear All")
  useEffect(() => {
    if (!filters.search && searchText) {
      setSearchText('');
    }
  }, [filters.search]);

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const newFilters = { ...filters };
      if (text) {
        newFilters.search = text;
      } else {
        delete newFilters.search;
      }
      onFilterChange(newFilters);
    }, 400);
  };

  const clearSearch = () => {
    setSearchText('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const newFilters = { ...filters };
    delete newFilters.search;
    onFilterChange(newFilters);
  };

  const updateFilter = (
    key: keyof DrillFilterParams,
    value: string | number | boolean | undefined,
  ) => {
    const newFilters = { ...filters };
    if (value === '' || value === 'All' || value === 'all' || value === undefined) {
      delete newFilters[key];
    } else {
      (newFilters as Record<string, unknown>)[key] = value;
    }
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    onFilterChange({});
  };

  const activeFilterCount = Object.keys(filters).filter((k) => k !== 'search').length;
  const hasActiveFilters = Object.keys(filters).length > 0;

  const toggleFilters = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setFiltersOpen(!filtersOpen);
    setActiveDropdown(null);
  };

  const toggleDropdown = (name: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  const renderDropdown = (
    label: string,
    name: string,
    value: string | undefined,
    options: { label: string; value: string }[],
    onSelect: (value: string) => void,
  ) => {
    const isOpen = activeDropdown === name;
    const displayValue = value && value !== 'All' ? value : label;

    return (
      <View style={styles.dropdownWrapper}>
        <TouchableOpacity
          style={[styles.dropdown, isOpen && styles.dropdownOpen]}
          onPress={() => toggleDropdown(name)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.dropdownText,
              value && value !== 'All' && styles.dropdownTextActive,
            ]}
            numberOfLines={1}
          >
            {displayValue}
          </Text>
          <ChevronDown
            size={14}
            color={colors.mutedForeground}
            style={isOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.dropdownMenu}>
            <ScrollView
              style={styles.dropdownScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.dropdownOption,
                    value === opt.value && styles.dropdownOptionActive,
                  ]}
                  onPress={() => {
                    onSelect(opt.value);
                    setActiveDropdown(null);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      value === opt.value && styles.dropdownOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={18} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search drills..."
          placeholderTextColor={colors.mutedForeground}
          value={searchText}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {searchText ? (
          <TouchableOpacity onPress={clearSearch}>
            <X size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Collapsible Filters Button */}
      <TouchableOpacity
        style={[styles.filtersToggle, filtersOpen && styles.filtersToggleOpen]}
        onPress={toggleFilters}
        activeOpacity={0.7}
      >
        <View style={styles.filtersToggleLeft}>
          <Filter size={14} color={colors.primary} />
          <Text style={styles.filtersToggleText}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </View>
        {filtersOpen ? (
          <ChevronUp size={14} color={colors.primary} />
        ) : (
          <ChevronDown size={14} color={colors.primary} />
        )}
      </TouchableOpacity>

      {/* Expanded Filter Controls */}
      {filtersOpen && (
        <View style={styles.filterControls}>
          {/* Row 1: Category, Age */}
          <View style={styles.filterRow}>
            {renderDropdown(
              'All Categories',
              'category',
              filters.category,
              [
                { label: 'All Categories', value: 'All' },
                ...categories.map((c) => ({ label: c, value: c })),
              ],
              (val) => updateFilter('category', val),
            )}
            {renderDropdown(
              'All Ages',
              'age_group',
              filters.age_group,
              [
                { label: 'All Ages', value: 'All' },
                ...AGE_GROUP_CATEGORIES.map((a) => ({ label: a, value: a })),
              ],
              (val) => updateFilter('age_group', val),
            )}
          </View>

          {/* Row 2: Duration, Difficulty */}
          <View style={styles.filterRow}>
            {renderDropdown(
              'Any Duration',
              'duration',
              filters.duration,
              [
                { label: 'Any Duration', value: 'Any Duration' },
                ...durations.map((d) => ({ label: d, value: d })),
              ],
              (val) =>
                updateFilter('duration', val !== 'Any Duration' ? val : undefined),
            )}
            {renderDropdown(
              'Any Difficulty',
              'difficulty',
              filters.difficulty,
              [
                { label: 'Any Difficulty', value: 'All' },
                ...DIFFICULTIES.map((d) => ({
                  label: formatDifficulty(d),
                  value: d,
                })),
              ],
              (val) => updateFilter('difficulty', val),
            )}
          </View>

          {/* Row 3: Player count */}
          <View style={styles.playerCountRow}>
            <TextInput
              style={styles.playerCountInput}
              placeholder="Min"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={filters.min_players?.toString() || ''}
              onChangeText={(text) =>
                updateFilter('min_players', text ? parseInt(text) : undefined)
              }
            />
            <Text style={styles.playerCountDash}>–</Text>
            <TextInput
              style={styles.playerCountInput}
              placeholder="Max"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={filters.max_players?.toString() || ''}
              onChangeText={(text) =>
                updateFilter('max_players', text ? parseInt(text) : undefined)
              }
            />
            <Text style={styles.playerCountLabel}>players</Text>
          </View>

          {/* Clear button */}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <X size={14} color={colors.mutedForeground} />
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Results Count */}
      {resultCount !== undefined && (
        <View style={styles.resultsRow}>
          <View style={styles.resultsCount}>
            <Filter size={12} color={colors.mutedForeground} />
            <Text style={styles.resultsText}>
              {isLoading ? 'Searching...' : `${resultCount} drills found`}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    height: 44,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 15,
  },
  filtersToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  filtersToggleOpen: {
    borderColor: colors.primary,
  },
  filtersToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filtersToggleText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '500',
  },
  filterControls: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dropdownWrapper: {
    flex: 1,
    zIndex: 10,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    height: 36,
  },
  dropdownOpen: {
    borderColor: colors.primary,
  },
  dropdownText: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 12,
  },
  dropdownTextActive: {
    color: colors.foreground,
  },
  dropdownMenu: {
    position: 'relative',
    backgroundColor: colors.card,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 180,
  },
  dropdownOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  dropdownOptionText: {
    color: colors.foreground,
    fontSize: 12,
  },
  dropdownOptionTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  playerCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playerCountInput: {
    width: 60,
    height: 36,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    color: colors.foreground,
    fontSize: 12,
    textAlign: 'center',
  },
  playerCountDash: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  playerCountLabel: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  clearButtonText: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultsCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultsText: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
});
