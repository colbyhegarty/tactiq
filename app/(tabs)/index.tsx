import { useRouter } from 'expo-router';
import { LayoutGrid, LayoutList, Library } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrillCard } from '../../src/components/DrillCard';
import { DrillDetailModal } from '../../src/components/DrillDetailModal';
import { DrillFilters } from '../../src/components/DrillFilters';
import { QuickPreviewModal } from '../../src/components/QuickPreviewModal';
import {
  DrillFilterParams,
  LibraryDrillMeta,
  fetchFilterOptions,
  fetchFilteredDrills,
  fetchLibraryDrill,
  fetchLibraryDrills,
  filterByAgeGroup,
  filterByDuration,
  filterByPlayerCount,
  mapLibraryDrillToDrill,
  warmUpBackend,
} from '../../src/lib/api';
import { isDrillSaved, removeDrill, saveDrill } from '../../src/lib/storage';
import { borderRadius, colors, spacing } from '../../src/theme/colors';
import { Drill } from '../../src/types/drill';


const DRILLS_PER_PAGE = 20;

// ── Memoized header to prevent FlatList remounting on data changes ──
const ListHeader = React.memo(({
  categories, ageGroups, durations, filters, onFilterChange,
  resultCount, isLoading, gridCols, onGridColsChange,
}: {
  categories: string[];
  ageGroups: string[];
  durations: string[];
  filters: DrillFilterParams;
  onFilterChange: (f: DrillFilterParams) => void;
  resultCount: number;
  isLoading: boolean;
  gridCols: 1 | 2;
  onGridColsChange: (cols: 1 | 2) => void;
}) => (
  <View style={styles.header}>
    {/* Title Row */}
    <View style={styles.titleRow}>
      <View style={styles.logoContainer}>
        <Library size={20} color={colors.primaryForeground} />
      </View>
      <Text style={styles.title}>Drill Library</Text>
    </View>

    {/* Filters */}
    <DrillFilters
      categories={categories}
      ageGroups={ageGroups}
      durations={durations}
      filters={filters}
      onFilterChange={onFilterChange}
      resultCount={resultCount}
      isLoading={isLoading}
    />

    {/* View Toggle */}
    <View style={styles.viewToggleRow}>
      <View style={{ flex: 1 }} />
      <View style={styles.viewToggle}>
        <TouchableOpacity
          style={[styles.toggleButton, gridCols === 1 && styles.toggleButtonActive]}
          onPress={() => onGridColsChange(1)}
        >
          <LayoutList
            size={14}
            color={gridCols === 1 ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, gridCols === 2 && styles.toggleButtonActive]}
          onPress={() => onGridColsChange(2)}
        >
          <LayoutGrid
            size={14}
            color={gridCols === 2 ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
    </View>
  </View>
));
ListHeader.displayName = 'ListHeader';

