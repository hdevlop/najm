// owner: instances (used by dashboard, settings, profile, conversations, groups, shared)

export interface Instance {
  id: string;
  name: string;
  status: string;
  phone?: string;
  profileName?: string;
  qrCode?: string;
  lastError?: string;
  connectedAt?: string;
  createdAt: string;
  messageCount?: number;
  contactCount?: number;
}