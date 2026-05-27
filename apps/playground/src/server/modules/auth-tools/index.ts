const enabled = process.env.MCP_AUTH_TOOLS !== 'false';

export const AuthToolsController = enabled
  ? (await import('./AuthToolsController')).AuthToolsController
  : undefined;

export const UserToolsController = enabled
  ? (await import('./UserToolsController')).UserToolsController
  : undefined;

export const RoleToolsController = enabled
  ? (await import('./RoleToolsController')).RoleToolsController
  : undefined;

export const PermissionToolsController = enabled
  ? (await import('./PermissionToolsController')).PermissionToolsController
  : undefined;
