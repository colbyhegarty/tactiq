import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar, ActivityIndicator,
  ScrollView, Modal, TextInput, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { PenTool, Sparkles, Copy, Search, X, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { fetchDrills } from '../../src/lib/api';
import { Drill } from '../../src/types/drill';
import { colors, spacing, borderRadius } from '../../src/theme/colors';

const PICKER_PER_PAGE = 12;

export default function CreateScreen() {
  const router = useRouter();

  // Drill Picker state
  const [showPicker, setShowPicker] = useState(false);
  const [pickerDrills, setPickerDrills] = useState<Drill[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerPage, setPickerPage] = useState(1);

  const loadPickerDrills = async () => {
    setPickerLoading(true);
    try { setPickerDrills(await fetchDrills({})); } catch {}
    finally { setPickerLoading(false); }
  };

  useEffect(() => {
    if (showPicker && pickerDrills.length === 0) loadPickerDrills();
  }, [showPicker]);

  useEffect(() => { setPickerPage(1); }, [pickerSearch]);

  const filtered = pickerDrills.filter(d =>
    d.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
    (d.category || '').toLowerCase().includes(pickerSearch.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PICKER_PER_PAGE));
  const paginated = filtered.slice((pickerPage - 1) * PICKER_PER_PAGE, pickerPage * PICKER_PER_PAGE);

  const handleSelectDrill = (drillId: string) => {
    setShowPicker(false);
    router.push({ pathname: '/drill-editor', params: { templateId: drillId } });
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoContainer}><PenTool size={20} color={colors.primaryForeground} /></View>
          <Text style={s.headerTitle}>Create Drill</Text>
        </View>
      </View>

      {/* Choose mode */}
      <View style={s.body}>
        <Text style={s.subtitle}>How would you like to start?</Text>
        <Text style={s.subtext}>Create a new drill from scratch or start with an existing drill from the library.</Text>

        <View style={s.cards}>
          <TouchableOpacity style={s.card} onPress={() => router.push('/drill-editor')} activeOpacity={0.7}>
            <View style={s.cardIcon}><Sparkles size={24} color={colors.primary} /></View>
            <Text style={s.cardTitle}>Start from Scratch</Text>
            <Text style={s.cardDesc}>Create a new drill with a blank canvas</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.card} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
            <View style={s.cardIcon}><Copy size={24} color={colors.primary} /></View>
            <Text style={s.cardTitle}>Start from Existing</Text>
            <Text style={s.cardDesc}>Modify a drill from the library</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Drill Picker Modal */}
      <Modal visible={showPicker} animationType="slide" statusBarTranslucent onRequestClose={() => setShowPicker(false)}>
        <SafeAreaView style={s.container} edges={['top']}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>Select a Drill</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}><X size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <View style={s.searchRow}>
            <Search size={16} color={colors.mutedForeground} />
            <TextInput style={s.searchInput} placeholder="Search drills..." placeholderTextColor={colors.mutedForeground} value={pickerSearch} onChangeText={setPickerSearch} />
          </View>
          {pickerLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
          ) : (
            <FlatList
              data={paginated}
              numColumns={2}
              keyExtractor={d => d.id}
              contentContainerStyle={s.pickerGrid}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.pickerCard} onPress={() => handleSelectDrill(item.id)} activeOpacity={0.7}>
                  <View style={s.pickerThumb}>
                    {item.svg_url ? (
                      <Image source={{ uri: item.svg_url }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                    ) : (
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>No preview</Text>
                    )}
                  </View>
                  <Text style={s.pickerName} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.pickerCat} numberOfLines={1}>{item.category}</Text>
                </TouchableOpacity>
              )}
              ListFooterComponent={totalPages > 1 ? (
                <View style={s.pagination}>
                  <TouchableOpacity style={[s.pageBtn, pickerPage === 1 && { opacity: 0.3 }]} disabled={pickerPage === 1} onPress={() => setPickerPage(p => p - 1)}>
                    <ChevronLeft size={16} color={colors.foreground} />
                  </TouchableOpacity>
                  <Text style={s.pageText}>{pickerPage} / {totalPages}</Text>
                  <TouchableOpacity style={[s.pageBtn, pickerPage === totalPages && { opacity: 0.3 }]} disabled={pickerPage === totalPages} onPress={() => setPickerPage(p => p + 1)}>
                    <ChevronRight size={16} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              ) : null}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoContainer: { width: 40, height: 40, borderRadius: borderRadius.md, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.foreground },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  subtitle: { fontSize: 20, fontWeight: '600', color: colors.foreground, marginBottom: spacing.sm, textAlign: 'center' },
  subtext: { fontSize: 14, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.xl },
  cards: { width: '100%', gap: spacing.md },
  card: { borderWidth: 2, borderColor: colors.border, borderRadius: borderRadius.lg, padding: spacing.lg },
  cardIcon: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '600', color: colors.foreground, marginBottom: spacing.xs },
  cardDesc: { fontSize: 13, color: colors.mutedForeground },
  // Picker
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerTitle: { fontSize: 18, fontWeight: '600', color: colors.foreground },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, marginHorizontal: spacing.md, marginVertical: spacing.sm, paddingHorizontal: spacing.sm, height: 40, gap: spacing.xs },
  searchInput: { flex: 1, color: colors.foreground, fontSize: 14 },
  pickerGrid: { padding: spacing.sm, paddingBottom: 100 },
  pickerCard: { flex: 1, margin: spacing.xs, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md, overflow: 'hidden', backgroundColor: colors.card },
  pickerThumb: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#63b043', justifyContent: 'center', alignItems: 'center' },
  pickerName: { fontSize: 13, fontWeight: '500', color: colors.foreground, padding: spacing.xs, paddingBottom: 2 },
  pickerCat: { fontSize: 10, color: colors.mutedForeground, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  pageBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.sm, padding: 8 },
  pageText: { fontSize: 12, color: colors.mutedForeground },
});
