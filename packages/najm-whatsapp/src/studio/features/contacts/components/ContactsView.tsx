import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, RefreshCw, Users } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { ContactList } from './ContactList';
import { AddContactModal } from './AddContactModal';
import type { Contact } from '@/features/contacts/types';
import { NPageHeader, NEmptyState, Button, Input } from 'najm-kit';

export function ContactsView() {
  const api = useApiClient();
  const { instanceId } = useSelectedInstance();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  async function fetchContacts() {
    if (!instanceId) return;
    setLoading(true);
    try {
      const data = await api.get(`/contacts/${instanceId}?limit=100&offset=0`);
      setContacts(data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchContacts();
  }, [api, instanceId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts;
    const q = query.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.jid.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
    );
  }, [contacts, query]);

  if (!instanceId) {
    return (
      <NEmptyState
        icon={Users}
        title="No instance selected"
        description="Select an instance to view contacts."
      />
    );
  }

  return (
    <NPageHeader
      icon={Users}
      title="Contacts"
      subtitle="Manage your WhatsApp contacts"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchContacts} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowModal(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col gap-3 p-5">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts..."
            className="pl-9"
          />
        </div>

        {contacts.length === 0 && !loading && (
          <NEmptyState
            icon={Users}
            title="No contacts"
            description="Add your first contact to get started."
          />
        )}

        <div className="flex-1 overflow-hidden">
          <ContactList contacts={filtered} />
        </div>
      </div>

      {showModal && (
        <AddContactModal
          onClose={() => setShowModal(false)}
          onSaved={fetchContacts}
        />
      )}
    </NPageHeader>
  );
}
