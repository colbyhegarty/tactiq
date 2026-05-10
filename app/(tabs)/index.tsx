import { useRouter } from 'expo-router';
import { LayoutGrid, LayoutList, Library } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useSubscription, usePaywallGate, PaywallModal } from '../../src/subscription';
import { trackScreen, track } from '../../src/lib/analytics';
import { borderRadius, spacing } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';
import { Drill } from '../../src/types/drill';

// Number of drills to show per page
const PAGE_SIZE = 20;

export default function LibraryScreen() {
  const router = useRouter();
  const { colors: tc, isDark } = useTheme();
  const styles = create_styles(tc);
  const { isDrillUnlocked } = useSubscription();
  const { gate, paywallVisible, paywallReason, dismissPaywall } = usePaywallGate();
  const [categories, setCategories] = useState<string[]>([]);
  const [ageGroups, setAgeGroups] = useState<string[]>([]);
  const durations = ['10 min.', '15 min.', '20 min.', '30 min.'];

  const [filters, setFilters] = useState<DrillFilterParams>({});
  const [drillsMeta, setDrillsMeta] = useState<LibraryDrillMeta[]>([]);
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [savedState, setSavedState] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDrill, setIsLoadingDrill] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gridCols, setGridCols] = useState<1 | 2>(1);
  const [quickPreviewDrill, setQuickPreviewDrill] = useState<Drill | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    warmUpBackend();
    trackScreen('Library');
  }, []);

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
        filteredDrills = filterByPlayerCount(filteredDrills, filters.min_players, filters.max_players);
        filteredDrills = filterByDuration(filteredDrills, filters.duration);
        filteredDrills = filterByAgeGroup(filteredDrills, filters.age_group);

        if (!filters.search) {
          filteredDrills = [...filteredDrills].sort((a, b) => {
            const hashA = a.id.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
            const hashB = b.id.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
            return hashA - hashB;
          });
        }

        setDrillsMeta(filteredDrills);
        setPage(1); // Reset to first page on new load
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load drills');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadDrills();
  }, [loadDrills]);

  // Scroll to top and reset page on filter change
  useEffect(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    setPage(1);
  }, [filters]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDrills();
  };

  const allDrills: Drill[] = useMemo(
    () => drillsMeta.map((meta) => mapLibraryDrillToDrill(meta)),
    [drillsMeta],
  );

  // Only show drills up to current page
  const visibleDrills = useMemo(
    () => allDrills.slice(0, page * PAGE_SIZE),
    [allDrills, page],
  );

  const hasMore = visibleDrills.length < allDrills.length;

  // Called when user reaches the end — load next page
  const handleLoadMore = useCallback(() => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    // Small delay so scroll settles before new items render
    setTimeout(() => {
      setPage((prev) => prev + 1);
      setIsLoadingMore(false);
    }, 100);
  }, [isLoadingMore, hasMore, isLoading]);

  const handleViewDrill = useCallback(async (drill: Drill) => {
    if (!isDrillUnlocked(drill.id)) {
      track('locked_drill_tapped', { drill_id: drill.id, drill_name: drill.name });
      await gate('view_locked_drill');
      return;
    }

    track('drill_viewed', { drill_id: drill.id, drill_name: drill.name, category: drill.category });
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
  }, [isDrillUnlocked, gate]);

  const handleSaveDrill = useCallback(async (drill: Drill) => {
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
  }, [savedState]);

  const isDrillCurrentlySaved = useCallback((drillId: string): boolean => {
    return savedState[drillId] ?? false;
  }, [savedState]);

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={tc.primary} />
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
          <Library size={32} color={tc.mutedForeground} />
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

  const renderItem = useCallback(({ item }: { item: Drill }) => (
    <View style={gridCols === 2 ? styles.gridItem : undefined}>
      <DrillCard
        drill={item}
        onPress={handleViewDrill}
        onSave={handleSaveDrill}
        isSaved={isDrillCurrentlySaved(item.id)}
        compact={gridCols === 2}
        onQuickView={isDrillUnlocked(item.id) ? setQuickPreviewDrill : undefined}
        isLocked={!isDrillUnlocked(item.id)}
      />
    </View>
  ), [gridCols, handleViewDrill, handleSaveDrill, isDrillCurrentlySaved, isDrillUnlocked, styles]);
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadMoreContainer}>
        <ActivityIndicator size="small" color={tc.primary} />
      </View>
    );
  }, [isLoadingMore, tc.primary]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tc.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={tc.background} />

      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.logoContainer}>
            <Library size={20} color={tc.primaryForeground} />
          </View>
          <Text style={styles.title}>Drill Library</Text>
        </View>
        <DrillFilters
          categories={categories}
          ageGroups={ageGroups}
          durations={durations}
          filters={filters}
          onFilterChange={setFilters}
          resultCount={allDrills.length}
          isLoading={isLoading}
        />
        <View style={styles.viewToggleRow}>
          <View style={{ flex: 1 }} />
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.toggleButton, gridCols === 1 && styles.toggleButtonActive]}
              onPress={() => setGridCols(1)}
            >
              <LayoutList size={14} color={gridCols === 1 ? tc.primaryForeground : tc.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, gridCols === 2 && styles.toggleButtonActive]}
              onPress={() => setGridCols(2)}
            >
              <LayoutGrid size={14} color={gridCols === 2 ? tc.primaryForeground : tc.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={visibleDrills}
        keyExtractor={(item) => item.id}
        numColumns={gridCols}
        key={`grid-${gridCols}`}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
        removeClippedSubviews={true}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.01}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tc.primary}
            colors={[tc.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {isLoadingDrill && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={tc.primary} />
          <Text style={styles.loadingOverlayText}>Loading drill details...</Text>
        </View>
      )}

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

      <PaywallModal
        visible={paywallVisible}
        onDismiss={dismissPaywall}
        reason={paywallReason}
      />
    </SafeAreaView>
  );
}

