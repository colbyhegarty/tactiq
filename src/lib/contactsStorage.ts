import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
}

const CONTACTS_KEY = 'tactiq_contacts';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function getContacts(): Promise<Contact[]> {
  try {
    const stored = await AsyncStorage.getItem(CONTACTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export async function saveContact(contact: Omit<Contact, 'id'>): Promise<Contact> {
  const contacts = await getContacts();
  const newContact: Contact = { ...contact, id: generateId() };
  contacts.push(newContact);
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  return newContact;
}

export async function updateContact(contact: Contact): Promise<void> {
  const contacts = await getContacts();
  const idx = contacts.findIndex((c) => c.id === contact.id);
  if (idx >= 0) {
    contacts[idx] = contact;
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  }
}

export async function deleteContact(id: string): Promise<void> {
  const contacts = (await getContacts()).filter((c) => c.id !== id);
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export async function clearContacts(): Promise<void> {
  await AsyncStorage.removeItem(CONTACTS_KEY);
}
