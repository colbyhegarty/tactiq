import { Image } from 'expo-image';
import { ArrowRight, Bookmark, BookmarkCheck, X } from 'lucide-react-native';
import React from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getCategoryColor, getDifficultyColor } from '../lib/api';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Drill } from '../types/drill';

const { height: SH } = Dimensions.get('window');

interface QuickPreviewModalProps {
  drill: Drill | null;
  isOpen: boolean;
  onClose: () => void;
  onViewFull: (drill: Drill) => void;
  isSaved: boolean;
  onSave: (drill: Drill) => void;
}

export function QuickPreviewModal({ drill, isOpen, onClose, onViewFull, isSaved, onSave }: QuickPreviewModalProps) {
  const { colors: tc } = useTheme();
  if (!drill) return null;
  const catColor = getCategoryColor(drill.category);
  const diffColor = getDifficultyColor(drill.difficulty);

  return (
    <Modal visible={isOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.container}>
        <View style={s.card}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}><X size={20} color={tc.foreground} /></TouchableOpacity>
          {drill.svg_url && (
            <View style={s.imgWrap}>
              <Image source={{ uri: drill.svg_url }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
            </View>
          )}
          <Text style={s.title} numberOfLines={2}>{drill.name}</Text>
          <View style={s.badges}>
            {drill.category && <View style={[s.badge, { backgroundColor: catColor.bg }]}><Text style={[s.badgeText, { color: catColor.text }]}>{drill.category.toUpperCase()}</Text></View>}
            {drill.difficulty && <View style={[s.badge, { backgroundColor: diffColor.bg }]}><Text style={[s.badgeText, { color: diffColor.text }]}>{drill.difficulty.toUpperCase()}</Text></View>}
          </View>
          {drill.description && <Text style={s.desc} numberOfLines={3}>{drill.description}</Text>}
          <View style={s.actions}>
            <TouchableOpacity style={s.saveBtn} onPress={() => onSave(drill)}>
              {isSaved ? <BookmarkCheck size={16} color={tc.foreground} /> : <Bookmark size={16} color={tc.primaryForeground} />}
              <Text style={[s.saveBtnText, isSaved && { color: tc.foreground }]}>{isSaved ? 'Saved' : 'Save'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.viewBtn} onPress={() => onViewFull(drill)}>
              <Text style={s.viewBtnText}>View Full</Text>
              <ArrowRight size={16} color={tc.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { backgroundColor: '#1e2433', borderRadius: borderRadius.xl, width: '100%', maxWidth: 360, overflow: 'hidden', borderWidth: 1, borderColor: '#2a3142' },
  closeBtn: { position: 'absolute', top: 12, right: 12, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: '#151823', justifyContent: 'center', alignItems: 'center' },
  imgWrap: { width: '100%', aspectRatio: 4 / 3, backgroundColor: '#63b043' },
  title: { fontSize: 18, fontWeight: '700', color: '#e8eaed', paddingHorizontal: spacing.md, paddingTop: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: borderRadius.full },
  badgeText: { fontSize: 10, fontWeight: '600' },
  desc: { fontSize: 13, color: '#8b919e', lineHeight: 19, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#4a9d6e', paddingVertical: 12, borderRadius: borderRadius.md },
  saveBtnText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
  viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#4a9d6e', paddingVertical: 12, borderRadius: borderRadius.md },
  viewBtnText: { fontSize: 13, fontWeight: '600', color: '#ffffff' },
});