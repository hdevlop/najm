// ============ ROLE CONSTANTS ============ //

export const ROLES = {
  ADMIN: 'admin',
} as const;

export const ROLE_GROUPS = {
  ADMINISTRATORS: [ROLES.ADMIN],
};

export type RoleType = typeof ROLES[keyof typeof ROLES];
export type RoleInput = string | string[];