import React from 'react';
import { User, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Contact } from '@/features/contacts/types';

interface ContactListProps {
  contacts: Contact[];
  selectedJid?: string | null;
  onSelect?: (jid: string) => void;
}

export function ContactList({ contacts, selectedJid, onSelect }: ContactListProps) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {contacts.map((contact) => (
        <button
          key={contact.jid}
          onClick={() => onSelect?.(contact.jid)}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
            selectedJid === contact.jid
              ? 'bg-surface text-txt-primary'
              : 'hover:bg-card-hover text-txt-secondary'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-txt-muted">
            {contact.avatar ? (
              <img src={contact.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <User size={16} />
            )}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-txt-primary">
              {contact.name || contact.jid}
            </span>
            {contact.phone && (
              <span className="truncate text-xs text-txt-muted">{contact.phone}</span>
            )}
          </div>
          {contact.isBusiness && (
            <Briefcase size={14} className="ml-auto shrink-0 text-brand" />
          )}
        </button>
      ))}
    </div>
  );
}