function create_styles(tc: any) { return StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.background },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: tc.border,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  logoContainer: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    backgroundColor: tc.primary, justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 24, fontWeight: '700', color: tc.foreground },
  viewToggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  viewToggle: { flexDirection: 'row', gap: 4 },
  toggleButton: {
    width: 28, height: 28, borderRadius: borderRadius.sm,
    backgroundColor: tc.card, borderWidth: 1, borderColor: tc.border,
    justifyContent: 'center', alignItems: 'center',
  },
  toggleButtonActive: { backgroundColor: tc.primary, borderColor: tc.primary },
  gridItem: { flex: 1, maxWidth: '50%' },
  listContent: { paddingBottom: 100, flexGrow: 1 },
  centered: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xl * 3,
  },
  loadingText: { color: tc.mutedForeground, fontSize: 14, marginTop: spacing.md },
  errorText: { color: tc.destructive, fontSize: 14, textAlign: 'center', marginBottom: spacing.md },
  retryButton: {
    backgroundColor: tc.card, paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm, borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: tc.border,
  },
  retryText: { color: tc.foreground, fontSize: 14, fontWeight: '500' },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: tc.card,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  emptyTitle: { color: tc.foreground, fontSize: 18, fontWeight: '600', marginBottom: spacing.xs },
  emptySubtitle: { color: tc.mutedForeground, fontSize: 14, textAlign: 'center' },
  clearFiltersButton: {
    marginTop: spacing.md, backgroundColor: tc.card,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: tc.border,
  },
  clearFiltersText: { color: tc.foreground, fontSize: 14, fontWeight: '500' },
  loadMoreContainer: { paddingVertical: spacing.lg, alignItems: 'center' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(21, 24, 35, 0.85)',
    justifyContent: 'center', alignItems: 'center', zIndex: 100,
  },
  loadingOverlayText: { color: tc.mutedForeground, fontSize: 14, marginTop: spacing.md },
}); };
