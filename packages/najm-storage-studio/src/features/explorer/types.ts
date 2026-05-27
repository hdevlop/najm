export interface FileItem {
  namespace: string;
  filePath: string;
  mimeType: string;
  size: number;
  updatedAt: string;
  url?: string;
  tags?: string[];
}

export type SortKey = 'name' | 'size' | 'modified' | 'type';
export type SortDir = 'asc' | 'desc';

// owner: explorer (used by trash for deleted files)
export interface FileInfo {
  namespace: string;
  filePath: string;
  mimeType: string;
  size: number;
  category: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  tags?: string[];
  url?: string;
}

export interface ListResult {
  files: FileInfo[];
  folders?: string[];
  nextCursor?: string | null;
}

export type Clipboard = { mode: 'cut' | 'copy'; paths: string[] } | null;

export interface NewFolderState {
  open: boolean;
  name: string;
  busy: boolean;
  error: string | null;
}

export interface RenameState {
  path: string;
  value: string;
  busy: boolean;
  error: string | null;
}

export interface MoveState {
  paths: string[];
  dest: string;
  busy: boolean;
  error: string | null;
}

export interface DeleteState {
  paths: string[];
  busy: boolean;
  error: string | null;
}
