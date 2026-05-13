import {
    ChevronDown,
    ChevronUp,
    Filter,
    Layers,
    Search,
    X,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    LayoutAnimation,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';
import { AGE_GROUP_CATEGORIES, DIFFICULTIES, DrillFilterParams } from '../lib/api';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

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
  const { colors: tc } = useTheme();
  const styles = create_styles(tc);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [multiCategoryMode, setMultiCategoryMode] = useState(false);

  const [searchText, setSearchText] = useState(filters.search || '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filters.search && searchText) setSearchText('');
  }, [filters.search]);

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const newFilters = { ...filters };
      if (text) { newFilters.search = text; } else { delete newFilters.search; }
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

  // Multi-select: toggle a category in/out of the selected set
  const toggleMultiCategory = (cat: string) => {
    const current: string[] = (filters as any).categories || [];
    const next = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    const newFilters = { ...filters } as any;
    if (next.length === 0) {
      delete newFilters.categories;
    } else {
      newFilters.categories = next;
    }
    onFilterChange(newFilters);
  };

  const selectedCategories: string[] = (filters as any).categories || [];

  const clearFilters = () => {
    onFilterChange({});
  };

  const activeFilterCount = Object.keys(filters).filter(
    (k) => k !== 'search' && k !== 'categories',
  ).length + (selectedCategories.length > 0 ? 1 : 0);

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

  // Switch between modes — clear category state from the other mode
  const handleToggleMultiMode = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newFilters = { ...filters } as any;
    if (!multiCategoryMode) {
      // switching to multi — clear single-select category
      delete newFilters.category;
    } else {
      // switching to single — clear multi-select categories
      delete newFilters.categories;
    }
    onFilterChange(newFilters);
    setMultiCategoryMode((v) => !v);
    setActiveDropdown(null);
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
            style={[styles.dropdownText, value && value !== 'All' && styles.dropdownTextActive]}
            numberOfLines={1}
          >
            {displayValue}
          </Text>
          <ChevronDown
            size={14}
            color={tc.mutedForeground}
            style={isOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.dropdownMenu}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.dropdownOption, value === opt.value && styles.dropdownOptionActive]}
                  onPress={() => { onSelect(opt.value); setActiveDropdown(null); }}
                >
                  <Text style={[styles.dropdownOptionText, value === opt.value && styles.dropdownOptionTextActive]}>
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

  // Multi-select category dropdown — stays open, shows checkboxes
  const renderMultiCategoryDropdown = () => {
    const isOpen = activeDropdown === 'categories';
    const count = selectedCategories.length;
    const label = count === 0 ? 'All Categories' : count === 1 ? selectedCategories[0] : `${count} categories`;

    return (
      <View style={[styles.dropdownWrapper, { flex: 1 }]}>
        <TouchableOpacity
          style={[styles.dropdown, (isOpen || count > 0) && styles.dropdownOpen]}
          onPress={() => toggleDropdown('categories')}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.dropdownText, count > 0 && styles.dropdownTextActive]}
            numberOfLines={1}
          >
            {label}
          </Text>
          <ChevronDown
            size={14}
            color={tc.mutedForeground}
            style={isOpen ? { transform: [{ rotate: '180deg' }] } : undefined}
          />
        </TouchableOpacity>
        {isOpen && (
          <View style={styles.dropdownMenu}>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {categories.map((cat) => {
                const selected = selectedCategories.includes(cat);
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.dropdownOption, selected && styles.dropdownOptionActive]}
                    onPress={() => toggleMultiCategory(cat)}
                  >
                    <View style={styles.checkRow}>
                      <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                        {selected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>
                        {cat}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
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
        <Search size={18} color={tc.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search drills..."
          placeholderTextColor={tc.mutedForeground}
          value={searchText}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {searchText ? (
          <TouchableOpacity onPress={clearSearch}>
            <X size={16} color={tc.mutedForeground} />
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
          <Filter size={14} color={tc.primary} />
          <Text style={styles.filtersToggleText}>
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </View>
        {filtersOpen ? <ChevronUp size={14} color={tc.primary} /> : <ChevronDown size={14} color={tc.primary} />}
      </TouchableOpacity>

      {/* Expanded Filter Controls */}
      {filtersOpen && (
        <View style={styles.filterControls}>

          {/* Multi-category toggle */}
          <TouchableOpacity style={styles.multiToggleRow} onPress={handleToggleMultiMode} activeOpacity={0.7}>
            <View style={styles.multiToggleLeft}>
              <Layers size={13} color={multiCategoryMode ? tc.primary : tc.mutedForeground} />
              <Text style={[styles.multiToggleText, multiCategoryMode && styles.multiToggleTextActive]}>
                Multi-category
              </Text>
            </View>
            {/* pill toggle */}
            <View style={[styles.togglePill, multiCategoryMode && styles.togglePillActive]}>
              <View style={[styles.toggleThumb, multiCategoryMode && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>

          {/* Row 1: Category, Age */}
          <View style={styles.filterRow}>
            {multiCategoryMode
              ? renderMultiCategoryDropdown()
              : renderDropdown(
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
              (val) => updateFilter('duration', val !== 'Any Duration' ? val : undefined),
            )}
            {renderDropdown(
              'Any Difficulty',
              'difficulty',
              filters.difficulty,
              [
                { label: 'Any Difficulty', value: 'All' },
                ...DIFFICULTIES.map((d) => ({ label: formatDifficulty(d), value: d })),
              ],
              (val) => updateFilter('difficulty', val),
            )}
          </View>

          {/* Row 3: Player count */}
          <View style={styles.playerCountRow}>
            <TextInput
              style={styles.playerCountInput}
              placeholder="Min"
              placeholderTextColor={tc.mutedForeground}
              keyboardType="number-pad"
              value={filters.min_players?.toString() || ''}
              onChangeText={(text) => updateFilter('min_players', text ? parseInt(text) : undefined)}
            />
            <Text style={styles.playerCountDash}>–</Text>
            <TextInput
              style={styles.playerCountInput}
              placeholder="Max"
              placeholderTextColor={tc.mutedForeground}
              keyboardType="number-pad"
              value={filters.max_players?.toString() || ''}
              onChangeText={(text) => updateFilter('max_players', text ? parseInt(text) : undefined)}
            />
            <Text style={styles.playerCountLabel}>players</Text>
          </View>

          {/* Clear button */}
          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
              <X size={14} color={tc.mutedForeground} />
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Results Count */}
      {resultCount !== undefined && (
        <View style={styles.resultsRow}>
          <View style={styles.resultsCount}>
            <Filter size={12} color={tc.mutedForeground} />
            <Text style={styles.resultsText}>
              {isLoading ? 'Searching...' : `${resultCount} drills found`}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function create_styles(tc: any) { return StyleSheet.create({
  container: { gap: spacing.sm },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: tc.card, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: tc.border,
    paddingHorizontal: spacing.md, height: 44, gap: spacing.sm,
  },
  searchInput: { flex: 1, color: tc.foreground, fontSize: 15 },
  filtersToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: tc.card, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: tc.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  filtersToggleOpen: { borderColor: tc.primary },
  filtersToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filtersToggleText: { color: tc.primary, fontSize: 13, fontWeight: '500' },
  filterControls: {
    backgroundColor: tc.card, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: tc.border,
    padding: spacing.md, gap: spacing.sm,
  },
  // Multi-category toggle row
  multiToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.border,
    marginBottom: 2,
  },
  multiToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  multiToggleText: { fontSize: 12, color: tc.mutedForeground, fontWeight: '500' },
  multiToggleTextActive: { color: tc.primary },
  togglePill: {
    width: 36, height: 20, borderRadius: 10,
    backgroundColor: tc.border,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  togglePillActive: { backgroundColor: tc.primary },
  toggleThumb: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#fff',
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  // Checkbox row in multi-select
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5, borderColor: tc.border,
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxSelected: { backgroundColor: tc.primary, borderColor: tc.primary },
  checkmark: { color: '#fff', fontSize: 11, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  dropdownWrapper: { flex: 1, zIndex: 10 },
  dropdown: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: tc.background, borderRadius: borderRadius.sm,
    borderWidth: 1, borderColor: tc.border,
    paddingHorizontal: spacing.sm, height: 36,
  },
  dropdownOpen: { borderColor: tc.primary },
  dropdownText: { flex: 1, color: tc.mutedForeground, fontSize: 12 },
  dropdownTextActive: { color: tc.foreground },
  dropdownMenu: {
    position: 'relative', backgroundColor: tc.card,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.border,
    marginTop: 4, overflow: 'hidden',
  },
  dropdownScroll: { maxHeight: 180 },
  dropdownOption: {
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: tc.border,
  },
  dropdownOptionActive: { backgroundColor: tc.primaryLight },
  dropdownOptionText: { color: tc.foreground, fontSize: 12 },
  dropdownOptionTextActive: { color: tc.primary, fontWeight: '600' },
  playerCountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playerCountInput: {
    width: 60, height: 36, backgroundColor: tc.background,
    borderRadius: borderRadius.sm, borderWidth: 1, borderColor: tc.border,
    paddingHorizontal: spacing.sm, color: tc.foreground, fontSize: 12, textAlign: 'center',
  },
  playerCountDash: { color: tc.mutedForeground, fontSize: 12 },
  playerCountLabel: { color: tc.mutedForeground, fontSize: 12 },
  clearButton: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 4, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: borderRadius.sm,
  },
  clearButtonText: { color: tc.mutedForeground, fontSize: 12 },
  resultsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultsCount: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resultsText: { color: tc.mutedForeground, fontSize: 12 },
}); };