export default function LibraryScreen() {
  // Filter options from Supabase
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const durations = ['10 min.', '15 min.', '20 min.', '30 min.'];

  // State
  const [filters, setFilters] = useState<DrillFilterParams>({});
  const [drillsMeta, setDrillsMeta] = useState<LibraryDrillMeta[]>([]);
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [savedState, setSavedState] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDrill, setIsLoadingDrill] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [gridCols, setGridCols] = useState<1 | 2>(1);
  const [quickPreviewDrill, setQuickPreviewDrill] = useState<Drill | null>(null);

  // Warm up backend on mount
  useEffect(() => {
    warmUpBackend();
  }, []);

  // Load filter options once
  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const optionsRes = await fetchFilterOptions();
        if (optionsRes.success) {
          setCategories(optionsRes.categories);
          setAgeGroups(optionsRes.ageGroups);
        }
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    }
    loadFilterOptions();
  }, []);

  const loadDrills = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build server-side filters
      const serverFilters: DrillFilterParams = {};
      if (filters.category) serverFilters.category = filters.category;
      if (filters.difficulty) serverFilters.difficulty = filters.difficulty;
      if (filters.search) serverFilters.search = filters.search;
      if (filters.has_animation !== undefined)
        serverFilters.has_animation = filters.has_animation;

      const hasServerFilters = Object.keys(serverFilters).length > 0;
      const drillsRes = hasServerFilters
        ? await fetchFilteredDrills(serverFilters)
        : await fetchLibraryDrills();

      if (drillsRes.success) {
        let filteredDrills = drillsRes.drills;
        // Client-side filters
        filteredDrills = filterByPlayerCount(
          filteredDrills,
          filters.min_players,
          filters.max_players,
        );
        filteredDrills = filterByDuration(filteredDrills, filters.duration);
        filteredDrills = filterByAgeGroup(filteredDrills, filters.age_group);
        setDrillsMeta(filteredDrills);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load drills');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  // Load drills when filters change
  useEffect(() => {
    loadDrills();
  }, [loadDrills]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDrills();
  };

  // Map meta to display drills
  const drillsForDisplay: Drill[] = useMemo(
    () => drillsMeta.map((meta) => mapLibraryDrillToDrill(meta)),
    [drillsMeta],
  );

  // Pagination
  const totalPages = Math.max(1, Math.ceil(drillsForDisplay.length / DRILLS_PER_PAGE));
  const paginatedDrills = useMemo(() => {
    const start = (currentPage - 1) * DRILLS_PER_PAGE;
    return drillsForDisplay.slice(start, start + DRILLS_PER_PAGE);
  }, [drillsForDisplay, currentPage]);

  // Drill detail handler
  const handleViewDrill = async (drill: Drill) => {
    setIsLoadingDrill(true);
    try {
      const response = await fetchLibraryDrill(drill.id);
      if (response.success) {
        const fullDrill = mapLibraryDrillToDrill(
          {
            id: response.drill.id,
            name: response.drill.name,
            category: response.drill.category,
            player_count: response.drill.player_count,
            duration: response.drill.duration,
            age_group: response.drill.age_group,
            difficulty: response.drill.difficulty,
            description: response.drill.description,
          },
          response.drill,
          response.svg_url,
        );
        setSelectedDrill(fullDrill);
      }
    } catch (err) {
      console.error('Failed to load drill details:', err);
      setSelectedDrill(drill);
    } finally {
      setIsLoadingDrill(false);
    }
  };

  // Save/unsave drill
  const handleSaveDrill = async (drill: Drill) => {
    const currentlySaved = savedState[drill.id] ?? (await isDrillSaved(drill.id));
    if (currentlySaved) {
      await removeDrill(drill.id);
      setSavedState((prev) => ({ ...prev, [drill.id]: false }));
    } else {
      try {
        const response = await fetchLibraryDrill(drill.id);
        if (response.success) {
          const fullDrill = mapLibraryDrillToDrill(
            {
              id: response.drill.id,
              name: response.drill.name,
              category: response.drill.category,
              player_count: response.drill.player_count,
              duration: response.drill.duration,
              age_group: response.drill.age_group,
              difficulty: response.drill.difficulty,
              description: response.drill.description,
            },
            response.drill,
            response.svg_url,
          );
          await saveDrill(fullDrill);
        } else {
          await saveDrill(drill);
        }
      } catch {
        await saveDrill(drill);
      }
      setSavedState((prev) => ({ ...prev, [drill.id]: true }));
    }
  };

  const isDrillCurrentlySaved = (drillId: string): boolean => {
    return savedState[drillId] ?? false;
  };

  const renderHeader = useCallback(() => (
    <ListHeader
      categories={categories}
      ageGroups={ageGroups}
      durations={durations}
      filters={filters}
      onFilterChange={setFilters}
      resultCount={drillsForDisplay.length}
      isLoading={isLoading}
      gridCols={gridCols}
      onGridColsChange={setGridCols}
    />
  ), [categories, ageGroups, durations, filters, drillsForDisplay.length, isLoading, gridCols]);

  // Inline empty/loading/error content shown inside the FlatList
  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading drills...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadDrills}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centered}>
        <View style={styles.emptyIcon}>
          <Library size={32} color={colors.mutedForeground} />
        </View>
        <Text style={styles.emptyTitle}>No drills found</Text>
        <Text style={styles.emptySubtitle}>
          Try adjusting your filters or search criteria.
        </Text>
        {Object.keys(filters).length > 0 && (
          <TouchableOpacity
            style={styles.clearFiltersButton}
            onPress={() => setFilters({})}
          >
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [isLoading, error, filters, loadDrills]);

  // Pagination footer
  const renderFooter = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
          onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <Text
            style={[
              styles.pageButtonText,
              currentPage === 1 && styles.pageButtonTextDisabled,
            ]}
          >
            Previous
          </Text>
        </TouchableOpacity>

        <Text style={styles.pageInfo}>
          {currentPage} / {totalPages}
        </Text>

        <TouchableOpacity
          style={[
            styles.pageButton,
            currentPage === totalPages && styles.pageButtonDisabled,
          ]}
          onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          <Text
            style={[
              styles.pageButtonText,
              currentPage === totalPages && styles.pageButtonTextDisabled,
            ]}
          >
            Next
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      <FlatList
        data={paginatedDrills}
        keyExtractor={(item) => item.id}
        numColumns={gridCols}
        key={`grid-${gridCols}`}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        renderItem={({ item }) => (
          <View style={gridCols === 2 ? styles.gridItem : undefined}>
            <DrillCard
              drill={item}
              onPress={handleViewDrill}
              onSave={handleSaveDrill}
              isSaved={isDrillCurrentlySaved(item.id)}
              compact={gridCols === 2}
              onQuickView={setQuickPreviewDrill}
            />
          </View>
        )}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Loading overlay for drill details */}
      {isLoadingDrill && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingOverlayText}>Loading drill details...</Text>
        </View>
      )}

      {/* Drill Detail Modal */}
      <DrillDetailModal
        drill={selectedDrill}
        isOpen={selectedDrill !== null}
        onClose={() => setSelectedDrill(null)}
        isSaved={selectedDrill ? isDrillCurrentlySaved(selectedDrill.id) : false}
        onSave={handleSaveDrill}
        onUseAsTemplate={(drill) => {
          setSelectedDrill(null);
          router.push({ pathname: '/drill-editor', params: { templateId: drill.id } });
        }}
      />

      <QuickPreviewModal
        drill={quickPreviewDrill}
        isOpen={quickPreviewDrill !== null}
        onClose={() => setQuickPreviewDrill(null)}
        onViewFull={(drill) => { setQuickPreviewDrill(null); handleViewDrill(drill); }}
        isSaved={quickPreviewDrill ? isDrillCurrentlySaved(quickPreviewDrill.id) : false}
        onSave={handleSaveDrill}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.foreground,
  },
  viewToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 4,
  },
  toggleButton: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  gridItem: {
    flex: 1,
    maxWidth: '50%',
  },
  listContent: {
    paddingBottom: 100,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl * 3,
  },
  loadingText: {
    color: colors.mutedForeground,
    fontSize: 14,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.destructive,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    color: colors.mutedForeground,
    fontSize: 14,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: spacing.md,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  clearFiltersText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  pageButton: {
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '500',
  },
  pageButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  pageInfo: {
    color: colors.mutedForeground,
    fontSize: 13,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 24, 35, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  loadingOverlayText: {
    color: colors.mutedForeground,
    fontSize: 14,
    marginTop: spacing.md,
  },
});
