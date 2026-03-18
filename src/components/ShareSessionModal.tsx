import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import { Check, Mail, MessageSquare, User, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Contact, getContacts } from '../lib/contactsStorage';
import { generatePDFUri } from '../lib/sessionPdf';
import { getUserProfile } from '../lib/storage';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';
import { Drill, PdfSettings, defaultPdfSettings } from '../types/drill';
import { Session } from '../types/session';

interface ShareSessionModalProps {
  session: Session;
  drillDetails?: Record<string, Drill>;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareSessionModal({ session, drillDetails, isOpen, onClose }: ShareSessionModalProps) {
  const { colors: tc } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pdfSettings, setPdfSettings] = useState<PdfSettings>(defaultPdfSettings);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getContacts().then(setContacts);
      getUserProfile().then(p => { if (p.pdfSettings) setPdfSettings(p.pdfSettings); });
      setSelected(new Set());
    }
  }, [isOpen]);

  const toggleContact = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleShare = async (method: 'email' | 'text') => {
    const selectedContacts = contacts.filter(c => selected.has(c.id));
    if (selectedContacts.length === 0) {
      Alert.alert('No Contacts', 'Select at least one contact to share with.');
      return;
    }

    setSending(true);
    try {
      const pdfUri = await generatePDFUri(session, drillDetails, pdfSettings);
      const title = session.title || 'Training Session';

      if (method === 'email') {
        const recipients = selectedContacts
          .map(c => c.email)
          .filter(Boolean);

        if (recipients.length === 0) {
          Alert.alert('No Emails', 'Selected contacts have no email addresses.');
          setSending(false);
          return;
        }

        await MailComposer.composeAsync({
          recipients,
          subject: `Training Session: ${title}`,
          body: `Hi,\n\nPlease find attached the session plan for "${title}".\n\nBest regards`,
          attachments: [pdfUri],
        });
      } else {
        const phones = selectedContacts
          .map(c => c.phone)
          .filter(Boolean);

        if (phones.length === 0) {
          Alert.alert('No Phone Numbers', 'Selected contacts have no phone numbers.');
          setSending(false);
          return;
        }

        const isAvailable = await SMS.isAvailableAsync();
        if (!isAvailable) {
          Alert.alert('SMS Not Available', 'SMS is not available on this device.');
          setSending(false);
          return;
        }

        await SMS.sendSMSAsync(
          phones,
          `Here is the session plan for "${title}". The PDF is attached.`,
          { attachments: { uri: pdfUri, mimeType: 'application/pdf', filename: `${title}.pdf` } },
        );
      }

      onClose();
    } catch (err: any) {
      // User cancelled the compose — not an error
      if (err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        // Silently ignore
      } else {
        Alert.alert('Error', 'Failed to share session. Please try again.');
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={st.sheet}>
          {/* Header */}
          <View style={st.sheetHeader}>
            <Text style={st.sheetTitle}>Share Session</Text>
            <TouchableOpacity onPress={onClose} style={st.closeBtn}>
              <X size={20} color={tc.foreground} />
            </TouchableOpacity>
          </View>

          <Text style={st.subtitle}>
            Select contacts to share "<Text style={st.subtitleBold}>{session.title || 'Untitled Session'}</Text>" with:
          </Text>

          {/* Contact list */}
          {contacts.length === 0 ? (
            <View style={st.emptyState}>
              <View style={st.emptyIcon}><User size={24} color={tc.mutedForeground} /></View>
              <Text style={st.emptyTitle}>No contacts yet</Text>
              <Text style={st.emptySubtitle}>Add contacts in your profile settings first</Text>
            </View>
          ) : (
            <ScrollView style={st.contactList} showsVerticalScrollIndicator={false}>
              {contacts.map(contact => {
                const isSelected = selected.has(contact.id);
                return (
                  <TouchableOpacity
                    key={contact.id}
                    style={[st.contactRow, isSelected && st.contactRowSelected]}
                    onPress={() => toggleContact(contact.id)}
                    activeOpacity={0.7}
                  >
                    <View style={[st.contactAvatar, isSelected && st.contactAvatarSelected]}>
                      {isSelected
                        ? <Check size={14} color={tc.primaryForeground} />
                        : <User size={12} color={tc.mutedForeground} />
                      }
                    </View>
                    <View style={st.contactInfo}>
                      <Text style={st.contactName}>{contact.name}</Text>
                      <Text style={st.contactDetail} numberOfLines={1}>
                        {contact.email || contact.phone || 'No contact info'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Action buttons */}
          {contacts.length > 0 && (
            <View style={st.actions}>
              <TouchableOpacity
                style={[st.actionBtn, st.actionBtnEmail, selected.size === 0 && st.actionBtnDisabled]}
                onPress={() => handleShare('email')}
                disabled={selected.size === 0 || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={tc.primary} />
                ) : (
                  <>
                    <Mail size={16} color={selected.size === 0 ? tc.mutedForeground : tc.primary} />
                    <Text style={[st.actionBtnText, selected.size === 0 && st.actionBtnTextDisabled]}>Email PDF</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.actionBtn, st.actionBtnText2, selected.size === 0 && st.actionBtnDisabled]}
                onPress={() => handleShare('text')}
                disabled={selected.size === 0 || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={tc.primary} />
                ) : (
                  <>
                    <MessageSquare size={16} color={selected.size === 0 ? tc.mutedForeground : tc.primary} />
                    <Text style={[st.actionBtnText, selected.size === 0 && st.actionBtnTextDisabled]}>Text PDF</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#151823',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#e8eaed' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1e2433', justifyContent: 'center', alignItems: 'center' },
  subtitle: { fontSize: 13, color: '#8b919e', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  subtitleBold: { color: '#e8eaed', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 2, marginHorizontal: spacing.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: '#2a3142', borderRadius: borderRadius.lg },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#1e2433', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#e8eaed', marginBottom: spacing.xs },
  emptySubtitle: { fontSize: 12, color: '#8b919e' },
  contactList: { maxHeight: 300, paddingHorizontal: spacing.lg },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#2a3142',
    backgroundColor: '#1e2433',
    marginBottom: spacing.sm,
  },
  contactRowSelected: {
    borderColor: '#4a9d6e',
    backgroundColor: 'rgba(74,157,110,0.06)',
  },
  contactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#151823',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactAvatarSelected: {
    backgroundColor: '#4a9d6e',
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 14, fontWeight: '500', color: '#e8eaed' },
  contactDetail: { fontSize: 11, color: '#8b919e', marginTop: 1 },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2a3142',
    backgroundColor: '#1e2433',
  },
  actionBtnEmail: {},
  actionBtnText2: {},
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#4a9d6e' },
  actionBtnTextDisabled: { color: '#8b919e' },
});
