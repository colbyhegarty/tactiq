import { Mail, Phone, Plus, Trash2, User, UserPlus } from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Contact, deleteContact, getContacts, saveContact } from '../lib/contactsStorage';
import { borderRadius, spacing } from '../theme/colors';
import { useTheme } from '../theme/ThemeContext';

interface ContactsManagerProps {
  contacts: Contact[];
  onContactsChange: (contacts: Contact[]) => void;
}

export function ContactsManager({ contacts, onContactsChange }: ContactsManagerProps) {
  const { colors: tc } = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Name is required');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      Alert.alert('Email or phone is required');
      return;
    }
    await saveContact({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    const updated = await getContacts();
    onContactsChange(updated);
    setName('');
    setEmail('');
    setPhone('');
    setIsAdding(false);
  };

  const handleDelete = async (id: string, contactName: string) => {
    Alert.alert('Remove Contact', `Remove ${contactName}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteContact(id);
          const updated = await getContacts();
          onContactsChange(updated);
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <UserPlus size={16} color={tc.mutedForeground} />
          <Text style={styles.headerLabel}>Contacts</Text>
        </View>
        {!isAdding && (
          <TouchableOpacity style={styles.addButton} onPress={() => setIsAdding(true)}>
            <Plus size={14} color={tc.primary} />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Add Form */}
      {isAdding && (
        <View style={styles.addForm}>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Name *</Text>
            <TextInput
              style={styles.formInput}
              placeholder="Full name"
              placeholderTextColor={tc.mutedForeground}
              value={name}
              onChangeText={setName}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              style={styles.formInput}
              placeholder="email@example.com"
              placeholderTextColor={tc.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.formLabel}>Phone</Text>
            <TextInput
              style={styles.formInput}
              placeholder="+1 555 123 4567"
              placeholderTextColor={tc.mutedForeground}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleAdd}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setIsAdding(false);
                setName('');
                setEmail('');
                setPhone('');
              }}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Contact List */}
      {contacts.length === 0 && !isAdding ? (
        <Text style={styles.emptyText}>
          No contacts yet. Add people to share sessions with them.
        </Text>
      ) : (
        <View style={styles.contactList}>
          {contacts.map((contact) => (
            <View key={contact.id} style={styles.contactRow}>
              <View style={styles.contactAvatar}>
                <User size={14} color={tc.primary} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName} numberOfLines={1}>
                  {contact.name}
                </Text>
                <View style={styles.contactDetails}>
                  {contact.email ? (
                    <View style={styles.contactDetail}>
                      <Mail size={10} color={tc.mutedForeground} />
                      <Text style={styles.contactDetailText} numberOfLines={1}>
                        {contact.email}
                      </Text>
                    </View>
                  ) : null}
                  {contact.phone ? (
                    <View style={styles.contactDetail}>
                      <Phone size={10} color={tc.mutedForeground} />
                      <Text style={styles.contactDetailText}>{contact.phone}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(contact.id, contact.name)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Trash2 size={14} color={tc.destructive} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e8eaed',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  addButtonText: {
    fontSize: 12,
    color: '#4a9d6e',
    fontWeight: '500',
  },
  addForm: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2a3142',
    backgroundColor: 'rgba(139, 145, 158, 0.08)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  formGroup: {
    gap: 4,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8b919e',
  },
  formInput: {
    backgroundColor: '#1e2433',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#2a3142',
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    color: '#e8eaed',
    fontSize: 14,
  },
  formActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#4a9d6e',
    borderRadius: borderRadius.sm,
    paddingVertical: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelBtn: {
    backgroundColor: '#1e2433',
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: '#2a3142',
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#e8eaed',
  },
  emptyText: {
    fontSize: 12,
    color: '#8b919e',
    paddingVertical: spacing.sm,
  },
  contactList: {
    gap: 6,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#2a3142',
    backgroundColor: '#1e2433',
    padding: 10,
  },
  contactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 157, 110, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#e8eaed',
  },
  contactDetails: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  contactDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  contactDetailText: {
    fontSize: 10,
    color: '#8b919e',
  },
  deleteBtn: {
    padding: 4,
  },
});
