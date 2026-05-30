// owner: groups (used by settings, conversations)

export interface Group {
  jid: string;
  subject: string;
  participantCount?: number;
  isAdmin?: boolean;
}

export interface GroupParticipant {
  jid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface GroupMetadata {
  jid: string;
  subject: string;
  desc?: string;
  owner?: string;
  participants: GroupParticipant[];
  settings: {
    announcement?: boolean;
    locked?: boolean;
  };
}