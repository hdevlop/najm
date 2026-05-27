// owner: contacts

export interface Contact {
  jid: string;
  name?: string;
  phone?: string;
  isBusiness?: boolean;
  avatar?: string;
}