// owner: conversations (used by contacts, messages, groups, settings, dashboard)

export interface Conversation {
  id: string;
  jid: string;
  name: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string; // ISO timestamp
  isGroup?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
}

export interface Message {
  id: string;
  jid: string;
  fromMe: boolean;
  text: string;
  timestamp: string; // ISO timestamp
  status?: 'pending' | 'sent' | 'delivered' | 'read';
}