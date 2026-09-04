// ============================================================================
// najm-auth/client/react — React Bindings
// ============================================================================

// Provider
export { AuthProvider } from './AuthProvider';
export { AuthBoundary } from './AuthBoundary';

// Client access
export { useAuthClient } from './context';

// State hooks
export { useAuth } from './useAuth';
export { useUser } from './useUser';
export { useSession } from './useSession';
export type { SessionStatus } from './useSession';
export { usePermissions } from './usePermissions';

// Action hooks
export { useLogin } from './useLogin';
export { useRegister } from './useRegister';
export { useLogout } from './useLogout';
export { useForgotPassword } from './useForgotPassword';
export { useResetPassword } from './useResetPassword';
export { useChangePassword } from './useChangePassword';
export { useGoogleLogin } from './useGoogleLogin';
export { useGitHubLogin } from './useGitHubLogin';
export { useOAuthCallback } from './useOAuthCallback';

// Event hooks
export { useAuthEvent } from './useAuthEvent';
export { useAuthEvents } from './useAuthEvents';
export type { AuthEventEntry } from './useAuthEvents';

// Gate components (conditional render — no redirects)
export { SignedIn } from './SignedIn';
export { SignedOut } from './SignedOut';
export { AuthLoading } from './AuthLoading';
export { Can } from './Can';
export { Role } from './Role';
export { IfAuth } from './IfAuth';

// Route protection (with redirect)
export { Protected } from './Protected';

// Full-page auth gate (blocks rendering until resolved)
export { AuthGate } from './AuthGate';

// Display components
export { UserName } from './UserName';
export { UserEmail } from './UserEmail';
export { UserRole } from './UserRole';
export { UserAvatar } from './UserAvatar';
export { PermissionList } from './PermissionList';

// Action components
export { SignOutButton } from './SignOutButton';
export { LoginButton } from './LoginButton';
export { RedirectToLogin } from './RedirectToLogin';
export { GoogleLoginButton } from './GoogleLoginButton';
export { GitHubLoginButton } from './GitHubLoginButton';
export { OAuthCallback } from './OAuthCallback';
