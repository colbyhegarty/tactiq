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
import { spacing, borderRadius } from '../../src/theme/colors';
import { useTheme } from '../../src/theme/ThemeContext';
import { usePaywallGate, PaywallModal } from '../../src/subscription';

const PICKER_PER_PAGE = 12;

export default function CreateScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { gate, paywallVisible, paywallReason, dismissPaywall } = usePaywallGate();

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
    <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <View style={s.headerLeft}>
          <View style={[s.logoContainer, { backgroundColor: colors.primary }]}><PenTool size={20} color={colors.primaryForeground} /></View>
          <Text style={[s.headerTitle, { color: colors.foreground }]}>Create Drill</Text>
        </View>
      </View>

      <View style={s.body}>
        <Text style={[s.subtitle, { color: colors.foreground }]}>How would you like to start?</Text>
        <Text style={[s.subtext, { color: colors.mutedForeground }]}>Create a new drill from scratch or start with an existing drill from the library.</Text>

        <View style={s.cards}>
          <TouchableOpacity style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={async () => {
              const allowed = await gate('create_custom_drill');
              if (!allowed) return;
              router.push('/drill-editor');
            }} activeOpacity={0.7}>
            <View style={[s.cardIcon, { backgroundColor: colors.primaryLight }]}><Sparkles size={24} color={colors.primary} /></View>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Start from Scratch</Text>
            <Text style={[s.cardDesc, { color: colors.mutedForeground }]}>Create a new drill with a blank canvas</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[s.card, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={async () => {
              const allowed = await gate('create_custom_drill');
              if (!allowed) return;
              setShowPicker(true);
            }} activeOpacity={0.7}>
            <View style={[s.cardIcon, { backgroundColor: colors.primaryLight }]}><Copy size={24} color={colors.primary} /></View>
            <Text style={[s.cardTitle, { color: colors.foreground }]}>Start from Existing</Text>
            <Text style={[s.cardDesc, { color: colors.mutedForeground }]}>Modify a drill from the library</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showPicker} animationType="slide" statusBarTranslucent onRequestClose={() => setShowPicker(false)}>
        <SafeAreaView style={[s.container, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={[s.pickerHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.pickerTitle, { color: colors.foreground }]}>Select a Drill</Text>
            <TouchableOpacity onPress={() => setShowPicker(false)}><X size={22} color={colors.foreground} /></TouchableOpacity>
          </View>
          <View style={[s.searchRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Search size={16} color={colors.mutedForeground} />
            <TextInput style={[s.searchInput, { color: colors.foreground }]} placeholder="Search drills..." placeholderTextColor={colors.mutedForeground} value={pickerSearch} onChangeText={setPickerSearch} />
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
                <TouchableOpacity style={[s.pickerCard, { borderColor: colors.border, backgroundColor: colors.card }]} onPress={() => handleSelectDrill(item.id)} activeOpacity={0.7}>
                  <View style={s.pickerThumb}>
                    {item.svg_url ? (
                      <Image source={{ uri: item.svg_url + '?v=4' }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                    ) : (
                      <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>No preview</Text>
                    )}
                  </View>
                  <Text style={[s.pickerName, { color: colors.foreground }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[s.pickerCat, { color: colors.mutedForeground }]} numberOfLines={1}>{item.category}</Text>
                </TouchableOpacity>
              )}
              ListFooterComponent={totalPages > 1 ? (
                <View style={s.pagination}>
                  <TouchableOpacity style={[s.pageBtn, { backgroundColor: colors.card, borderColor: colors.border }, pickerPage === 1 && { opacity: 0.3 }]} disabled={pickerPage === 1} onPress={() => setPickerPage(p => p - 1)}>
                    <ChevronLeft size={16} color={colors.foreground} />
                  </TouchableOpacity>
                  <Text style={[s.pageText, { color: colors.mutedForeground }]}>{pickerPage} / {totalPages}</Text>
                  <TouchableOpacity style={[s.pageBtn, { backgroundColor: colors.card, borderColor: colors.border }, pickerPage === totalPages && { opacity: 0.3 }]} disabled={pickerPage === totalPages} onPress={() => setPickerPage(p => p + 1)}>
                    <ChevronRight size={16} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              ) : null}
            />
          )}
        </SafeAreaView>
      </Modal>

      <PaywallModal
        visible={paywallVisible}
        onDismiss={dismissPaywall}
        reason={paywallReason}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoContainer: { width: 40, height: 40, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg },
  subtitle: { fontSize: 20, fontWeight: '600', marginBottom: spacing.sm, textAlign: 'center' },
  subtext: { fontSize: 14, textAlign: 'center', marginBottom: spacing.xl },
  cards: { width: '100%', gap: spacing.md },
  card: { borderWidth: 2, borderRadius: borderRadius.lg, padding: spacing.lg },
  cardIcon: { width: 48, height: 48, borderRadius: borderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: spacing.xs },
  cardDesc: { fontSize: 13 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1 },
  pickerTitle: { fontSize: 18, fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'center', borderRadius: borderRadius.md, borderWidth: 1, marginHorizontal: spacing.md, marginVertical: spacing.sm, paddingHorizontal: spacing.sm, height: 40, gap: spacing.xs },
  searchInput: { flex: 1, fontSize: 14 },
  pickerGrid: { padding: spacing.sm, paddingBottom: 100 },
  pickerCard: { flex: 1, margin: spacing.xs, borderWidth: 1, borderRadius: borderRadius.md, overflow: 'hidden' },
  pickerThumb: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#63b043', justifyContent: 'center', alignItems: 'center' },
  pickerName: { fontSize: 13, fontWeight: '500', padding: spacing.xs, paddingBottom: 2 },
  pickerCat: { fontSize: 10, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  pageBtn: { borderWidth: 1, borderRadius: borderRadius.sm, padding: 8 },
  pageText: { fontSize: 12 },
});
