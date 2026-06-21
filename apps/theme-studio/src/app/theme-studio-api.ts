import type { NajmDesignConfig } from 'najm-kit';

export interface ThemeProject {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemeStyle {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  config: NajmDesignConfig;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface WrappedResponse<T> {
  data: T;
  status?: string;
  message?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const wrapped = payload as WrappedResponse<unknown> | null;
    const message = wrapped?.message ?? `Request failed: ${response.status}`;
    throw new Error(message);
  }

  const wrapped = payload as WrappedResponse<T> | null;
  return (wrapped?.data ?? (payload as T)) as T;
}

export const themeStudioApi = {
  listProjects: () => api<ThemeProject[]>('/theme-projects'),
  getProject: (id: string) => api<ThemeProject>(`/theme-projects/${id}`),
  createProject: (body: { name: string; slug?: string; description?: string }) =>
    api<ThemeProject>('/theme-projects', { method: 'POST', body: JSON.stringify(body) }),
  updateProject: (
    id: string,
    body: Partial<Pick<ThemeProject, 'name' | 'slug' | 'description'>>,
  ) =>
    api<ThemeProject>(`/theme-projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deleteProject: (id: string) =>
    api<{ deleted: true }>(`/theme-projects/${id}`, { method: 'DELETE' }),

  listStyles: (projectId: string) =>
    api<ThemeStyle[]>(`/theme-projects/${projectId}/styles`),
  getStyle: (id: string) => api<ThemeStyle>(`/theme-styles/${id}`),
  createStyle: (
    projectId: string,
    body: { name: string; description?: string; config: NajmDesignConfig; isDefault?: boolean },
  ) =>
    api<ThemeStyle>(`/theme-projects/${projectId}/styles`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateStyle: (
    id: string,
    body: Partial<{
      name: string;
      description: string;
      config: NajmDesignConfig;
      isDefault: boolean;
    }>,
  ) =>
    api<ThemeStyle>(`/theme-styles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  duplicateStyle: (id: string, body: { name?: string } = {}) =>
    api<ThemeStyle>(`/theme-styles/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteStyle: (id: string) =>
    api<{ deleted: true }>(`/theme-styles/${id}`, { method: 'DELETE' }),
  setDefaultStyle: (id: string) =>
    api<ThemeStyle>(`/theme-styles/${id}/default`, { method: 'POST' }),
};
